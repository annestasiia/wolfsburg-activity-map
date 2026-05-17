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

function toPolygonGJ(elements) {
  const features = []
  for (const el of elements) {
    if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [el.geometry.map(p => [p.lon, p.lat])] },
        properties: { _id: el.id, _type: 'way', ...el.tags },
      })
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      for (const m of el.members) {
        if (m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry) && m.geometry.length >= 4) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [m.geometry.map(p => [p.lon, p.lat])] },
            properties: { _id: el.id, _type: 'relation', ...el.tags },
          })
        }
      }
    }
  }
  return { type: 'FeatureCollection', features }
}

// Extended query: original ways + relation-based forests (large multipolygon forests)
const QUERY = `[out:json][timeout:120];(
  way["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
  relation["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
  way["landuse"~"forest|grass|meadow"](${BBOX});
  way["natural"~"wood|scrub|grassland|heath"](${BBOX});
  relation["landuse"~"forest|wood"](${BBOX});
  relation["natural"~"wood|forest"](${BBOX});
);out geom;`

console.log('[Parks & Forests] Downloading with extended relation queries…')
console.log('  BBOX:', BBOX)

const raw = await overpassFetch(QUERY)
const gj = toPolygonGJ(raw.elements)

const byTag = {}
gj.features.forEach(f => {
  const tag = f.properties.landuse || f.properties.natural || f.properties.leisure || 'other'
  byTag[tag] = (byTag[tag] || 0) + 1
})

writeFileSync(join(PUBLIC, 'wolfsburg_parks_forests.geojson'), JSON.stringify(gj))
console.log(`  ✓ wolfsburg_parks_forests.geojson: ${gj.features.length} features`)
console.log('  By tag:', JSON.stringify(byTag))
