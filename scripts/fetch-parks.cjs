/**
 * Fetches parks (leisure=park, landuse=park/recreation_ground) within
 * Wolfsburg's bounding box from the Overpass API and saves them as GeoJSON.
 */
const https        = require('https')
const fs           = require('fs')
const path         = require('path')
const osmtogeojson = require('osmtogeojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Wolfsburg bounding box: S, W, N, E
const BBOX = '52.35,10.67,52.50,10.90'

const QUERY = `[out:json][bbox:${BBOX}];(way[leisure=park];relation[leisure=park];way[landuse=park];relation[landuse=park];way[landuse=recreation_ground];relation[landuse=recreation_ground];);out geom;`

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

async function main() {
  console.log('Fetching parks from Overpass API…')
  const raw  = await post(OVERPASS_URL, QUERY)
  const osm  = JSON.parse(raw)
  console.log(`Got ${osm.elements.length} OSM elements`)

  const geojson = osmtogeojson(osm)
  // Keep only Polygon / MultiPolygon features
  geojson.features = geojson.features.filter(
    f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )
  console.log(`${geojson.features.length} park polygons`)

  const outPath = path.join(__dirname, '../src/data/parks.json')
  fs.writeFileSync(outPath, JSON.stringify(geojson))
  console.log('Saved', outPath)
}

main().catch(console.error)
