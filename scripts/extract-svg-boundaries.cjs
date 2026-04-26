/**
 * Extracts district polygons from Wolfsburg_Gliederung.svg (Wikimedia Commons).
 *
 * SVG layer structure:
 *   path2402  – red filled Kernstadt polygon (the inner-city pink zone in the image)
 *   path4304  – eastern arc of the outer city boundary (267 pts)
 *   path4302  – western arc of the outer city boundary (159 pts)
 *   gray paths – internal sub-district dividers (not used here)
 *
 * Strategy:
 *   Stadtmitte  → path2402 geo-referenced (the actual Kernstadt polygon)
 *   Nordstadt   → northern slice of path4304 + north edge of path2402 closed into a polygon
 *   Mitte-West  → western slice of path4302 + west edge of path2402 closed into a polygon
 */
const https = require('https')
const fs    = require('fs')
const path  = require('path')

// ── Ground Control Points: [svgX, svgY, lng, lat] ─────────────────────────
const GCPs = [
  [186.57, 260.40, 10.7103, 52.4303],
  [625.15, 232.03, 10.8447, 52.4508],
  [284.26, 111.10, 10.8186, 52.4429],
  [406.34, 534.91, 10.7700, 52.3724],
  [242.80, 420.90, 10.7220, 52.3990],
  [624.00, 635.10, 10.8480, 52.3560],
  [530.72, 181.35, 10.8020, 52.4420],
  [518.05, 309.19, 10.7985, 52.4181],
  [413.25, 317.25, 10.7420, 52.4050],
  [631.52, 316.15, 10.8500, 52.4000],
]

function computeAffine(gcps) {
  let AtA = [[0,0,0],[0,0,0],[0,0,0]], Al = [0,0,0], Ab = [0,0,0]
  for (const [x, y, lng, lat] of gcps) {
    const r = [1, x, y]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) AtA[i][j] += r[i] * r[j]
      Al[i] += r[i] * lng
      Ab[i] += r[i] * lat
    }
  }
  function solve(M, b) {
    const A = M.map((r, i) => [...r, b[i]])
    for (let c = 0; c < 3; c++) {
      let mr = c
      for (let r = c+1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[mr][c])) mr = r
      ;[A[c], A[mr]] = [A[mr], A[c]]
      for (let r = c+1; r < 3; r++) {
        const f = A[r][c] / A[c][c]
        for (let cc = c; cc <= 3; cc++) A[r][cc] -= f * A[c][cc]
      }
    }
    const x = [0,0,0]
    for (let i = 2; i >= 0; i--) {
      x[i] = A[i][3]
      for (let j = i+1; j < 3; j++) x[i] -= A[i][j] * x[j]
      x[i] /= A[i][i]
    }
    return x
  }
  const [a0,a1,a2] = solve(AtA, Al)
  const [b0,b1,b2] = solve(AtA, Ab)
  return { a0, a1, a2, b0, b1, b2 }
}

function toGeo([x, y], tf) {
  return [tf.a0 + tf.a1*x + tf.a2*y, tf.b0 + tf.b1*x + tf.b2*y]
}

function parsePath(d) {
  const pts = []
  const tokens = d.replace(/([MLZmlz])/g, ' $1 ').trim().split(/[\s,]+/).filter(Boolean)
  let i = 0, cx = 0, cy = 0
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'M' || cmd === 'L') { cx = parseFloat(tokens[i++]); cy = parseFloat(tokens[i++]); pts.push([cx, cy]) }
    else if (cmd === 'm' || cmd === 'l') { cx += parseFloat(tokens[i++]); cy += parseFloat(tokens[i++]); pts.push([cx, cy]) }
  }
  return pts
}

function extractPathD(svg, id) {
  const tag = svg.match(new RegExp(`<path[^>]*id=["']${id}["'][^>]*/>`))
  if (!tag) return ''
  return (tag[0].match(/\bd=["']([^"']+)["']/) || [])[1] || ''
}

