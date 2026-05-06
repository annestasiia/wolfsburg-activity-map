/**
 * Fetches facility building footprints from OSM within Wolfsburg's bounding box,
 * tags each polygon with its facility category, and saves to src/data/buildings.json.
 */
const https        = require('https')
const fs           = require('fs')
const path         = require('path')
const osmtogeojson = require('osmtogeojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX         = '52.35,10.67,52.50,10.90'

const CATEGORY_QUERIES = [
  {
    category: 'Schools',
    tags: [
      'way[amenity=school]', 'way[amenity=kindergarten]',
      'way[amenity=university]', 'way[amenity=college]',
      'relation[amenity=school]', 'relation[amenity=kindergarten]',
      'relation[amenity=university]', 'relation[amenity=college]',
    ],
  },
  {
    category: 'Culture',
    tags: [
      'way[amenity=arts_centre]', 'way[amenity=theatre]', 'way[amenity=cinema]',
      'way[amenity=library]', 'way[amenity=community_centre]', 'way[amenity=museum]',
      'way[tourism=museum]', 'way[amenity=gallery]',
      'relation[amenity=arts_centre]', 'relation[amenity=theatre]', 'relation[amenity=cinema]',
      'relation[amenity=library]', 'relation[amenity=community_centre]', 'relation[amenity=museum]',
      'relation[tourism=museum]',
    ],
  },
  {
    category: 'Leisure',
    tags: [
      'way[leisure=sports_centre]', 'way[leisure=fitness_centre]', 'way[leisure=swimming_pool]',
      'way[leisure=stadium]', 'way[leisure=golf_course]', 'way[leisure=bowling_alley]',
      'way[amenity=restaurant]', 'way[amenity=cafe]', 'way[amenity=bar]',
      'way[amenity=pub]', 'way[amenity=fast_food]', 'way[amenity=ice_cream]',
      'way[leisure=water_park]',
      'relation[leisure=sports_centre]', 'relation[leisure=stadium]', 'relation[leisure=swimming_pool]',
    ],
  },
  {
    category: 'Commercial',
    tags: [
      'way[shop]', 'way[amenity=bank]', 'way[amenity=marketplace]',
      'way[landuse=retail]', 'way[landuse=commercial]',
      'way[building=commercial]', 'way[building=retail]', 'way[building=supermarket]',
      'relation[shop]', 'relation[landuse=retail]', 'relation[landuse=commercial]',
    ],
  },
]

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = 'data=' + encodeURIComponent(body)
    const opts = {
      method: 'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent':     'wolfsburg-activity-map/1.0',
      },
    }
    const req = https.request(url, opts, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCategory({ category, tags }) {
  const query = `[out:json][bbox:${BBOX}];(${tags.join(';')};);out geom;`
  console.log(`Fetching ${category}…`)
  const raw  = await post(OVERPASS_URL, query)
  const osm  = JSON.parse(raw)
  console.log(`  ${osm.elements.length} OSM elements for ${category}`)

  const geojson = osmtogeojson(osm)
  const polygons = geojson.features.filter(
    f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )
  polygons.forEach(f => { f.properties.category = category })
  console.log(`  ${polygons.length} polygons for ${category}`)
  return polygons
}

async function main() {
  const allFeatures = []
  const seenIds = new Set()

  for (const cq of CATEGORY_QUERIES) {
    const features = await fetchCategory(cq)
    for (const f of features) {
      const id = f.id || f.properties?.['@id']
      if (id && seenIds.has(id)) continue
      if (id) seenIds.add(id)
      allFeatures.push(f)
    }
    await sleep(1000)
  }

  const geojson = { type: 'FeatureCollection', features: allFeatures }
  const outPath = path.join(__dirname, '../src/data/buildings.json')
  fs.writeFileSync(outPath, JSON.stringify(geojson))
  console.log(`\nSaved ${allFeatures.length} building polygons to ${outPath}`)
}

main().catch(console.error)
