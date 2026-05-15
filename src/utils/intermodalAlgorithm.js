// Intermodal Hub Algorithm — Wolfsburg
// Implements Steps 0 → A → B → C → D as described in the specification.

const R_EARTH = 6371000 // metres

function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Ray-casting point-in-polygon (ring: array of [lng, lat])
function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// True spatial intersection: polygon ∩ circle (radiusM)
function circleIntersectsPolygon(lat, lng, radiusM, feature) {
  const geom = feature.geometry
  if (!geom) return false
  const ringGroups =
    geom.type === 'Polygon' ? geom.coordinates :
    geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []

  for (const ring of ringGroups) {
    if (pointInRing(lng, lat, ring)) return true // centre inside polygon
    for (const [pLng, pLat] of ring)
      if (haversineM(lat, lng, pLat, pLng) <= radiusM) return true // vertex inside circle
  }
  return false
}

// ── Step 0: filter facilities ─────────────────────────────────────────────────

const INTENSITY_FOOTFALL = { High: 500, Medium: 200, Low: 50, '—': 0 }

export function filterFacilities(venues) {
  const withFootfall = venues.map(v => ({
    ...v,
    _footfall: INTENSITY_FOOTFALL[v.activityIntensity] ?? 100,
    _activeHours: (v.openingHours && v.openingHours !== '—') ? v.openingHours : null,
  }))

  const footfalls = withFootfall.map(v => v._footfall).sort((a, b) => a - b)
  const median = footfalls[Math.floor(footfalls.length / 2)] ?? 0

  return withFootfall.filter(v => v._footfall > median || v._activeHours !== null)
}

// ── Branch A: Bus stops ───────────────────────────────────────────────────────

function scoreOneStop(lat, lng, facilities, parks, bikeParkings) {
  let score = 0
  const conditions = []
  const nearbyFacilities = []
  let nearbyParkName = null
  let hasExistingBike = false

  // A1 – facilities within 1500 m
  let footfallSum = 0
  for (const f of facilities) {
    const d = haversineM(lat, lng, f.lat, f.lng)
    if (d <= 1500) {
      footfallSum += f._footfall
      nearbyFacilities.push({ name: f.name, footfall: f._footfall, hours: f._activeHours, dist: Math.round(d) })
    }
  }
  if (footfallSum > 0) { score += footfallSum; conditions.push('A1') }

  // A2 – park polygon intersects 500 m circle
  for (const park of (parks?.features ?? [])) {
    if (circleIntersectsPolygon(lat, lng, 500, park)) {
      score += 1
      conditions.push('A2')
      nearbyParkName = park.properties?.name || 'Park'
      break
    }
  }

  // A3 – existing bike parking within 200 m
  for (const bp of (bikeParkings?.features ?? [])) {
    const [bLng, bLat] = bp.geometry.coordinates
    if (haversineM(lat, lng, bLat, bLng) <= 200) {
      score += 2
      hasExistingBike = true
      conditions.push('A3')
      break
    }
  }

  return { score, conditions, nearbyFacilities, nearbyParkName, hasExistingBike }
}

// A4 – deduplicate: within 1000 m keep higher score
function deduplicateByScore(items, radiusM = 1000) {
  const suppressed = new Set()
  const sorted = [...items].sort((a, b) => b.score - a.score || b._footfallSum - a._footfallSum)
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue
      if (haversineM(sorted[i].lat, sorted[i].lng, sorted[j].lat, sorted[j].lng) <= radiusM)
        suppressed.add(j)
    }
  }
  return sorted.filter((_, idx) => !suppressed.has(idx))
}

export function scoreBusStops(busStopsGeoJSON, facilities, parks, bikeParkings) {
  const raw = (busStopsGeoJSON?.features ?? []).map(f => {
    const [lng, lat] = f.geometry.coordinates
    const { score, conditions, nearbyFacilities, nearbyParkName, hasExistingBike } =
      scoreOneStop(lat, lng, facilities, parks, bikeParkings)
    if (score === 0) return null
    return {
      _type: 'bus',
      lat, lng,
      score,
      conditions,
      nearbyFacilities,
      nearbyParkName,
      hasExistingBike,
      _footfallSum: nearbyFacilities.reduce((s, f) => s + f.footfall, 0),
      label: f.properties?.name || f.properties?.ref || 'Bus stop',
    }
  }).filter(Boolean)

  return deduplicateByScore(raw, 1000)
}

// ── Branch B: Car parkings ────────────────────────────────────────────────────

