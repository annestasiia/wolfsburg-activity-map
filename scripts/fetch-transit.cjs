/**
 * Fetches public transit data (bus/tram stops + route lines) from Overpass
 * and saves to public/wolfsburg_transit.geojson.
 * Features are tagged with mode: 'stop' or 'route'.
 */
const https        = require('https')
const fs           = require('fs')
const path         = require('path')
const osmtogeojson = require('osmtogeojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BBOX         = '52.35,10.67,52.50,10.90'

const STOPS_QUERY = `[out:json][bbox:${BBOX}];
(
  node[highway=bus_stop];
  node[public_transport~"stop_position|platform"];
  node[railway~"tram_stop|stop"];
);
out geom;`

const ROUTES_QUERY = `[out:json][bbox:${BBOX}];
(
  relation[route~"bus|tram"];
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('Fetching transit stops…')
  const stopsRaw = await post(OVERPASS_URL, STOPS_QUERY)
  const stopsOsm = JSON.parse(stopsRaw)
  console.log(`  ${stopsOsm.elements.length} stop elements`)

  const stopsGeo = osmtogeojson(stopsOsm)
  const stops = stopsGeo.features.filter(f => f.geometry?.type === 'Point')
  stops.forEach(f => { f.properties.transitMode = 'stop' })
  console.log(`  ${stops.length} stop points`)

  await sleep(1500)

  console.log('Fetching transit routes…')
  const routesRaw = await post(OVERPASS_URL, ROUTES_QUERY)
  const routesOsm = JSON.parse(routesRaw)
  console.log(`  ${routesOsm.elements.length} route elements`)

  const routesGeo = osmtogeojson(routesOsm)
  const routes = routesGeo.features.filter(
    f => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  )
  routes.forEach(f => { f.properties.transitMode = 'route' })
  console.log(`  ${routes.length} route lines`)

  const merged = { type: 'FeatureCollection', features: [...stops, ...routes] }
  const outPath = path.join(__dirname, '../public/wolfsburg_transit.geojson')
  fs.writeFileSync(outPath, JSON.stringify(merged))
  console.log(`Saved ${merged.features.length} features → ${outPath}`)
}

main().catch(console.error)
