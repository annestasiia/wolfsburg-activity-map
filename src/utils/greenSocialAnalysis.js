// ── Green Social Infrastructure Analysis ─────────────────────────────────────
// Pure computation functions — no side effects, no React imports.
// Used by: useGreenSocialData hook, GreenSocialPanel, MapView

import { DISTRICTS } from '../constants'

// ── Overpass queries ──────────────────────────────────────────────────────────

const BB = '52.35,10.68,52.52,10.93'

export const SOCIAL_AMENITIES_QUERY = `[out:json][timeout:60];
(
  node["leisure"="playground"](${BB});
  way["leisure"="playground"](${BB});
  node["leisure"="pitch"](${BB});
  way["leisure"="pitch"](${BB});
  node["leisure"="sports_centre"](${BB});
  way["leisure"="sports_centre"](${BB});
  node["leisure"="fitness_station"](${BB});
  node["amenity"="bench"](${BB});
  node["amenity"="cafe"](${BB});
  node["amenity"="restaurant"](${BB});
  node["amenity"="drinking_water"](${BB});
  node["amenity"="fountain"](${BB});
  node["amenity"="bbq"](${BB});
  node["amenity"="shelter"](${BB});
  node["amenity"="toilets"](${BB});
  node["tourism"="picnic_site"](${BB});
  node["leisure"="picnic_table"](${BB});
);
out center;`

// ── Social amenity classification ─────────────────────────────────────────────

export const SOCIAL_AMENITY_TYPES = {
  playground:     { weight: 5, label: 'Playground',      icon: '🛝', category: 'active',  color: '#FF6B6B' },
  pitch:          { weight: 4, label: 'Sports pitch',    icon: '⚽', category: 'active',  color: '#FF8E53' },
  sports_centre:  { weight: 4, label: 'Sports centre',   icon: '🏅', category: 'active',  color: '#FF8E53' },
  fitness_station:{ weight: 3, label: 'Fitness station', icon: '🏋️', category: 'active',  color: '#FFA94D' },
  cafe:           { weight: 3, label: 'Café',            icon: '☕', category: 'social',  color: '#845EF7' },
  restaurant:     { weight: 2, label: 'Restaurant',      icon: '🍽️', category: 'social',  color: '#845EF7' },
  bbq:            { weight: 3, label: 'BBQ area',        icon: '🔥', category: 'social',  color: '#E67E22' },
  picnic_site:    { weight: 2, label: 'Picnic site',     icon: '🧺', category: 'passive', color: '#52B788' },
  picnic_table:   { weight: 1, label: 'Picnic table',    icon: '🪑', category: 'passive', color: '#52B788' },
  bench:          { weight: 1, label: 'Bench',           icon: '🪑', category: 'passive', color: '#74C69D' },
  drinking_water: { weight: 2, label: 'Drinking water',  icon: '💧', category: 'comfort', color: '#4FC3F7' },
  fountain:       { weight: 2, label: 'Fountain',        icon: '⛲', category: 'comfort', color: '#4FC3F7' },
  shelter:        { weight: 2, label: 'Shelter',         icon: '⛺', category: 'comfort', color: '#A8D8EA' },
  toilets:        { weight: 1, label: 'Toilets',         icon: '🚻', category: 'comfort', color: '#B0BEC5' },
}

// ── Overpass response → GeoJSON ───────────────────────────────────────────────

