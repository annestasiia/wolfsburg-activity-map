#!/usr/bin/env node
/**
 * Fetch Wolfsburg district (Stadtteil) boundaries from the Overpass API
 * and write them to src/data/districtBoundaries.json.
 *
 * Usage:  node scripts/fetch-districts.cjs
 */

const fs   = require('fs')
const path = require('path')
const https = require('https')

// District names as they appear in constants.js
const DISTRICT_NAMES = [
  'Almke','Alt-Wolfsburg','Barnstorf','Brackstedt','Detmerode',
  'Ehmen','Eichelkamp','Fallersleben','Hageberg','Hattorf',
  'Hehlingen','Heiligendorf','Hellwinkel','Heßlingen','Hohenstein',
  'Klieversberg','Kreuzheide','Kästorf','Köhlerberg','Laagberg',
  'Mörse','Neindorf','Neuhaus','Nordsteimke','Rabenberg',
  'Reislingen','Rothenfelde','Sandkamp','Schillerteich','Stadtmitte',
  'Steimker Berg','Steimker Gärten','Sülfeld','Teichbreite',
  'Tiergartenbreite','Velstove','Volkswagenwerk','Vorsfelde',
  'Warmenau','Wendschott','Westhagen','Wohltberg',
]

// Some OSM names differ slightly — map them
const NAME_ALIASES = {
  'Kästorf':         ['Kästorf', 'Kästorf (Wolfsburg)'],
  'Neuhaus':         ['Neuhaus', 'Neuhaus (Wolfsburg)'],
  'Alt-Wolfsburg':   ['Alt-Wolfsburg', 'Alt Wolfsburg'],
  'Steimker Berg':   ['Steimker Berg', 'Steimkerberg'],
  'Steimker Gärten': ['Steimker Gärten', 'Steimkergärten'],
}

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query)
    const options = {
      hostname: 'overpass-api.de',
      path:     '/api/interpreter',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'wolfsburg-activity-map/1.0',
      },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
        } else {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(new Error('JSON parse error: ' + e.message)) }
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/**
 * Convert an Overpass relation (with embedded geometry via `out geom`)
 * into a GeoJSON FeatureCollection with a Polygon feature.
 */
function relationToGeoJSON(rel) {
  // Build a node map from way geometry
  const nodeMap = {}
  const ways = []

  for (const member of (rel.members || [])) {
    if (member.type !== 'way' || !member.geometry) continue
    const coords = member.geometry.map(p => [p.lon, p.lat])
    if (coords.length < 2) continue
    ways.push({ role: member.role || 'outer', coords })
    coords.forEach(c => { nodeMap[`${c[0]},${c[1]}`] = c })
  }

  if (ways.length === 0) return null

  // Stitch ways into rings
  function stitchWays(wayList) {
    if (wayList.length === 0) return []
    const remaining = wayList.map(w => ({ coords: [...w.coords], used: false }))
    const rings = []

    while (true) {
      const start = remaining.find(w => !w.used)
      if (!start) break
      start.used = true
      let ring = [...start.coords]

      let changed = true
      while (changed) {
        changed = false
        const tail = ring[ring.length - 1]
        for (const w of remaining) {
          if (w.used) continue
          const head = w.coords[0]
          const last = w.coords[w.coords.length - 1]
          if (head[0] === tail[0] && head[1] === tail[1]) {
            ring = ring.concat(w.coords.slice(1))
            w.used = true
            changed = true
            break
          }
          if (last[0] === tail[0] && last[1] === tail[1]) {
            ring = ring.concat([...w.coords].reverse().slice(1))
            w.used = true
            changed = true
            break
          }
        }
      }
      // Close the ring
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0])
      }
      if (ring.length >= 4) rings.push(ring)
    }
    return rings
  }

  const outerWays = ways.filter(w => w.role !== 'inner')
  const innerWays = ways.filter(w => w.role === 'inner')

  const outerRings = stitchWays(outerWays)
  const innerRings = stitchWays(innerWays)

  if (outerRings.length === 0) return null

  // Build polygon: first ring is outer, rest are holes
  const coordinates = [outerRings[0], ...innerRings]

  return {
    type: 'FeatureCollection',
    features: [{
      type:       'Feature',
      geometry:   { type: 'Polygon', coordinates },
      properties: { name: rel.tags?.name || '' },
    }],
  }
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function matchDistrict(osmName) {
  const norm = normalizeName(osmName)
  for (const districtName of DISTRICT_NAMES) {
    const aliases = NAME_ALIASES[districtName] || [districtName]
    if (aliases.some(a => normalizeName(a) === norm)) return districtName
    // Also try stripping "(Wolfsburg)" suffix
    const stripped = normalizeName(osmName.replace(/\s*\(wolfsburg\)/i, ''))
    if (aliases.some(a => normalizeName(a) === stripped)) return districtName
  }
  return null
}

async function main() {
  console.log('Querying Overpass API for Wolfsburg district boundaries…')

  const query = `
[out:json][timeout:90];
area["name"="Wolfsburg"]["admin_level"="6"]->.wolfsburg;
(
  rel(area.wolfsburg)["boundary"="administrative"]["admin_level"~"^(8|9|10)$"];
);
out geom;
`

  let data
  try {
    data = await fetchOverpass(query)
  } catch (e) {
    console.error('Overpass fetch failed:', e.message)
    process.exit(1)
  }

  console.log(`Got ${data.elements.length} relations from Overpass`)

  const result = {}
  const matched = new Set()
  const unmatched = []

  for (const rel of data.elements) {
    if (rel.type !== 'relation') continue
    const osmName = rel.tags?.name || ''
    const districtName = matchDistrict(osmName)

    if (!districtName) {
      unmatched.push(`${osmName} (admin_level=${rel.tags?.admin_level})`)
      continue
    }

    if (matched.has(districtName)) {
      console.log(`  Duplicate match for "${districtName}", skipping "${osmName}"`)
      continue
    }

    const geoJSON = relationToGeoJSON(rel)
    if (!geoJSON) {
      console.warn(`  Could not build geometry for "${districtName}"`)
      continue
    }

    result[districtName] = geoJSON
    matched.add(districtName)
    const coords = geoJSON.features[0].geometry.coordinates[0].length
    console.log(`  ✓ ${districtName} (${coords} coords)`)
  }

  // Report missing
  const missing = DISTRICT_NAMES.filter(n => !matched.has(n))
  if (missing.length) {
    console.warn('\nMissing districts (not found in OSM):')
    missing.forEach(n => console.warn('  -', n))
  }
  if (unmatched.length) {
    console.log('\nUnmatched OSM relations:')
    unmatched.forEach(n => console.log('  -', n))
  }

  // Load existing file and merge (keep old data for any still-missing districts)
  const outPath = path.join(__dirname, '../src/data/districtBoundaries.json')
  let existing = {}
  try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) } catch (_) {}

  const merged = { ...existing, ...result }

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2))
  console.log(`\nWrote ${Object.keys(merged).length} districts to ${outPath}`)
  console.log(`  Fresh from OSM: ${matched.size} | Kept from existing: ${missing.length}`)
}

main()
