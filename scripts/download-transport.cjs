/**
 * Downloads roads and footways GeoJSON from the reference app into public/.
 */
const https = require('https')
const fs    = require('fs')
const path  = require('path')

const FILES = [
  {
    url: 'https://annestasiia.github.io/wolfsburg-activity-map/wolfsburg_roads.geojson',
    out: 'wolfsburg_roads.geojson',
  },
  {
    url: 'https://annestasiia.github.io/wolfsburg-activity-map/wolfsburg_footways.geojson',
    out: 'wolfsburg_footways.geojson',
  },
]

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wolfsburg-activity-map/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function main() {
  const outDir = path.join(__dirname, '../public')
  for (const { url, out } of FILES) {
    console.log(`Downloading ${out}…`)
    const buf = await get(url)
    const outPath = path.join(outDir, out)
    fs.writeFileSync(outPath, buf)
    console.log(`  Saved ${(buf.length / 1024).toFixed(0)} KB → ${outPath}`)
  }
}

main().catch(console.error)
