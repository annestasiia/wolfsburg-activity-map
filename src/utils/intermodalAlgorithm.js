// Intermodal Hub Algorithm — Wolfsburg
// Steps: 1 (score) → 2 (filter) → 3 (greedy select) → 4 (merge) → 5 (priority)

const R_EARTH = 6371000 // metres

export function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Ray-casting point-in-polygon (ring: [[lng, lat], ...])
function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// True spatial intersection: circle vs polygon feature
function circleIntersectsPolygon(lat, lng, radiusM, feature) {
  const geom = feature.geometry
  if (!geom) return false
  const ringGroups =
    geom.type === 'Polygon' ? geom.coordinates :
    geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []
  for (const ring of ringGroups) {
    if (pointInRing(lng, lat, ring)) return true
    for (const [pLng, pLat] of ring)
      if (haversineM(lat, lng, pLat, pLng) <= radiusM) return true
  }
  return false
}

// ── Footfall lookup (used by sidebar & here for display) ──────────────────────
export const INTENSITY_FOOTFALL = { High: 500, Medium: 200, Low: 50, '—': 0 }

function getFootfall(venue) {
  return venue._footfall ?? INTENSITY_FOOTFALL[venue.activityIntensity] ?? 100
}

// ── Step 1: Score one candidate (bus stop or car parking) ─────────────────────
function scoreCandidate(lat, lng, type, label, facilities, parks, bikeParkings) {
  let score = 0
  const conditions = []
  const nearbyFacilities = []
  let nearbyParkName = null
  let hasExistingBike = false

  // Condition 1 — facilities within 1500 m
  let footfallSum = 0
  for (const f of facilities) {
    const d = haversineM(lat, lng, f.lat, f.lng)
    if (d <= 1500) {
      const fp = getFootfall(f)
      footfallSum += fp
      nearbyFacilities.push({
        name: f.name,
        footfall: fp,
        hours: f._activeHours || f.openingHours || null,
        dist: Math.round(d),
        category: f.category || null,
      })
    }
  }
  if (footfallSum > 0) {
    score += footfallSum
    conditions.push('A1')
  }

  // Condition 2 — park polygon within 500 m
  for (const park of (parks?.features ?? [])) {
    if (circleIntersectsPolygon(lat, lng, 500, park)) {
      score += 1
      conditions.push('A2')
      nearbyParkName = park.properties?.name || 'Park'
      break
    }
  }

  // Condition 3 — existing bike parking within 200 m
  for (const bp of (bikeParkings?.features ?? [])) {
    const [bLng, bLat] = bp.geometry.coordinates
    if (haversineM(lat, lng, bLat, bLng) <= 200) {
      score += 2
      hasExistingBike = true
      conditions.push('A3')
      break
    }
  }

  return { type, label, lat, lng, score, conditions, nearbyFacilities, nearbyParkName, hasExistingBike, _footfallSum: footfallSum }
}

// ── Step 1 applied to GeoJSON feature collections ─────────────────────────────

function candidatesFromBusStops(busStopsGeoJSON, facilities, parks, bikeParkings) {
  return (busStopsGeoJSON?.features ?? []).map(f => {
    const [lng, lat] = f.geometry.coordinates
    const label = f.properties?.name || f.properties?.ref || 'Bus stop'
    return scoreCandidate(lat, lng, 'bus', label, facilities, parks, bikeParkings)
  })
}

function candidatesFromCarParkings(carParkingsGeoJSON, facilities, parks, bikeParkings) {
  return (carParkingsGeoJSON?.features ?? []).map(f => {
    let lat, lng
    if (f.geometry.type === 'Point') {
      ;[lng, lat] = f.geometry.coordinates
    } else {
      const ring = f.geometry.coordinates?.[0] ?? []
      lng = ring.reduce((s, c) => s + c[0], 0) / (ring.length || 1)
      lat = ring.reduce((s, c) => s + c[1], 0) / (ring.length || 1)
    }
    const label = f.properties?.name || 'Car parking'
    return scoreCandidate(lat, lng, 'car', label, facilities, parks, bikeParkings)
  })
}

// ── Step 2: Filter score > 0 ──────────────────────────────────────────────────

// ── Step 3: Greedy selection from unified pool ────────────────────────────────
function greedySelect(candidates, exclusionRadiusM = 1000) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || b._footfallSum - a._footfallSum)
  const selected = []
  for (const c of sorted) {
    const blocked = selected.some(s => haversineM(c.lat, c.lng, s.lat, s.lng) <= exclusionRadiusM)
    if (!blocked) selected.push(c)
  }
  return selected
}

