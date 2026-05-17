// One-time download script: saves OSM data as local GeoJSON files
// Run: node scripts/downloadWolfsburgData.mjs

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

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Converters ────────────────────────────────────────────────────────────────

function toPointGJ(elements) {
  return {
    type: 'FeatureCollection',
    features: elements.filter(el => (el.lat ?? el.center?.lat) != null).map(el => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [el.lon ?? el.center.lon, el.lat ?? el.center.lat] },
      properties: { _id: el.id, _type: el.type, ...el.tags },
    })),
  }
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

function toLineGJ(elements) {
  return {
    type: 'FeatureCollection',
    features: elements.filter(el => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2).map(el => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: el.geometry.map(p => [p.lon, p.lat]) },
      properties: { _id: el.id, ...el.tags },
    })),
  }
}

// ── Download tasks ────────────────────────────────────────────────────────────

async function save(filename, gj) {
  writeFileSync(join(PUBLIC, filename), JSON.stringify(gj))
  console.log(`  ✓ ${filename}: ${gj.features.length} features`)
}

async function downloadBusStops() {
  console.log('\n[1/6] Bus stops')
  const data = await overpassFetch(`[out:json][timeout:30];node["highway"="bus_stop"](${BBOX});out body;`)
  await save('wolfsburg_bus_stops.geojson', toPointGJ(data.elements))
}

async function downloadCarParking() {
  console.log('\n[2/6] Car parking')
  const data = await overpassFetch(`[out:json][timeout:30];(
    node["amenity"="parking"]["access"!="private"](${BBOX});
    way["amenity"="parking"]["access"!="private"](${BBOX});
  );out center;`)
  await save('wolfsburg_car_parking.geojson', toPointGJ(data.elements))
}

async function downloadBikeParking() {
  console.log('\n[3/6] Bike parking')
  const data = await overpassFetch(`[out:json][timeout:30];node["amenity"="bicycle_parking"](${BBOX});out body;`)
  await save('wolfsburg_bike_parking.geojson', toPointGJ(data.elements))
}

async function downloadFacilities() {
  console.log('\n[4/6] Facilities')
  const data = await overpassFetch(`[out:json][timeout:90];(
    node["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre|social_centre|marketplace"](${BBOX});
    way["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre|social_centre"](${BBOX});
    node["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium|ice_rink"](${BBOX});
    way["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium"](${BBOX});
    node["shop"~"supermarket|grocery|convenience|bakery|butcher|hardware|electronics|department_store|mall"](${BBOX});
    way["shop"~"supermarket|grocery|convenience|department_store|mall"](${BBOX});
    node["amenity"~"school|university|college|kindergarten"](${BBOX});
    way["amenity"~"school|university|college|kindergarten"](${BBOX});
    node["amenity"~"hospital|clinic|doctors|dentist|pharmacy|health_post"](${BBOX});
    way["amenity"~"hospital|clinic|pharmacy"](${BBOX});
    node["amenity"~"fuel|bank|post_office"](${BBOX});
  );out center;`)
  await save('wolfsburg_facilities.geojson', toPointGJ(data.elements))
}

async function downloadHistoric() {
  console.log('\n[5/6] Historic amenities')
  const data = await overpassFetch(`[out:json][timeout:60];(
    node["historic"](${BBOX});
    way["historic"](${BBOX});
    node["tourism"~"museum|gallery|artwork|castle|ruins|heritage"](${BBOX});
    way["tourism"~"museum|gallery|artwork|castle|ruins"](${BBOX});
  );out center;`)
  await save('wolfsburg_historic.geojson', toPointGJ(data.elements))
}

async function downloadParksForests() {
  console.log('\n[6/7] Parks & Forests')
  const data = await overpassFetch(`[out:json][timeout:90];(
    way["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
    relation["leisure"~"park|recreation_ground|garden|nature_reserve"](${BBOX});
    way["landuse"~"forest|grass|meadow"](${BBOX});
    way["natural"~"wood|scrub|grassland|heath"](${BBOX});
  );out geom;`)
  await save('wolfsburg_parks_forests.geojson', toPolygonGJ(data.elements))
}

async function downloadCycling() {
  console.log('\n[7/7] Cycling routes & infrastructure')
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
  await save('wolfsburg_cycling.geojson', toLineGJ(data.elements))
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('=== Wolfsburg GeoJSON data download ===')
console.log(`Saving to: ${PUBLIC}`)

try {
  await downloadBusStops();     await delay(4000)
  await downloadCarParking();   await delay(4000)
  await downloadBikeParking();  await delay(4000)
  await downloadFacilities();   await delay(6000)
  await downloadHistoric();     await delay(4000)
  await downloadParksForests(); await delay(6000)
  await downloadCycling();
  console.log('\n=== All downloads complete ===')
} catch (err) {
  console.error('\nDownload failed:', err.message)
  process.exit(1)
}
