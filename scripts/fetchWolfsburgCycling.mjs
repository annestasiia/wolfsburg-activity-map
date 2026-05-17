// Fetch official Wolfsburg cycling route data from the city's geoviewer
// Uses WFS on the Fahrradstadtplan project

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

const BASE = 'https://geoviewer.stadt.wolfsburg.de/default/ows/projects/gpt/fahrradstadtplan'

async function wmsCapabilities() {
  const r = await fetch(`${BASE}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`, {
    headers: { 'User-Agent': 'WolfsburgMapTool/1.0', 'Accept': 'application/xml,*/*' }
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const xml = await r.text()
  // Extract all Layer Names
  const names = [...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m => m[1])
  const bbox  = xml.match(/<EX_GeographicBoundingBox>([\s\S]*?)<\/EX_GeographicBoundingBox>/)
  return { names, bbox: bbox ? bbox[1] : null, xml }
}

async function wfsGetFeature(typeName, bbox) {
  // Try WFS 2.0.0
  const url = `${BASE}?service=WFS&version=2.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&srsName=EPSG:4326`
  const r = await fetch(url, { headers: { 'User-Agent': 'WolfsburgMapTool/1.0', 'Accept': 'application/json,*/*' } })
  console.log(`  WFS 2.0.0 status: ${r.status}`)
  const text = await r.text()
  if (text.includes('ServiceException') || text.includes('ServiceNotSupported')) {
    console.log('  WFS not supported on this endpoint')
    return null
  }
  try { return JSON.parse(text) } catch { return null }
}

// Alternative: try the stadtplan project instead
async function tryAltEndpoints() {
  const endpoints = [
    'https://geoviewer.stadt.wolfsburg.de/default/ows/projects/gpt/stadtplan',
    'https://geoviewer.stadt.wolfsburg.de/default/ows/projects/allgemein/hintergrundkarten',
  ]
  for (const ep of endpoints) {
    try {
      const r = await fetch(`${ep}?service=WFS&version=2.0.0&request=GetCapabilities`, {
        headers: { 'User-Agent': 'WolfsburgMapTool/1.0' }
      })
      const t = await r.text()
      if (!t.includes('ServiceException')) {
        console.log(`WFS works at: ${ep}`)
        console.log(t.substring(0, 300))
        return ep
      }
    } catch (e) { /* skip */ }
  }
  return null
}

console.log('=== Wolfsburg City Cycling Data Fetch ===')
console.log('\n[1] WMS GetCapabilities — listing available layers...')
const { names, xml } = await wmsCapabilities()
const radLayers = names.filter(n => n.toLowerCase().includes('rad') || n.toLowerCase().includes('cycling') || n.toLowerCase().includes('fahrrad') || n.toLowerCase().includes('verkehr'))
console.log('  All layer names:', names.join(', '))
console.log('  Cycling-related layers:', radLayers.join(', '))

console.log('\n[2] Trying WFS GetFeature on main layer...')
const mainLayer = radLayers.find(n => n.includes('radwege_l')) || radLayers[0]
if (mainLayer) {
  const gj = await wfsGetFeature(mainLayer)
  if (gj && gj.features) {
    console.log(`  ✓ Got ${gj.features.length} features`)
    writeFileSync(join(PUBLIC, 'wolfsburg_cycling_official.geojson'), JSON.stringify(gj))
    console.log('  Saved: wolfsburg_cycling_official.geojson')
  }
}

console.log('\n[3] Trying alternative WFS endpoints...')
await tryAltEndpoints()

// Print WMS bounding box info
const bboxMatch = xml.match(/westBoundLongitude[^>]*>([^<]+)|eastBoundLongitude[^>]*>([^<]+)/g)
if (bboxMatch) console.log('\nBBOX info:', bboxMatch.join(' '))