export function scoreCarParkings(carParkingsGeoJSON, facilities, parks) {
  return (carParkingsGeoJSON?.features ?? []).map(f => {
    let lat, lng
    if (f.geometry.type === 'Point') {
      ;[lng, lat] = f.geometry.coordinates
    } else if (f.properties?.lat && f.properties?.lon) {
      lat = f.properties.lat; lng = f.properties.lon
    } else {
      const ring = f.geometry.coordinates[0]
      const sumLng = ring.reduce((s, c) => s + c[0], 0)
      const sumLat = ring.reduce((s, c) => s + c[1], 0)
      lng = sumLng / ring.length; lat = sumLat / ring.length
    }

    let score = 0
    const conditions = []
    const nearbyFacilities = []
    let nearbyParkName = null

    // B1 – facilities within 1500 m
    let footfallSum = 0
    for (const fac of facilities) {
      const d = haversineM(lat, lng, fac.lat, fac.lng)
      if (d <= 1500) {
        footfallSum += fac._footfall
        nearbyFacilities.push({ name: fac.name, footfall: fac._footfall, hours: fac._activeHours, dist: Math.round(d) })
      }
    }
    if (footfallSum > 0) { score += footfallSum; conditions.push('B1') }

    // B2 – park polygon intersects 500 m circle
    for (const park of (parks?.features ?? [])) {
      if (circleIntersectsPolygon(lat, lng, 500, park)) {
        score += 1
        conditions.push('B2')
        nearbyParkName = park.properties?.name || 'Park'
        break
      }
    }

    if (score === 0) return null
    return {
      _type: 'car',
      lat, lng,
      score,
      conditions,
      nearbyFacilities,
      nearbyParkName,
      hasExistingBike: false,
      _footfallSum: footfallSum,
      label: f.properties?.name || 'Car parking',
    }
  }).filter(Boolean)
}

// ── Step C: Merge Bus + Car within 200 m ─────────────────────────────────────

export function mergeHubs(busHubs, carHubs) {
  const usedBus = new Set()
  const usedCar = new Set()
  const merged = []

  for (const bus of busHubs) {
    const busKey = `${bus.lat}_${bus.lng}`
    if (usedBus.has(busKey)) continue

    for (const car of carHubs) {
      const carKey = `${car.lat}_${car.lng}`
      if (usedCar.has(carKey)) continue
      if (haversineM(bus.lat, bus.lng, car.lat, car.lng) <= 200) {
        const winner = bus.score >= car.score ? bus : car
        merged.push({
          hubType: 'auto_bus_bike',
          lat: winner.lat,
          lng: winner.lng,
          score: Math.max(bus.score, car.score),
          conditions: [...new Set([...bus.conditions, ...car.conditions])],
          nearbyFacilities: [...bus.nearbyFacilities, ...car.nearbyFacilities.filter(cf =>
            !bus.nearbyFacilities.some(bf => bf.name === cf.name))],
          nearbyParkName: bus.nearbyParkName || car.nearbyParkName,
          hasExistingBike: bus.hasExistingBike,
          labelBus: bus.label,
          labelCar: car.label,
        })
        usedBus.add(busKey)
        usedCar.add(carKey)
        break
      }
    }
  }

  for (const bus of busHubs) {
    if (!usedBus.has(`${bus.lat}_${bus.lng}`))
      merged.push({ hubType: 'bus_bike', lat: bus.lat, lng: bus.lng, score: bus.score,
        conditions: bus.conditions, nearbyFacilities: bus.nearbyFacilities,
        nearbyParkName: bus.nearbyParkName, hasExistingBike: bus.hasExistingBike, labelBus: bus.label })
  }

  for (const car of carHubs) {
    if (!usedCar.has(`${car.lat}_${car.lng}`))
      merged.push({ hubType: 'auto_bike', lat: car.lat, lng: car.lng, score: car.score,
        conditions: car.conditions, nearbyFacilities: car.nearbyFacilities,
        nearbyParkName: car.nearbyParkName, hasExistingBike: false, labelCar: car.label })
  }

  return merged
}

// ── Step D: Priority + status ─────────────────────────────────────────────────

export function assignPriority(hubs) {
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
  const facilities = filterFacilities(venues)
  const busHubs    = scoreBusStops(busStopsGeoJSON, facilities, parksGeoJSON, bikeParkingsGeoJSON)
  const carHubs    = scoreCarParkings(carParkingsGeoJSON, facilities, parksGeoJSON)
  return assignPriority(mergeHubs(busHubs, carHubs))
}

// ── Geo helpers for radius circles (GeoJSON polygon approximation) ────────────

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
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: { hubType: hub.hubType },
    }
  })
  return { type: 'FeatureCollection', features }
}
