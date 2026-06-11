/**
 * Downloads the official Wolfsburg cycling network from the city's WFS GeoServer
 * and saves to public/wolfsburg_cycling_wb.geojson.
 *
 * Source: Stadt Wolfsburg GDI — inspire_radwege:radwege
 */
const https = require('https')
const fs    = require('fs')
const path  = require('path')

const WFS_URL =
  'https://gdiservices.stadt.wolfsburg.de/geoserver/inspire_radwege/wfs' +
  '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature' +
  '&typeNames=inspire_radwege:radwege&outputFormat=json&srsName=EPSG:4326'

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wolfsburg-activity-map/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Fetching official Wolfsburg cycling network from WFS…')
  const raw     = await get(WFS_URL)
  const geojson = JSON.parse(raw)

  geojson.features = (geojson.features || []).filter(
    f => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  )

  console.log(`  ${geojson.features.length} line features`)

  const typCounts = {}
  for (const f of geojson.features) {
    const t = f.properties?.typ || '(none)'
    typCounts[t] = (typCounts[t] || 0) + 1
  }
  console.log('  typ breakdown:')
  for (const [t, n] of Object.entries(typCounts).sort(([,a],[,b]) => b - a)) {
    console.log(`    ${n.toString().padStart(4)}  ${t}`)
  }

  const outPath = path.join(__dirname, '../public/wolfsburg_cycling_wb.geojson')
  fs.writeFileSync(outPath, JSON.stringify(geojson))
  console.log(`Saved → ${outPath}`)
}

main().catch(console.error)
