/**
 * Reprojects wolfsburg cycling network from EPSG:25832 (UTM Zone 32N)
 * to WGS84 (EPSG:4326) using the Snyder inverse Transverse Mercator formula.
 * Input:  cycle paths/radwege.json   (full-precision UTM coords from municipality)
 * Output: public/wolfsburg_cycling_wb.geojson
 */
const fs   = require('fs')
const path = require('path')

// --- UTM Zone 32N → WGS84 (ETRS89 ≈ WGS84 for practical purposes) -----------
const a   = 6378137.0
const f   = 1 / 298.257222101
const b   = a * (1 - f)
const e2  = 2 * f - f * f
const ep2 = e2 / (1 - e2)
const k0  = 0.9996
const E0  = 500000
const N0  = 0
const lam0 = 9 * Math.PI / 180   // central meridian Zone 32

function utmToWgs84(E, N) {
  const x = E - E0
  const y = N - N0

  const M  = y / k0
  const mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))

  const phi1 = mu
    + (3*e1/2    - 27*e1**3/32)  * Math.sin(2*mu)
    + (21*e1**2/16 - 55*e1**4/32) * Math.sin(4*mu)
    + (151*e1**3/96)              * Math.sin(6*mu)
    + (1097*e1**4/512)            * Math.sin(8*mu)

  const sinPhi1  = Math.sin(phi1)
  const cosPhi1  = Math.cos(phi1)
  const tanPhi1  = sinPhi1 / cosPhi1
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1**2)
  const T1 = tanPhi1**2
  const C1 = ep2 * cosPhi1**2
  const R1 = a * (1 - e2) / (1 - e2 * sinPhi1**2)**1.5
  const D  = x / (N1 * k0)

  const lat = phi1 - (N1 * tanPhi1 / R1) * (
      D**2/2
    - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*ep2)           * D**4/24
    + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*ep2 - 3*C1**2) * D**6/720
  )

  const lon = lam0 + (
      D
    - (1 + 2*T1 + C1)                                       * D**3/6
    + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*ep2 + 24*T1**2)      * D**5/120
  ) / cosPhi1

  return [+(lon * 180 / Math.PI).toFixed(7), +(lat * 180 / Math.PI).toFixed(7)]
}

function reprojectCoords(coords) {
  if (!Array.isArray(coords)) return coords
  if (typeof coords[0] === 'number') return utmToWgs84(coords[0], coords[1])
  return coords.map(reprojectCoords)
}

// --- Main --------------------------------------------------------------------
const inPath  = path.join(__dirname, '../cycle paths/radwege.json')
const outPath = path.join(__dirname, '../public/wolfsburg_cycling_wb.geojson')

const geojson = JSON.parse(fs.readFileSync(inPath, 'utf8'))

for (const f of geojson.features) {
  if (f.geometry?.coordinates) {
    f.geometry.coordinates = reprojectCoords(f.geometry.coordinates)
  }
}

// Strip non-standard CRS property so MapLibre doesn't complain
delete geojson.crs

const typCounts = {}
for (const f of geojson.features) {
  const t = f.properties?.typ || '(none)'
  typCounts[t] = (typCounts[t] || 0) + 1
}

console.log(`Reprojected ${geojson.features.length} features from EPSG:25832 → WGS84`)
console.log('typ breakdown:')
for (const [t, n] of Object.entries(typCounts).sort(([,a],[,b]) => b - a))
  console.log(`  ${String(n).padStart(4)}  ${t}`)

fs.writeFileSync(outPath, JSON.stringify(geojson))
console.log(`Saved → ${outPath}`)
