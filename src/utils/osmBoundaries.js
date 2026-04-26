import osmtogeojson from 'osmtogeojson'

const CACHE_PREFIX = 'wolfsburg_boundary_v2_'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const TIMEOUT_MS   = 15000

const OVERPASS_QUERIES = {
  'Stadtmitte':          '[out:json];relation(288449);(._;>;);out body;',
  'Mitte-West':          '[out:json];relation(11042427);(._;>;);out body;',
  'Kästorf-Sandkamp':    '[out:json];relation(20064844);(._;>;);out body;',
  'Nordstadt':           '[out:json];relation(11680489);(._;>;);out body;',
  'Vorsfelde':           '[out:json];relation(19800466);(._;>;);out body;',
  'Neuhaus-Reislingen':  '[out:json];relation(20064820);(._;>;);out body;',
}

function loadCached(name) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + name)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCached(name, geojson) {
  try { localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(geojson)) } catch {}
}

async function fetchBoundary(name) {
  const cached = loadCached(name)
  if (cached) return cached

  const query = OVERPASS_QUERIES[name]
  if (!query) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`)

    const osmData = await resp.json()
    const raw     = osmtogeojson(osmData)

    // Keep only polygon/multipolygon features (the actual boundary rings)
    const geojson = {
      type: 'FeatureCollection',
      features: raw.features.filter(
        f => f.geometry &&
             (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      ),
    }

    if (geojson.features.length > 0) saveCached(name, geojson)
    return geojson
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export async function fetchAllBoundaries(onProgress) {
  const names      = Object.keys(OVERPASS_QUERIES)
  const boundaries = {}

  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    try {
      boundaries[name] = await fetchBoundary(name)
    } catch (err) {
      console.warn(`Boundary fetch failed for "${name}":`, err.message)
      boundaries[name] = null
    }
    onProgress?.({ current: i + 1, total: names.length })
    // Small delay between Overpass requests to be polite
    if (i < names.length - 1 && !loadCached(name)) await new Promise(r => setTimeout(r, 500))
  }

  return boundaries
}

export function clearBoundaryCache() {
  Object.keys(OVERPASS_QUERIES).forEach(name => {
    try { localStorage.removeItem(CACHE_PREFIX + name) } catch {}
  })
}

// ── Supplementary named-query fetch (out geom format) ───────────────────────
// Uses bbox-filtered named queries instead of relation IDs — works even when
// OSM relation IDs become stale. Returns a map of { name → FeatureCollection }.

const SUPPLEMENTARY_QUERIES = {
  'Stadtmitte': `
[out:json][timeout:30];
(
  relation["name"="Stadtmitte"]["place"~"suburb|neighbourhood|quarter"](52.35,10.60,52.55,10.95);
  relation["name"="Stadtmitte"]["boundary"~"suburb|administrative"](52.35,10.60,52.55,10.95);
);
out geom;
`,
  'Mitte-West': `
[out:json][timeout:30];
(
  relation["name"="Mitte-West"](52.35,10.60,52.55,10.95);
  way["name"="Mitte-West"](52.35,10.60,52.55,10.95);
);
out geom;
`,
}

function extractRingsFromGeom(element) {
  const rings = []
  if (element.type === 'relation') {
    const members = element.members || []
    let outer = members.filter(m => m.role === 'outer' && m.geometry)
    if (!outer.length) outer = members.filter(m => m.geometry)
    for (const member of outer) {
      const ring = member.geometry.map(pt => [pt.lon, pt.lat])
      if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push(ring[0])
      rings.push(ring)
    }
  } else if (element.type === 'way' && element.geometry) {
    const ring = element.geometry.map(pt => [pt.lon, pt.lat])
    if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push(ring[0])
    rings.push(ring)
  }
  return rings.length ? rings : null
}

export async function loadMissingDistricts() {
  const results = {}
  for (const [name, query] of Object.entries(SUPPLEMENTARY_QUERIES)) {
    const cacheKey = `${CACHE_PREFIX}geom_${name}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        results[name] = JSON.parse(cached)
        console.log(`[boundary] "${name}" loaded from supplementary cache`)
        continue
      }
    } catch {}

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      const resp = await fetch(OVERPASS_URL, {
        method:  'POST',
        body:    new URLSearchParams({ data: query }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal:  controller.signal,
      })
      clearTimeout(timer)
      if (!resp.ok) continue

      const data = await resp.json()
      for (const el of data.elements || []) {
        const rings = extractRingsFromGeom(el)
        if (rings) {
          const geojson = {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { name },
              geometry: { type: 'MultiPolygon', coordinates: rings.map(r => [r]) },
            }],
          }
          try { localStorage.setItem(cacheKey, JSON.stringify(geojson)) } catch {}
          results[name] = geojson
          console.log(`[boundary] "${name}" fetched via named geom query (${rings.length} ring(s))`)
          break
        }
      }
    } catch (err) {
      console.warn(`[boundary] loadMissingDistricts failed for "${name}":`, err.message)
    }
  }
  return results
}
