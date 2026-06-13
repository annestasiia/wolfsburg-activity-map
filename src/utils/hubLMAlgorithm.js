// Hub L / Hub M placement algorithm
// Hub L = multi-storey car parks  (fleet depot + charging)
// Hub M = underground car parks   (shuttle / pod / e-bike node)
// Data source: localCarParkings GeoJSON (all Points — areas are estimated from parking tag)

import { haversineM } from './intermodalAlgorithm'

// ── Default area estimates per parking tag (all features are Points in OSM export) ──
const TAG_AREA_M2 = {
  'multi-storey': 3500,
  'multi_storey': 3500,
  'underground':  1500,
  'underpass':    1200,
  'garage':        800,
  'surface':       600,
}

// ── Candidate extraction ──────────────────────────────────────────────────────

function extractCandidates(parkingGeoJSON, allowedTypes) {
  const candidates = []
  for (const f of parkingGeoJSON?.features ?? []) {
    const props = f.properties || {}
    const parkingTag = (props.parking || '').toLowerCase().trim()
    if (!allowedTypes.includes(parkingTag)) continue

    const g = f.geometry
    if (!g) continue

    let lat, lon
    if (g.type === 'Point') {
      lon = g.coordinates[0]
      lat = g.coordinates[1]
    } else {
      continue // skip non-points (shouldn't happen with this dataset)
    }

    const area = TAG_AREA_M2[parkingTag] || 500
    candidates.push({
      lat, lon,
      area,
      name: props.name || props.ref || `${parkingTag} parking`,
      parkingTag,
      properties: props,
    })
  }
  return candidates
}

// ── Distribution scoring ──────────────────────────────────────────────────────

function scoreDistribution(lat, lon, selected, minDistM) {
  if (!selected.length) return 1
  const minD = Math.min(...selected.map(s => haversineM(lat, lon, s.lat, s.lon)))
  if (minD < minDistM) return 0
  return Math.min(1, minD / (minDistM * 2))
}

// ── Greedy selection ──────────────────────────────────────────────────────────

function greedySelect(candidates, requiredAreaM2, minDistM, maxHubs = 12) {
  if (!candidates.length) return { selected: [], totalArea: 0 }

  const remaining = [...candidates]
  const selected = []
  let totalArea = 0

  while (remaining.length > 0 && selected.length < maxHubs) {
    if (totalArea >= requiredAreaM2) break

    let best = null, bestScore = -1
    for (const c of remaining) {
      const distScore = scoreDistribution(c.lat, c.lon, selected, minDistM)
      if (distScore === 0) continue
      // Prefer hubs that fill more of the remaining required area
      const remaining_area = Math.max(0, requiredAreaM2 - totalArea)
      const areaRatio = c.area / Math.max(c.area, remaining_area)
      const score = 0.5 * areaRatio + 0.5 * distScore
      if (score > bestScore) { bestScore = score; best = c }
    }

    if (!best) break
    selected.push({ ...best, score: bestScore })
    totalArea += best.area

    const idx = remaining.indexOf(best)
    if (idx >= 0) remaining.splice(idx, 1)
  }

  return { selected, totalArea }
}

// ── Coverage stats ────────────────────────────────────────────────────────────

export const COVERAGE_RADIUS = { hub_l: 4000, hub_m: 2000, hub_s: 500 }

function computeCoverageM2(count, radiusM) {
  return count * Math.PI * radiusM * radiusM
}

// ── Zone classification ───────────────────────────────────────────────────────

const CENTER_DISTRICT_NAMES = [
  'Stadtmitte', 'Schillerteich', 'Hellwinkel', 'Heßlingen', 'Rothenfelde',
  'Köhlerberg', 'Alt-Wolfsburg', 'Sandkamp', 'Hochenstein',
]

function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function classifyZone(lon, lat, districtBoundaries) {
  for (const name of CENTER_DISTRICT_NAMES) {
    const dist = districtBoundaries?.[name]
    if (!dist?.geometry) continue
    const geom = dist.geometry
    const rings = geom.type === 'Polygon'
      ? [geom.coordinates[0]]
      : geom.type === 'MultiPolygon'
        ? geom.coordinates.map(p => p[0])
        : []
    if (rings.some(r => pointInRing(lon, lat, r))) return 'centre'
  }
  return 'outer'
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runHubLMAlgorithm({ localCarParkings, districtBoundaries, hubLMConfig }) {
  const {
    requiredAreaL = 15233,
    requiredAreaM = 7002,
    minDistL = 800,
    minDistM = 500,
  } = hubLMConfig || {}

  // Hub L: multi-storey parking structures (fleet depot)
  const candidatesL = extractCandidates(localCarParkings, ['multi-storey', 'multi_storey', 'garage'])
  const { selected: selL, totalArea: areaL } = greedySelect(candidatesL, requiredAreaL, minDistL, 15)

  // Hub M: underground + surface parkings (intermodal transfer node).
  // Surface parkings are abundant candidates that become district hubs in a post-car scenario.
  // We exclude sites already taken by Hub L.
  const hubLCoords = new Set(selL.map(h => `${h.lat.toFixed(5)},${h.lon.toFixed(5)}`))
  const candidatesM = extractCandidates(
    localCarParkings, ['underground', 'underpass', 'surface', 'multi-storey', 'multi_storey', 'garage'],
  ).filter(c => !hubLCoords.has(`${c.lat.toFixed(5)},${c.lon.toFixed(5)}`))
  const { selected: selM, totalArea: areaM } = greedySelect(candidatesM, requiredAreaM, minDistM, 60)

  // Zone classification
  const classifyAll = (arr) =>
    arr.map(h => ({ ...h, zone: classifyZone(h.lon, h.lat, districtBoundaries) }))
  const hubL = classifyAll(selL)
  const hubM = classifyAll(selM)

  const buildStats = (hubs, candidates, totalArea, requiredArea, radiusM) => ({
    hubs,
    totalArea,
    centreCount:  hubs.filter(h => h.zone === 'centre').length,
    outerCount:   hubs.filter(h => h.zone === 'outer').length,
    centreArea:   hubs.filter(h => h.zone === 'centre').reduce((s, h) => s + h.area, 0),
    outerArea:    hubs.filter(h => h.zone === 'outer').reduce((s, h) => s + h.area, 0),
    coverageM2:   computeCoverageM2(hubs.length, radiusM),
    candidateCount: candidates.length,
    requiredArea,
    radiusM,
  })

  return {
    hubL: buildStats(hubL, candidatesL, areaL, requiredAreaL, COVERAGE_RADIUS.hub_l),
    hubM: buildStats(hubM, candidatesM, areaM, requiredAreaM, COVERAGE_RADIUS.hub_m),
    candidatesL,
    candidatesM,
  }
}
