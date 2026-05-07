/**
 * Enriches buildings.json with connectivity scores based on proximity to
 * each transport mode. Scores are 0-4 (one point per accessible mode).
 *
 * Thresholds (straight-line):
 *   cycling    200 m  – near a dedicated bike lane or cycleway
 *   pedestrian 150 m  – near a footway / pedestrian path
 *   roads      300 m  – near a primary/secondary/tertiary/residential road
 *   transit    400 m  – near a bus or tram stop
 */
const fs   = require('fs')
const path = require('path')

// ── Wolfsburg approx scale factors for fast distance (m) ─────────────────────
const LAT_M = 111000
const LNG_M = 67700  // 111000 * cos(52.4°)

function distM(lng1, lat1, lng2, lat2) {
  const dLat = (lat2 - lat1) * LAT_M
  const dLng = (lng2 - lng1) * LNG_M
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

// Collect every coordinate point from a GeoJSON FeatureCollection
function extractPoints(geojson, filter) {
  const pts = []
  for (const f of geojson.features) {
    if (filter && !filter(f)) continue
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Point') {
      pts.push(g.coordinates)
    } else if (g.type === 'LineString') {
      for (const c of g.coordinates) pts.push(c)
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) for (const c of line) pts.push(c)
    } else if (g.type === 'Polygon') {
      for (const ring of g.coordinates) for (const c of ring) pts.push(c)
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) for (const ring of poly) for (const c of ring) pts.push(c)
    }
  }
  return pts
}

// Build a simple grid index: key = "latBucket,lngBucket" → point[]
// bucketSize in degrees (0.004° ≈ 440m lat, 270m lng)
function buildGrid(pts, bucketSize = 0.004) {
  const grid = new Map()
  for (const [lng, lat] of pts) {
    const key = `${Math.floor(lat / bucketSize)},${Math.floor(lng / bucketSize)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push([lng, lat])
  }
  return { grid, bucketSize }
}

function isWithinRadius({ grid, bucketSize }, cLng, cLat, radiusM) {
  const latBuckets = Math.ceil(radiusM / (bucketSize * LAT_M)) + 1
  const lngBuckets = Math.ceil(radiusM / (bucketSize * LNG_M)) + 1
  const cLatB = Math.floor(cLat / bucketSize)
  const cLngB = Math.floor(cLng / bucketSize)

  for (let dlb = -latBuckets; dlb <= latBuckets; dlb++) {
    for (let dgb = -lngBuckets; dgb <= lngBuckets; dgb++) {
      const key = `${cLatB + dlb},${cLngB + dgb}`
      const cell = grid.get(key)
      if (!cell) continue
      for (const [lng, lat] of cell) {
        if (distM(cLng, cLat, lng, lat) <= radiusM) return true
      }
    }
  }
  return false
}

function polygonCentroid(feature) {
  const ring = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates[0][0]
  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat }
  return [sumLng / ring.length, sumLat / ring.length]
}

function load(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), 'utf8'))
}

async function main() {
  console.log('Loading data…')
  const buildings  = load('../src/data/buildings.json')
  const roads      = load('../public/wolfsburg_roads.geojson')
  const footways   = load('../public/wolfsburg_footways.geojson')
  const cycling    = load('../public/wolfsburg_cycling.geojson')
  const transit    = load('../public/wolfsburg_transit.geojson')

  console.log(`Buildings: ${buildings.features.length}`)
  console.log(`Roads:     ${roads.features.length}`)
  console.log(`Footways:  ${footways.features.length}`)
  console.log(`Cycling:   ${cycling.features.length}`)
  console.log(`Transit:   ${transit.features.length}`)

  console.log('\nBuilding spatial indices…')
  const roadGrid       = buildGrid(extractPoints(roads))
  const footwayGrid    = buildGrid(extractPoints(footways))
  const cyclingGrid    = buildGrid(extractPoints(cycling))
  const transitGrid    = buildGrid(extractPoints(transit, f => f.properties?.transitMode === 'stop'))

  console.log('Computing connectivity scores…')
  const t0 = Date.now()
  let scored = 0

  buildings.features = buildings.features.map(f => {
    const [cLng, cLat] = polygonCentroid(f)

    const bike  = isWithinRadius(cyclingGrid,  cLng, cLat, 200)
    const walk  = isWithinRadius(footwayGrid,  cLng, cLat, 150)
    const car   = isWithinRadius(roadGrid,     cLng, cLat, 300)
    const bus   = isWithinRadius(transitGrid,  cLng, cLat, 400)

    const score = (bike ? 1 : 0) + (walk ? 1 : 0) + (car ? 1 : 0) + (bus ? 1 : 0)
    if (score > 0) scored++

    return {
      ...f,
      properties: {
        ...f.properties,
        conn_bike:    bike  ? 1 : 0,
        conn_walk:    walk  ? 1 : 0,
        conn_car:     car   ? 1 : 0,
        conn_transit: bus   ? 1 : 0,
        connectivity_score: score,
      },
    }
  })

  console.log(`  Done in ${Date.now() - t0}ms — ${scored}/${buildings.features.length} buildings have at least 1 mode`)

  const outPath = path.join(__dirname, '../src/data/buildings.json')
  fs.writeFileSync(outPath, JSON.stringify(buildings))
  console.log(`\nSaved enriched buildings → ${outPath}`)
}

main().catch(console.error)