function makeFC(ring) {
  // Ensure ring is closed
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])
    ring = [...ring, ring[0]]
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wolfsburg-activity-map/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Downloading SVG…')
  const svg = await fetchUrl('https://upload.wikimedia.org/wikipedia/commons/9/93/Wolfsburg_Gliederung.svg')

  const tf = computeAffine(GCPs)

  // ── path2402: Kernstadt → Stadtmitte ─────────────────────────────────────
  const kPts = parsePath(extractPathD(svg, 'path2402'))
  const kernstadtGeo = kPts.map(p => toGeo(p, tf))
  console.log(`Kernstadt: ${kPts.length} pts, lng ${Math.min(...kernstadtGeo.map(p=>p[0])).toFixed(3)}–${Math.max(...kernstadtGeo.map(p=>p[0])).toFixed(3)}, lat ${Math.min(...kernstadtGeo.map(p=>p[1])).toFixed(3)}–${Math.max(...kernstadtGeo.map(p=>p[1])).toFixed(3)}`)

  // ── path4304 (eastern arc) ────────────────────────────────────────────────
  const p4304 = parsePath(extractPathD(svg, 'path4304')).map(p => toGeo(p, tf))
  console.log(`path4304: ${p4304.length} pts, lat ${Math.min(...p4304.map(p=>p[1])).toFixed(3)}–${Math.max(...p4304.map(p=>p[1])).toFixed(3)}`)

  // ── path4302 (western arc) ────────────────────────────────────────────────
  const p4302 = parsePath(extractPathD(svg, 'path4302')).map(p => toGeo(p, tf))
  console.log(`path4302: ${p4302.length} pts, lat ${Math.min(...p4302.map(p=>p[1])).toFixed(3)}–${Math.max(...p4302.map(p=>p[1])).toFixed(3)}`)

  // ── Nordstadt ─────────────────────────────────────────────────────────────
  // Southern boundary: path37318 — the actual gray dividing line between
  // Stadtmitte and Nordstadt (lat 52.403–52.421, lng 10.779–10.809).
  const p37318 = parsePath(extractPathD(svg, 'path37318')).map(p => toGeo(p, tf))
  // Northern boundary: outer city arc (path4304) restricted to Nordstadt's
  // lng range so it doesn't bleed into Kästorf-Sandkamp (lng < 10.815).
  const nordArc = p4304.filter(p => p[1] > 52.422 && p[0] > 10.770 && p[0] < 10.815)
  // Assemble: southern divider E→W, then north arc W→E, close ring
  const p37reversed = [...p37318].reverse()
  const nordRing = [...p37reversed, ...nordArc, p37reversed[0]]
  console.log(`Nordstadt ring: ${nordRing.length} pts, lat ${Math.min(...nordRing.map(p=>p[1])).toFixed(3)}–${Math.max(...nordRing.map(p=>p[1])).toFixed(3)}, lng ${Math.min(...nordRing.map(p=>p[0])).toFixed(3)}–${Math.max(...nordRing.map(p=>p[0])).toFixed(3)}`)

  // ── Mitte-West: western arc of p4302 + west edge of Kernstadt ─────────────
  // Mitte-West = Westhagen/Detmerode area: lat 52.388–52.420, lng 10.712–10.760
  const mwArc = p4302.filter(p => p[1] > 52.388 && p[1] < 52.422 && p[0] < 10.763)
  const kLngMin = Math.min(...kernstadtGeo.map(p => p[0]))
  const kLngMax = Math.max(...kernstadtGeo.map(p => p[0]))
  const kWestEdge = kernstadtGeo
    .filter(p => p[0] < kLngMin + (kLngMax - kLngMin) * 0.22)
    .sort((a, b) => a[1] - b[1])
  const mwRing = [...mwArc, ...[...kWestEdge].reverse(), mwArc[0]]
  console.log(`Mitte-West ring: ${mwRing.length} pts, lat ${Math.min(...mwRing.map(p=>p[1])).toFixed(3)}–${Math.max(...mwRing.map(p=>p[1])).toFixed(3)}, lng ${Math.min(...mwRing.map(p=>p[0])).toFixed(3)}–${Math.max(...mwRing.map(p=>p[0])).toFixed(3)}`)

  // ── Write output ──────────────────────────────────────────────────────────
  const outPath = path.join(__dirname, '../src/data/districtBoundaries.json')
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))

  existing['Stadtmitte'] = makeFC(kernstadtGeo)
  existing['Nordstadt']  = makeFC(nordRing)
  existing['Mitte-West'] = makeFC(mwRing)

  fs.writeFileSync(outPath, JSON.stringify(existing))
  console.log('\nSaved', outPath)
  console.log('Stadtmitte sample:', kernstadtGeo.slice(0,3).map(p=>p.map(v=>v.toFixed(4)).join(',')).join(' | '))
  console.log('Nordstadt sample:', nordRing.slice(0,3).map(p=>p.map(v=>v.toFixed(4)).join(',')).join(' | '))
  console.log('Mitte-West sample:', mwRing.slice(0,3).map(p=>p.map(v=>v.toFixed(4)).join(',')).join(' | '))
}

main().catch(console.error)
