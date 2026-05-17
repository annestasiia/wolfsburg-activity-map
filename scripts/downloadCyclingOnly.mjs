import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.32,10.57,52.60,10.98'

async function overpassFetch(query) {
  const body = new URLSearchParams({ data: query })
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WolfsburgMapTool/1.0', 'Accept': 'application/json' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function toLineGJ(elements) {
  return {
    type: 'FeatureCollection',
    features: elements
      .filter(el => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2)
      .map(el => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: el.geometry.map(p => [p.lon, p.lat]) },
        properties: { _id: el.id, ...el.tags },
      })),
  }
}

console.log('[Cycling] Downloading OSM cycling routes for Wolfsburg...')
console.log('  BBOX:', BBOX)

const data = await overpassFetch(`[out:json][timeout:60];(
  way["highway"="cycleway"](${BBOX});
  way["cycleway"~"lane|track|shared_lane|opposite_lane|opposite_track"](${BBOX});
  way["cycleway:right"~"lane|track"](${BBOX});
  way["cycleway:left"~"lane|track"](${BBOX});
  way["cycleway:both"~"lane|track"](${BBOX});
  way["bicycle"="designated"]["highway"~"path|track|footway"](${BBOX});
  way["bicycle"="yes"]["highway"~"path|track"](${BBOX});
  way["highway"~"path|track"]["bicycle"~"yes|designated|permissive"](${BBOX});
);out geom;`)

const gj = toLineGJ(data.elements)

// Stats
const byType = {}
gj.features.forEach(f => {
  const hw = f.properties.highway || 'other'
  byType[hw] = (byType[hw] || 0) + 1
})

// Total length
let totalKm = 0
gj.features.forEach(f => {
  const coords = f.geometry.coordinates
  for (let i = 1; i < coords.length; i++) {
    const [x1,y1] = coords[i-1], [x2,y2] = coords[i]
    const dlat = (y2-y1)*111320, dlng = (x2-x1)*111320*Math.cos(y1*Math.PI/180)
    totalKm += Math.sqrt(dlat*dlat+dlng*dlng)/1000
  }
})

writeFileSync(join(PUBLIC, 'wolfsburg_cycling.geojson'), JSON.stringify(gj))
console.log(`  ✓ wolfsburg_cycling.geojson: ${gj.features.length} features, ~${Math.round(totalKm)} km`)
console.log('  By type:', JSON.stringify(byType))
console.log('  Note: Official Wolfsburg city data (WFS) is not publicly accessible.')
console.log('  This uses OpenStreetMap data, which is well-maintained for cycling in Germany.')
