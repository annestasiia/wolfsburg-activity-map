// ── Green Social Infrastructure Analysis ─────────────────────────────────────
// Pure computation functions — no side effects, no React imports.
// Used by: useGreenSocialData hook, GreenSocialPanel, MapView

import { computeBbox, inBbox, expandBbox } from './geoUtils'
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

function bboxArea(bbox) {
  return Math.abs((bbox.maxLng - bbox.minLng) * (bbox.maxLat - bbox.minLat))
}

function featureHitsBox(f, bbox) {
  const geom = f.geometry
  if (!geom) return false
  const test = ([lng, lat]) => inBbox(lng, lat, bbox)
  switch (geom.type) {
    case 'Point':           return test(geom.coordinates)
    case 'LineString':      return geom.coordinates.some(test)
    case 'MultiLineString': return geom.coordinates.some(seg => seg.some(test))
    case 'Polygon':         return (geom.coordinates[0] || []).some(test)
    case 'MultiPolygon':    return geom.coordinates.some(poly => (poly[0] || []).some(test))
    default:                return false
  }
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

export function computeGreenCoverageScores(greeneryGeoJSON, districtBoundaries) {
  if (!greeneryGeoJSON || !Object.keys(districtBoundaries).length) return {}
  const raw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { raw[name] = 0; continue }
    const bbox = computeBbox(gj)
    const area = bboxArea(bbox)
    let score = 0
    for (const f of greeneryGeoJSON.features) {
      const w = COVERAGE_WEIGHTS[f.properties._categoryId]
      if (!w) continue
      if (featureHitsBox(f, bbox)) score += w
    }
    raw[name] = area > 0 ? score / Math.sqrt(area * 1e6) : 0
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
    const bbox = computeBbox(gj)
    const area = bboxArea(bbox)
    let score = 0
    for (const f of socialGeoJSON.features) {
      const [lng, lat] = f.geometry.coordinates
      if (inBbox(lng, lat, bbox)) score += (f.properties._weight || 1)
    }
    raw[name] = area > 0 ? score / Math.sqrt(area * 1e6) : 0
  }
  return normalize10(raw)
}

// ── Analysis 3 — Green Space Accessibility Score ──────────────────────────────
// Quality green polygons within and near each district.

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
    const bbox     = computeBbox(gj)
    const nearBbox = expandBbox(bbox, 0.010) // ~800 m proxy buffer
    let score = 0
    for (const f of qualityFeatures) {
      if (!featureHitsBox(f, nearBbox)) continue
      // inside the district itself = higher value than just nearby
      score += featureHitsBox(f, bbox) ? 3 : 1
    }
    raw[name] = score
  }
  return normalize10(raw)
}

// ── Analysis 4 — Encounter Potential Index ────────────────────────────────────
// Composite: green quality (35%) + social amenities (30%) + transit (20%) + paths (15%)

export function computeEncounterPotential(
  greeneryGeoJSON,
  socialGeoJSON,
  transitGeoJSON,
  districtBoundaries
) {
  const greenScores  = computeGreenCoverageScores(greeneryGeoJSON, districtBoundaries)
  const socialScores = computeSocialDensityScores(socialGeoJSON,   districtBoundaries)

  // Transit density per district
  const transitRaw = {}
  for (const { name } of DISTRICTS) {
    const gj = districtBoundaries[name]
    if (!gj) { transitRaw[name] = 0; continue }
    const bbox  = computeBbox(gj)
    const area  = bboxArea(bbox)
    const count = (transitGeoJSON?.features || []).filter(f => {
      const [lng, lat] = f.geometry.coordinates
      return inBbox(lng, lat, bbox)
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
    const bbox = computeBbox(gj)
    const area = bboxArea(bbox)
    const count = pathFeatures.filter(f => featureHitsBox(f, bbox)).length
    pathRaw[name] = area > 0 ? count / Math.sqrt(area * 1e6) : 0
  }
  const pathScores = normalize10(pathRaw)

  const raw = {}
  for (const { name } of DISTRICTS) {
    raw[name] =
      0.35 * (greenScores[name]   ?? 0) +
      0.30 * (socialScores[name]  ?? 0) +
      0.20 * (transitScores[name] ?? 0) +
      0.15 * (pathScores[name]    ?? 0)
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
