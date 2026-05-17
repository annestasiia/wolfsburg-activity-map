import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.32,10.57,52.60,10.98'

async function overpassFetch(query) {
  console.log('  → querying Overpass…')
  const body = new URLSearchParams({ data: query })
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'WolfsburgMapTool/1.0',
      'Accept': 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

function toPolygonGJ(elements) {
  const features = []
  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [el.geometry.map(p => [p.lon, p.lat])] },
        properties: { _id: el.id, ...el.tags },
      })
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      for (const m of el.members) {
        if (m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry) && m.geometry.length >= 4) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [m.geometry.map(p => [p.lon, p.lat])] },
            properties: { _id: el.id, ...el.tags },
          })
        }
      }
    }
  }
  return { type: 'FeatureCollection', features }
}

console.log('[Parks & Forests] Waiting 15s for rate limit reset…')
await new Promise(r => setTimeout(r, 15000))

console.log('[Parks & Forests] Querying…')
const data = await overpassFetch(`[out:json][timeout:90];(
  way["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
  relation["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
  way["landuse"~"forest|grass|meadow"](${BBOX});
  way["natural"~"wood|scrub|grassland|heath"](${BBOX});
);out geom;`)

const gj = toPolygonGJ(data.elements)
writeFileSync(join(PUBLIC, 'wolfsburg_parks_forests.geojson'), JSON.stringify(gj))
console.log(`  ✓ wolfsburg_parks_forests.geojson: ${gj.features.length} features`)