export function socialAmenitiesToGeoJSON(elements) {
  const seen     = new Set()
  const features = []

  for (const el of elements) {
    const key = `${el.type}_${el.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const tags = el.tags || {}
    let coords = null
    if (el.type === 'node' && el.lat != null)             coords = [el.lon, el.lat]
    else if (el.type === 'way' && el.center?.lat != null) coords = [el.center.lon, el.center.lat]
    if (!coords) continue

    const typeKey = tags.leisure || tags.amenity || tags.tourism
    const meta    = SOCIAL_AMENITY_TYPES[typeKey]
    if (!meta) continue

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        _id:       el.id,
        _type:     typeKey,
        _label:    meta.label,
        _icon:     meta.icon,
        _weight:   meta.weight,
        _category: meta.category,
        _color:    meta.color,
        name:      tags.name || '',
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

// ── Geometry primitives ───────────────────────────────────────────────────────

// Ray-casting point-in-polygon test for a single ring.
function pointInPolygon(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) &&
        lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// Extract the outer rings from a district FeatureCollection.
function districtRings(gj) {
  const rings = []
  for (const f of (gj?.features || [])) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon' && g.coordinates[0])
      rings.push(g.coordinates[0])
    else if (g.type === 'MultiPolygon')
      g.coordinates.forEach(p => { if (p[0]) rings.push(p[0]) })
  }
  return rings
}

// Test if a point is inside any of the district's rings.
function pointInDistrict(lng, lat, rings) {
  return rings.some(ring => pointInPolygon(lng, lat, ring))
}

// Collect every [lng, lat] coordinate from any geometry type.
function getAllCoords(geom) {
  const out = []
  const visit = (c) => {
    if (typeof c[0] === 'number') out.push(c)
    else c.forEach(visit)
  }
  if (geom?.coordinates) visit(geom.coordinates)
  return out
}

// True geometry intersection: feature touches the district polygon.
// Handles large polygons (e.g. forests) that fully contain the district
// by also testing district vertices against the feature's outer ring.
function featureIntersectsDistrict(feature, rings) {
  const geom = feature.geometry
  if (!geom) return false

  switch (geom.type) {
    case 'Point': {
      const [lng, lat] = geom.coordinates
      return pointInDistrict(lng, lat, rings)
    }
    case 'LineString': {
      return geom.coordinates.some(([lng, lat]) => pointInDistrict(lng, lat, rings))
    }
    case 'MultiLineString': {
      return geom.coordinates.some(seg =>
        seg.some(([lng, lat]) => pointInDistrict(lng, lat, rings))
      )
    }
    case 'Polygon': {
      const outer = geom.coordinates[0] || []
      // Feature vertex inside district
      if (outer.some(([lng, lat]) => pointInDistrict(lng, lat, rings))) return true
      // District vertex inside feature — catches large forests containing the district
      return rings.some(ring =>
        ring.some(([lng, lat]) => pointInPolygon(lng, lat, outer))
      )
    }
    case 'MultiPolygon': {
      for (const poly of geom.coordinates) {
        const outer = poly[0] || []
        if (outer.some(([lng, lat]) => pointInDistrict(lng, lat, rings))) return true
        if (rings.some(ring =>
          ring.some(([lng, lat]) => pointInPolygon(lng, lat, outer))
        )) return true
      }
      return false
    }
    default:
      return false
  }
}

// Proximity check: any feature coordinate within `threshold` degrees of
// any district boundary vertex. Used for the accessibility "nearby" tier.
function featureNearDistrict(feature, rings, threshold) {
  const fCoords = getAllCoords(feature.geometry)
  for (const [flng, flat] of fCoords)
    for (const ring of rings)
      for (const [rlng, rlat] of ring)
        if (Math.hypot(flng - rlng, flat - rlat) < threshold) return true
  return false
}

// Unsigned area of a ring.
function ringArea(ring) {
  return Math.abs(ringSignedArea(ring))
}

function districtArea(rings) {
  return rings.reduce((sum, r) => sum + ringArea(r), 0)
}

// ── Polygon clipping (Sutherland-Hodgman) ────────────────────────────────────

// Strip the duplicate closing vertex that GeoJSON rings carry.
function openRing(ring) {
  const n = ring.length
  if (n < 2) return ring.slice()
  const [x0, y0] = ring[0], [xn, yn] = ring[n - 1]
  return (Math.abs(x0 - xn) < 1e-10 && Math.abs(y0 - yn) < 1e-10)
    ? ring.slice(0, n - 1)
    : ring.slice()
}

// Signed area — positive means CCW in standard math orientation (Y-up / lat-lng).
// Uses cross-product shoelace: Σ (x_i * y_{i+1} - x_{i+1} * y_i)
function ringSignedArea(ring) {
  let a = 0
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

// Return ring guaranteed counter-clockwise (Sutherland-Hodgman needs CCW clip).
function toCCW(ring) {
  return ringSignedArea(ring) < 0 ? ring.slice().reverse() : ring
}

// Is `pt` on the left side (or on) the directed edge a→b?
function onLeft([px, py], [ax, ay], [bx, by]) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax) > -1e-10
}

// Intersection of segment p1→p2 with infinite line a→b.
function segIsect([x1, y1], [x2, y2], [ax, ay], [bx, by]) {
  const dx = x2 - x1, dy = y2 - y1
  const ex = bx - ax, ey = by - ay
  const d  = dx * ey - dy * ex
  if (Math.abs(d) < 1e-12) return null
  const t = ((ax - x1) * ey - (ay - y1) * ex) / d
  return [x1 + t * dx, y1 + t * dy]
}

// Clip `subject` (open ring array) by a single directed edge a→b.
function clipByEdge(pts, a, b) {
  if (!pts.length) return []
  const out = []
  for (let i = 0; i < pts.length; i++) {
    const cur  = pts[i]
    const prev = pts[(i + pts.length - 1) % pts.length]
    const cIn  = onLeft(cur,  a, b)
    const pIn  = onLeft(prev, a, b)
    if (cIn) {
      if (!pIn) { const x = segIsect(prev, cur, a, b); if (x) out.push(x) }
      out.push(cur)
    } else if (pIn) {
      const x = segIsect(prev, cur, a, b)
      if (x) out.push(x)
    }
  }
  return out
}

// Sutherland-Hodgman: clip subject ring against clip ring.
// clip is treated as CCW; subject may be either winding.
function intersectRings(subjectRaw, clipRaw) {
  let pts = openRing(subjectRaw)
  const clip = openRing(toCCW(clipRaw))
  for (let i = 0; i < clip.length; i++) {
    if (!pts.length) return []
    pts = clipByEdge(pts, clip[i], clip[(i + 1) % clip.length])
  }
  return pts
}

// Centroid of a ring (mean of unique vertices).
function ringCentroid(ring) {
  const r = openRing(ring)
  let sx = 0, sy = 0
  for (const [x, y] of r) { sx += x; sy += y }
  return [sx / r.length, sy / r.length]
}

// Intersection area between a feature ring and a district ring.
// The district ring is decomposed into fan triangles from its centroid.
// Triangles are always convex so S-H is always correct.
// Signed contributions cancel out the concave "dents" of non-convex districts.
function ringIntersectionArea(fRing, dRing) {
  const C   = ringCentroid(dRing)
  const d   = openRing(dRing)
  const n   = d.length
  if (n < 3) return 0
  let total = 0
  for (let i = 0; i < n; i++) {
    const tri  = [C, d[i], d[(i + 1) % n]]
    const sign = Math.sign(ringSignedArea(tri))
    if (sign === 0) continue
    const clipped = intersectRings(fRing, tri)
    if (clipped.length >= 3) total += sign * ringArea(clipped)
  }
  return Math.abs(total)
}

// Total intersection area between a feature (Polygon|MultiPolygon) and all district rings.
function featureIntersectionArea(feature, dRings) {
  const geom = feature.geometry
  if (!geom) return 0
  let total = 0
  const addRing = (fRing) => {
    for (const dRing of dRings) total += ringIntersectionArea(fRing, dRing)
  }
  if (geom.type === 'Polygon') {
    if (geom.coordinates[0]) addRing(geom.coordinates[0])
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) { if (poly[0]) addRing(poly[0]) }
  }
  return total
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function normalize10(raw) {
  const vals = Object.values(raw).filter(v => isFinite(v) && v >= 0)
  if (!vals.length) return Object.fromEntries(Object.keys(raw).map(k => [k, 0]))
  const max = Math.max(...vals)
  if (max === 0) return Object.fromEntries(Object.keys(raw).map(k => [k, 0]))
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.round((v / max) * 100) / 10])
  )
}

// ── Analysis 1 — Green Coverage Score ────────────────────────────────────────
// Weighted count of quality green features per district, area-normalized.

const COVERAGE_WEIGHTS = {
  parks_recreation:       3.0,
  forests_woods:          3.0,
  protected_conservation: 2.5,
  natural_vegetation:     2.5,
  grass_open_green:       2.0,
  agriculture_planted:    1.0,
  individual_vegetation:  0.5,
  others:                 0.5,
  network:                0,
}

export function computeGreenCoverageScores(greeneryGeoJSON, districtBoundaries, weights = COVERAGE_WEIGHTS) {
  if (!greeneryGeoJSON || !Object.keys(districtBoundaries).length) return {}

  const areaFeatures = greeneryGeoJSON.features.filter(f => {
    const w = (weights ?? COVERAGE_WEIGHTS)[f.properties._categoryId]
    if (!w) return false
    const t = f.geometry?.type
    return t === 'Polygon' || t === 'MultiPolygon'
  })

  const raw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { raw[name] = 0; continue }
    const rings = districtRings(gj)
    const area  = districtArea(rings)
    if (area === 0) { raw[name] = 0; continue }

    let B = 0
    for (const f of areaFeatures) {
      if (!featureIntersectsDistrict(f, rings)) continue
      const w = (weights ?? COVERAGE_WEIGHTS)[f.properties._categoryId]
      B += w * featureIntersectionArea(f, rings)
    }

    raw[name] = B / area
  }
  return normalize10(raw)
}

// ── Analysis 2 — Social Infrastructure Score ─────────────────────────────────
// Weighted density of social amenities per district.

export function computeSocialDensityScores(socialGeoJSON, districtBoundaries) {
  if (!socialGeoJSON || !Object.keys(districtBoundaries).length) return {}
  const raw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { raw[name] = 0; continue }
    const rings = districtRings(gj)
    const area  = districtArea(rings)
    let score = 0
    for (const f of socialGeoJSON.features) {
      const [lng, lat] = f.geometry.coordinates
      if (pointInDistrict(lng, lat, rings)) score += (f.properties._weight || 1)
    }
    raw[name] = area > 0 ? score / Math.sqrt(area * 1e6) : 0
  }
  return normalize10(raw)
}

// ── Analysis 3 — Green Space Accessibility Score ──────────────────────────────
// Quality green polygons within or near each district.
// Inside district = 3 pts, within ~800 m of district boundary = 1 pt.

export function computeAccessibilityScores(greeneryGeoJSON, districtBoundaries) {
  if (!greeneryGeoJSON || !Object.keys(districtBoundaries).length) return {}
  const qualityCats = new Set(['parks_recreation', 'forests_woods', 'natural_vegetation', 'protected_conservation'])
  const qualityFeatures = greeneryGeoJSON.features.filter(f =>
    qualityCats.has(f.properties._categoryId) &&
    (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )
  const raw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { raw[name] = 0; continue }
    const rings = districtRings(gj)
    let score = 0
    for (const f of qualityFeatures) {
      if (featureIntersectsDistrict(f, rings)) {
        score += 3
      } else if (featureNearDistrict(f, rings, 0.010)) {
        score += 1
      }
    }
    raw[name] = score
  }
  return normalize10(raw)
}

// ── Analysis 4 — Encounter Potential Index ────────────────────────────────────
// Composite: green quality (35%) + social amenities (30%) + transit (20%) + paths (15%)

const DEFAULT_ENCOUNTER_WEIGHTS = { green: 35, social: 30, transit: 20, paths: 15 }

export function computeEncounterPotential(
  greeneryGeoJSON,
  socialGeoJSON,
  transitGeoJSON,
  districtBoundaries,
  coverageWeights = COVERAGE_WEIGHTS,
  encounterWeights = DEFAULT_ENCOUNTER_WEIGHTS,
) {
  const ew = encounterWeights ?? DEFAULT_ENCOUNTER_WEIGHTS
  const greenScores  = computeGreenCoverageScores(greeneryGeoJSON, districtBoundaries, coverageWeights)
  const socialScores = computeSocialDensityScores(socialGeoJSON,   districtBoundaries)

  // Transit stop density per district
  const transitRaw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { transitRaw[name] = 0; continue }
    const rings = districtRings(gj)
    const area  = districtArea(rings)
    const count = (transitGeoJSON?.features || []).filter(f => {
      const [lng, lat] = f.geometry.coordinates
      return pointInDistrict(lng, lat, rings)
    }).length
    transitRaw[name] = area > 0 ? count / Math.sqrt(area * 1e6) : 0
  }
  const transitScores = normalize10(transitRaw)

  // Pedestrian path density per district
  const pathFeatures = (greeneryGeoJSON?.features || []).filter(f =>
    f.properties._categoryId === 'network' &&
    ['footway', 'path', 'pedestrian', 'living_street', 'steps'].includes(f.properties._tagValue)
  )
  const pathRaw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { pathRaw[name] = 0; continue }
    const rings = districtRings(gj)
    const area  = districtArea(rings)
    const count = pathFeatures.filter(f => featureIntersectsDistrict(f, rings)).length
    pathRaw[name] = area > 0 ? count / Math.sqrt(area * 1e6) : 0
  }
  const pathScores = normalize10(pathRaw)

  const total = (ew.green + ew.social + ew.transit + ew.paths) || 100
  const raw = {}
  for (const { name } of DISTRICTS) {
    raw[name] =
      (ew.green   / total) * (greenScores[name]   ?? 0) +
      (ew.social  / total) * (socialScores[name]  ?? 0) +
      (ew.transit / total) * (transitScores[name] ?? 0) +
      (ew.paths   / total) * (pathScores[name]    ?? 0)
  }
  return normalize10(raw)
}

// ── Color palettes per analysis type ─────────────────────────────────────────

const PALETTES = {
  coverage:     ['#F1FAF4','#D4EDDA','#A8D5B5','#74C69D','#52B788','#40916C','#2D6A4F','#1B4332'],
  social:       ['#FDF4FF','#E9D8FD','#D6BCF9','#B794F4','#9F7AEA','#805AD5','#6B46C1','#553C9A'],
  encounter:    ['#FFFAF0','#FEEBC8','#FBD38D','#F6AD55','#ED8936','#DD6B20','#C05621','#9C4221'],
  accessibility:['#EBF8FF','#BEE3F8','#90CDF4','#63B3ED','#4299E1','#3182CE','#2B6CB0','#2C5282'],
}

export function scoreToGSAColor(score, type) {
  const pal = PALETTES[type] || PALETTES.coverage
  const idx = Math.min(Math.floor((Math.max(0, score) / 10) * (pal.length - 1)), pal.length - 1)
  return pal[idx]
}

// ── Insight generation ────────────────────────────────────────────────────────

const ANALYSIS_LABELS = {
  coverage:     'green coverage',
  social:       'social infrastructure',
  encounter:    'encounter potential',
  accessibility:'green accessibility',
}

export function generateInsights(scores, type) {
  const entries = Object.entries(scores)
    .filter(([, v]) => isFinite(v) && v >= 0)
    .sort(([, a], [, b]) => b - a)
  if (!entries.length) return []

  const top    = entries.slice(0, 3).map(([n]) => n)
  const bottom = entries.slice(-3).map(([n]) => n).reverse()
  const avg    = entries.reduce((s, [, v]) => s + v, 0) / entries.length
  const zero   = entries.filter(([, v]) => v === 0).length
  const label  = ANALYSIS_LABELS[type] || type

  const out = [
    `Highest ${label}: ${top.join(' · ')}`,
    `Lowest ${label}: ${bottom.join(' · ')}`,
    `City average: ${avg.toFixed(1)} / 10 across ${entries.length} districts`,
  ]
  if (zero > 2) out.push(`${zero} districts show no measurable ${label} — priority intervention zones.`)
  return out
}
