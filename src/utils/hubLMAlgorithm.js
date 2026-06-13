// Hub L / Hub M placement algorithm
// Hub L = multi-storey car parks  (fleet depot + charging)
// Hub M = underground car parks   (shuttle / pod / e-bike node)
// Uses localCarParkings GeoJSON already loaded in the store.

import { haversineM } from './intermodalAlgorithm'

// ── Geometry helpers ──────────────────────────────────────────────────────────

function ringCentroid(ring) {
  let x = 0, y = 0
  for (const [lon, lat] of ring) { x += lon; y += lat }
  return { lon: x / ring.length, lat: y / ring.length }
}

function polygonAreaM2(coordinates) {
  const ring = coordinates[0]
  if (!ring || ring.length < 3) return 0
  const c = ringCentroid(ring)
  const mLat = 111320
  const mLon = 111320 * Math.cos(c.lat * Math.PI / 180)
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = (ring[i][0]   - c.lon) * mLon
    const y1 = (ring[i][1]   - c.lat) * mLat
    const x2 = (ring[i+1][0] - c.lon) * mLon
    const y2 = (ring[i+1][1] - c.lat) * mLat
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

function featureCentroid(feature) {
  const g = feature.geometry
  if (!g) return null
  if (g.type === 'Point') return { lat: g.coordinates[1], lon: g.coordinates[0] }
  const ring = g.type === 'Polygon'      ? g.coordinates[0]
             : g.type === 'MultiPolygon' ? g.coordinates[0][0]
             : null
  if (!ring) return null
  const c = ringCentroid(ring)
  return { lat: c.lat, lon: c.lon }
}

function featureAreaM2(feature) {
  const g = feature.geometry
  if (!g || g.type === 'Point') return 0
  if (g.type === 'Polygon')      return polygonAreaM2(g.coordinates)
  if (g.type === 'MultiPolygon') return g.coordinates.reduce((s, p) => s + polygonAreaM2(p), 0)
  return 0
}

// Check if point is inside a polygon ring (ray-casting)
function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function pointInDistrict(lon, lat, districtBoundaries) {
  for (const [, dist] of Object.entries(districtBoundaries)) {
    const geom = dist?.geometry
    if (!geom) continue
    const rings = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.type === 'MultiPolygon' ? geom.coordinates.map(p => p[0]) : []
    if (rings.some(r => pointInRing(lon, lat, r))) return true
  }
  return false
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreAreaFit(area, target) {
  if (area <= 0) return 0
  if (area >= target) return Math.max(0, 1 - ((area - target) / Math.max(target, 1)) * 0.4)
  return Math.max(0, 1 - (target - area) / Math.max(target, 1))
}

function scoreDistribution(lat, lon, selected, minDistM) {
  if (!selected.length) return 1
  const minD = Math.min(...selected.map(s => haversineM(lat, lon, s.lat, s.lon)))
  if (minD < minDistM) return 0
  return Math.min(1, minD / (minDistM * 2))
}

function scoreBuildingCoverage(lat, lon, buildings, alreadyCovered, radiusM) {
  if (!buildings?.features?.length) return 0
  let newCount = 0
  for (const f of buildings.features) {
    const [bLon, bLat] = f.geometry?.coordinates ?? [0, 0]
    const dist = haversineM(lat, lon, bLat, bLon)
    if (dist <= radiusM && !alreadyCovered.has(bLon + ',' + bLat)) newCount++
  }
  return Math.min(1, newCount / Math.max(1, buildings.features.length))
}

// ── Candidate extraction ──────────────────────────────────────────────────────

const PARKING_TYPES_L = ['multi-storey', 'multi_storey', 'garage', 'surface']
const PARKING_TYPES_M = ['underground', 'underpass']

function extractCandidates(parkingGeoJSON, types) {
  const candidates = []
  for (const f of parkingGeoJSON?.features ?? []) {
    const props = f.properties || {}
    const parkingTag = (props.parking || '').toLowerCase()
    const buildingTag = (props.building || '').toLowerCase()

    // Type match: explicit parking tag OR building tag fallback
    const typeMatch = types.some(t => parkingTag.includes(t))
    const buildingFallback = types.includes('garage') && ['garage', 'parking', 'yes'].includes(buildingTag)
    if (!typeMatch && !buildingFallback) continue

    const centroid = featureCentroid(f)
    if (!centroid) continue

    const area = featureAreaM2(f)
    candidates.push({
      ...centroid,
      area,
      name: props.name || props.ref || `Parking ${candidates.length + 1}`,
      properties: props,
      feature: f,
    })
  }
  return candidates
}

// ── Greedy selection ──────────────────────────────────────────────────────────

function greedySelect(candidates, requiredAreaM2, minDistM, buildings, coverageRadiusM) {
  if (!candidates.length) return { selected: [], totalArea: 0 }

  const remaining = [...candidates]
  const selected = []
  const covered = new Set()
  let totalArea = 0
  const targetPerHub = requiredAreaM2 / Math.max(1, Math.ceil(requiredAreaM2 / 1000))

  while (remaining.length > 0) {
    if (totalArea >= requiredAreaM2) break

    let best = null, bestScore = -1
    for (const c of remaining) {
      const distScore = scoreDistribution(c.lat, c.lon, selected, minDistM)
      if (distScore === 0) continue
      const areaScore  = scoreAreaFit(c.area, requiredAreaM2 - totalArea)
      const covScore   = scoreBuildingCoverage(c.lat, c.lon, buildings, covered, coverageRadiusM)
      const score = 0.45 * areaScore + 0.30 * distScore + 0.25 * covScore
      if (score > bestScore) { bestScore = score; best = c }
    }

    if (!best) break
    selected.push({ ...best, score: bestScore })
    totalArea += best.area

    // Mark covered buildings
    if (buildings?.features) {
      for (const f of buildings.features) {
        const [bLon, bLat] = f.geometry?.coordinates ?? [0, 0]
        if (haversineM(best.lat, best.lon, bLat, bLon) <= coverageRadiusM)
          covered.add(bLon + ',' + bLat)
      }
    }

    const idx = remaining.indexOf(best)
    if (idx >= 0) remaining.splice(idx, 1)
  }

  return { selected, totalArea }
}

// ── Coverage radius ───────────────────────────────────────────────────────────
const COVERAGE_RADIUS = { hub_l: 800, hub_m: 400, hub_s: 200 }

// ── Zone classification ───────────────────────────────────────────────────────
const CENTER_DISTRICT_NAMES = [
  'Stadtmitte', 'Schillerteich', 'Hellwinkel', 'Heßlingen', 'Rothenfelde',
  'Köhlerberg', 'Alt-Wolfsburg', 'Sandkamp', 'Hochenstein',
]

function classifyZone(lon, lat, districtBoundaries) {
  for (const name of CENTER_DISTRICT_NAMES) {
    const dist = districtBoundaries[name]
    if (!dist?.geometry) continue
    const geom = dist.geometry
    const rings = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.type === 'MultiPolygon' ? geom.coordinates.map(p => p[0]) : []
    if (rings.some(r => pointInRing(lon, lat, r))) return 'centre'
  }
  return 'outer'
}

// ── Coverage stats ────────────────────────────────────────────────────────────
function computeCoverageM2(selected, radiusM) {
  // Approximate (ignoring overlap) – sum of individual coverage circles
  return selected.length * Math.PI * radiusM * radiusM
}

function computeBuildingCoverage(selected, buildings, radiusM) {
  if (!buildings?.features?.length || !selected.length) return { count: 0, pct: 0 }
  const covered = new Set()
  for (const hub of selected) {
    for (const f of buildings.features) {
      const [bLon, bLat] = f.geometry?.coordinates ?? [0, 0]
      if (haversineM(hub.lat, hub.lon, bLat, bLon) <= radiusM)
        covered.add(bLon + ',' + bLat)
    }
  }
  const pct = (covered.size / buildings.features.length * 100).toFixed(1)
  return { count: covered.size, pct: Number(pct) }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runHubLMAlgorithm({ localCarParkings, buildings, districtBoundaries, hubLMConfig }) {
  const { requiredAreaL = 15233, requiredAreaM = 7002, minDistL = 800, minDistM = 500 } = hubLMConfig || {}

  // ── Hub L ─────────────────────────────────────────────────────────────────
  const candidatesL = extractCandidates(localCarParkings, PARKING_TYPES_L)
  const { selected: selL, totalArea: areaL } = greedySelect(candidatesL, requiredAreaL, minDistL, buildings, COVERAGE_RADIUS.hub_l)

  // ── Hub M ─────────────────────────────────────────────────────────────────
  const candidatesM = extractCandidates(localCarParkings, PARKING_TYPES_M)
  const { selected: selM, totalArea: areaM } = greedySelect(candidatesM, requiredAreaM, minDistM, buildings, COVERAGE_RADIUS.hub_m)

  // ── Zone classification ───────────────────────────────────────────────────
  const classifyAll = (arr) => arr.map(h => ({ ...h, zone: classifyZone(h.lon, h.lat, districtBoundaries) }))
  const hubL = classifyAll(selL)
  const hubM = classifyAll(selM)

  // ── Building coverage ─────────────────────────────────────────────────────
  const covL = computeBuildingCoverage(hubL, buildings, COVERAGE_RADIUS.hub_l)
  const covM = computeBuildingCoverage(hubM, buildings, COVERAGE_RADIUS.hub_m)

  return {
    hubL: {
      hubs: hubL,
      totalArea: areaL,
      centreArea: hubL.filter(h => h.zone === 'centre').reduce((s, h) => s + h.area, 0),
      outerArea:  hubL.filter(h => h.zone === 'outer').reduce((s, h) => s + h.area, 0),
      centreCount: hubL.filter(h => h.zone === 'centre').length,
      outerCount:  hubL.filter(h => h.zone === 'outer').length,
      coverageM2: computeCoverageM2(hubL, COVERAGE_RADIUS.hub_l),
      buildingCoverage: covL,
      candidateCount: candidatesL.length,
      requiredArea: requiredAreaL,
    },
    hubM: {
      hubs: hubM,
      totalArea: areaM,
      centreArea: hubM.filter(h => h.zone === 'centre').reduce((s, h) => s + h.area, 0),
      outerArea:  hubM.filter(h => h.zone === 'outer').reduce((s, h) => s + h.area, 0),
      centreCount: hubM.filter(h => h.zone === 'centre').length,
      outerCount:  hubM.filter(h => h.zone === 'outer').length,
      coverageM2: computeCoverageM2(hubM, COVERAGE_RADIUS.hub_m),
      buildingCoverage: covM,
      candidateCount: candidatesM.length,
      requiredArea: requiredAreaM,
    },
    COVERAGE_RADIUS,
  }
}
