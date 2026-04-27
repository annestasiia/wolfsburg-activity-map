// Hourly base activity patterns per place-category type
// Values 0.0–1.0 representing pedestrian generation for each hour 0–23
const PLACE_PATTERNS = {
  school: [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.2, 0.9, 1.0, 0.6, 0.5, 0.5,
    0.8, 0.9, 0.7, 0.5, 0.4, 0.2,
    0.1, 0.0, 0.0, 0.0, 0.0, 0.0,
  ],
  leisure: [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.1,
    0.2, 0.3, 0.5, 0.7, 0.8, 0.8,
    0.7, 0.7, 0.8, 0.9, 1.0, 0.9,
    0.8, 0.6, 0.4, 0.2, 0.1, 0.0,
  ],
  commercial: [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.1, 0.3, 0.6, 0.8, 0.9, 1.0,
    0.9, 0.8, 0.8, 0.7, 0.6, 0.4,
    0.3, 0.2, 0.1, 0.0, 0.0, 0.0,
  ],
  culture: [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.1, 0.3, 0.5, 0.7, 0.8,
    0.6, 0.5, 0.6, 0.7, 0.8, 0.9,
    1.0, 0.9, 0.6, 0.3, 0.1, 0.0,
  ],
}

// Weekend modifier: schools closed; leisure/culture get a boost
const WEEKEND_OVERRIDES = {
  school: null,  // null = skip entirely on weekends
  leisure:    [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.4, 0.7, 0.9, 1.0, 1.0, 0.9, 0.9, 1.0, 1.0, 1.0, 0.9, 0.8, 0.6, 0.4, 0.2, 0.1, 0.0],
  commercial: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.4, 0.7, 0.9, 1.0, 0.9, 0.8, 0.8, 0.7, 0.5, 0.3, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0],
  culture:    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.4, 0.7, 0.9, 1.0, 0.9, 0.8, 0.9, 1.0, 1.0, 1.0, 0.9, 0.7, 0.4, 0.2, 0.1, 0.0],
}

const INTENSITY_WEIGHT = { High: 1.0, Medium: 0.55, Low: 0.25 }
const RADIUS_M = 250
const EARTH_R  = 6371000

function categoryToType(category) {
  switch (category) {
    case 'Schools':    return 'school'
    case 'Leisure':    return 'leisure'
    case 'Commercial': return 'commercial'
    case 'Culture':    return 'culture'
    default:           return 'leisure'
  }
}

function isWeekend(day) {
  return day === 'Sat' || day === 'Sun'
}

function patternFor(type, weekend) {
  if (weekend && WEEKEND_OVERRIDES[type] === null) return null
  return (weekend && WEEKEND_OVERRIDES[type]) || PLACE_PATTERNS[type]
}

function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns 0.0–1.0 activity level for a single venue at a given day+hour
function getPlaceActivity(venue, selectedDay, hour) {
  const dayVal = venue.days?.[selectedDay]
  if (!dayVal || dayVal === '—') return 0

  const type     = categoryToType(venue.category)
  const weekend  = isWeekend(selectedDay)
  const pattern  = patternFor(type, weekend)
  if (!pattern) return 0

  const intensity = INTENSITY_WEIGHT[venue.activityIntensity] ?? 0.5
  return pattern[hour] * intensity
}

// Returns 0.0–1.0 composite brightness for a footway based on nearby venues
function calcFootwayBrightness(coords, venues, selectedDay, hour) {
  // Use midpoint of footway segment for distance test
  const mid = coords[Math.floor(coords.length / 2)]
  const [fLon, fLat] = mid

  let sum = 0
  let count = 0
  for (const v of venues) {
    const dist = haversineM(fLat, fLon, v.lat, v.lng)
    if (dist > RADIUS_M) continue
    const proximity = 1 - dist / RADIUS_M  // 1.0 at centre, 0.0 at edge
    const activity  = getPlaceActivity(v, selectedDay, hour)
    sum += activity * proximity
    count++
  }
  if (count === 0) return 0
  // Normalise: cap at 1.0
  return Math.min(sum / Math.max(count * 0.3, 1), 1.0)
}

// Produces a new FeatureCollection with an `opacity` property per feature
export function computeFootwayGeoJSON(footways, venues, selectedDay, selectedTime) {
  if (!footways || !venues?.length) return footways

  const hour = parseInt(selectedTime.split(':')[0], 10)
  const weekend = isWeekend(selectedDay)

  const features = footways.features.map(f => {
    const coords     = f.geometry?.coordinates ?? []
    const brightness = calcFootwayBrightness(coords, venues, selectedDay, hour)

    // Minimum 0.08 so footways are always faintly visible; scale up to 0.9
    const opacity = 0.08 + brightness * 0.82

    return {
      ...f,
      properties: { ...f.properties, opacity, weekend },
    }
  })

  return { ...footways, features }
}
