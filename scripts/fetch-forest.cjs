const https        = require('https')
const fs           = require('fs')
const path         = require('path')
const osmtogeojson = require('osmtogeojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.35,10.67,52.50,10.90'

const QUERY = `[out:json][bbox:${BBOX}];(way[landuse=forest];relation[landuse=forest];way[natural=wood];relation[natural=wood];);out geom;`

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
  console.log('Fetching forest/woodland from Overpass API…')
  const raw  = await post(OVERPASS_URL, QUERY)
  const osm  = JSON.parse(raw)
  console.log(`Got ${osm.elements.length} OSM elements`)

  const geojson = osmtogeojson(osm)
  geojson.features = geojson.features.filter(
    f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )
  console.log(`${geojson.features.length} forest polygons`)

  const outPath = path.join(__dirname, '../src/data/forest.json')
  fs.writeFileSync(outPath, JSON.stringify(geojson))
  console.log('Saved', outPath)
}

main().catch(console.error)