// ── Step 4: Merge bus + car pairs within 200 m ────────────────────────────────
function mergeSelected(selected) {
  const usedBus = new Set()
  const usedCar = new Set()
  const result = []

  const busHubs = selected.filter(c => c.type === 'bus')
  const carHubs = selected.filter(c => c.type === 'car')

  for (const bus of busHubs) {
    const busKey = `${bus.lat}_${bus.lng}`
    if (usedBus.has(busKey)) continue
    for (const car of carHubs) {
      const carKey = `${car.lat}_${car.lng}`
      if (usedCar.has(carKey)) continue
      if (haversineM(bus.lat, bus.lng, car.lat, car.lng) <= 200) {
        const winner = bus.score >= car.score ? bus : car
        const allFacs = [...bus.nearbyFacilities, ...car.nearbyFacilities.filter(cf =>
          !bus.nearbyFacilities.some(bf => bf.name === cf.name))]
        result.push({
          hubType: 'auto_bus_bike',
          lat: winner.lat, lng: winner.lng,
          score: Math.max(bus.score, car.score),
          conditions: [...new Set([...bus.conditions, ...car.conditions])],
          nearbyFacilities: allFacs,
          nearbyParkName: bus.nearbyParkName || car.nearbyParkName,
          hasExistingBike: bus.hasExistingBike || car.hasExistingBike,
          labelBus: bus.label, labelCar: car.label,
        })
        usedBus.add(busKey)
        usedCar.add(carKey)
        break
      }
    }
  }

  for (const bus of busHubs) {
    if (!usedBus.has(`${bus.lat}_${bus.lng}`))
      result.push({ hubType: 'bus_bike', lat: bus.lat, lng: bus.lng, score: bus.score,
        conditions: bus.conditions, nearbyFacilities: bus.nearbyFacilities,
        nearbyParkName: bus.nearbyParkName, hasExistingBike: bus.hasExistingBike, labelBus: bus.label })
  }

  for (const car of carHubs) {
    if (!usedCar.has(`${car.lat}_${car.lng}`))
      result.push({ hubType: 'auto_bike', lat: car.lat, lng: car.lng, score: car.score,
        conditions: car.conditions, nearbyFacilities: car.nearbyFacilities,
        nearbyParkName: car.nearbyParkName, hasExistingBike: car.hasExistingBike, labelCar: car.label })
  }

  return result
}

// ── Step 5: Priority + status ─────────────────────────────────────────────────
function assignPriority(hubs) {
  if (!hubs.length) return []
  const sorted = [...hubs.map(h => h.score)].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return hubs.map(hub => ({
    ...hub,
    priority: hub.score > median ? 'priority' : 'potential',
    status: hub.hasExistingBike ? 'existing' : 'proposed',
  }))
}

// ── Main entry point ──────────────────────────────────────────────────────────
export function runIntermodalAlgorithm(venues, busStopsGeoJSON, carParkingsGeoJSON, bikeParkingsGeoJSON, parksGeoJSON) {
  // Attach computed footfall to every venue (no pre-filtering)
  const facilities = venues.map(v => ({
    ...v,
    _footfall: getFootfall(v),
    _activeHours: (v.openingHours && v.openingHours !== '—') ? v.openingHours : null,
  }))

  const busCandidates = candidatesFromBusStops(busStopsGeoJSON, facilities, parksGeoJSON, bikeParkingsGeoJSON)
  const carCandidates = candidatesFromCarParkings(carParkingsGeoJSON, facilities, parksGeoJSON, bikeParkingsGeoJSON)

  // Step 2: filter
  const allCandidates = [...busCandidates, ...carCandidates].filter(c => c.score > 0)

  // Step 3: greedy select from unified pool
  const selected = greedySelect(allCandidates, 1000)

  // Step 4: merge bus+car pairs
  const merged = mergeSelected(selected)

  // Step 5: priority
  return assignPriority(merged)
}

// ── Geo helper: GeoJSON circle polygon for radius visualisation ───────────────
export function generateCircleGeoJSON(hubs, radiusM, steps = 48) {
  const features = hubs.map(hub => {
    const { lat, lng } = hub
    const coords = []
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI
      const dLat = (radiusM / 111320) * Math.sin(angle)
      const dLng = (radiusM / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(angle)
      coords.push([lng + dLng, lat + dLat])
    }
    coords.push(coords[0])
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { hubType: hub.hubType } }
  })
  return { type: 'FeatureCollection', features }
}
