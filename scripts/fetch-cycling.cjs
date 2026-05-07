/**
 * Fetches cycling infrastructure (dedicated lanes, tracks, cycleways) from Overpass
 * and saves to public/wolfsburg_cycling.geojson.
 */
const https        = require('https')
const fs           = require('fs')
const path         = require('path')
const osmtogeojson = require('osmtogeojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX         = '52.35,10.67,52.50,10.90'

const QUERY = `[out:json][bbox:${BBOX}];
(
  way[highway=cycleway];
  way[cycleway~"lane|track|opposite_lane|opposite_track"];
  way[bicycle=designated][highway~"path|footway|track"];
);
out geom;`

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
  console.log('Fetching cycling infrastructure…')
  const raw     = await post(OVERPASS_URL, QUERY)
  const osm     = JSON.parse(raw)
  console.log(`  ${osm.elements.length} OSM elements`)

  const geojson = osmtogeojson(osm)
  geojson.features = geojson.features.filter(
    f => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  )
  console.log(`  ${geojson.features.length} line features`)

  const outPath = path.join(__dirname, '../public/wolfsburg_cycling.geojson')
  fs.writeFileSync(outPath, JSON.stringify(geojson))
  console.log(`Saved → ${outPath}`)
}

main().catch(console.error)
