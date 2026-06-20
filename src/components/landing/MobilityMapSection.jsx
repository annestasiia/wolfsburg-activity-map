import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM = 12

// Glyphs needed for district label text symbols
const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

export const TABS = [
  { label: 'Activity Map', id: 'activity' },
  { label: 'Auto',         id: 'auto'     },
  { label: 'Public',       id: 'public'   },
  { label: 'Cycling',      id: 'cycling'  },
]

// ── Road widths for Auto tab (blue, hierarchy-based) ─────────────────────────
const BLUE_ROAD_WIDTH = ['match', ['get', 'highway'],
  'motorway', 5,    'motorway_link', 3.5,
  'trunk',    4,    'trunk_link',    2.5,
  'primary',  3,    'primary_link',  2,
  'secondary',2,    'secondary_link',1.5,
  'tertiary', 1.5,  'tertiary_link', 1,
  1,
]

// ── Auto tab: pink road glow (#FF1493), time-varying width ────────────────────
function makeAutoGlowWidth(factor) {
  const g = (base) => base + 3 + Math.round((factor - 1.0) * 3)
  return ['match', ['get', 'highway'],
    'motorway', g(5),   'motorway_link', g(3.5),
    'trunk',    g(4),   'trunk_link',    g(2.5),
    'primary',  g(3),   'primary_link',  g(2),
    'secondary',g(2),   'secondary_link',g(1.5),
    'tertiary', g(1.5), 'tertiary_link', g(1),
    g(1),
  ]
}

// ── Traffic factor from day + time ────────────────────────────────────────────
function trafficFactor(day, time) {
  const h = parseInt((time || '08:00').split(':')[0]) || 8
  const weekend = ['Sat', 'Sun'].includes(day)
  if (weekend) {
    if (h >= 10 && h <= 18) return 2.2
    if (h >= 18 && h <= 21) return 1.8
    return 1.2
  }
  if ((h >= 7 && h <= 9) || (h >= 16 && h <= 19)) return 3.0
  if (h >= 6 && h <= 22) return 1.8
  return 1.0
}

// ── District fill: yellow gradient ────────────────────────────────────────────
function scoreToYellow(n) {
  const g = Math.round(243 + 9   * (1 - n))
  const b = Math.round(181 * (1 - n))
  return `rgb(255,${g},${b})`
}

// ── Road density → district score ─────────────────────────────────────────────
function computeDistrictRoadScores(roads, districtBoundaries) {
  if (!roads?.features?.length || !Object.keys(districtBoundaries).length) return {}
  const roadFirst = roads.features.map(f => f.geometry?.coordinates?.[0]).filter(Boolean)
  const scores = {}
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    const add = ([lo, la]) => {
      if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo
      if (la < minLat) minLat = la; if (la > maxLat) maxLat = la
    }
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(add))
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(add)))
    }
    let count = 0
    for (const [lon, lat] of roadFirst)
      if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) count++
    scores[name] = count
  }
  const maxV = Math.max(...Object.values(scores), 1)
  const out = {}
  for (const [name, v] of Object.entries(scores)) out[name] = v / maxV
  return out
}

// ── District centroid points for labels ───────────────────────────────────────
function buildDistrictCentroids(districtBoundaries) {
  const features = []
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    let sumLon = 0, sumLat = 0, count = 0
    const visit = ([lo, la]) => { sumLon += lo; sumLat += la; count++ }
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(visit))
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(visit)))
    }
    if (count > 0) features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [sumLon / count, sumLat / count] },
      properties: { name },
    })
  }
  return { type: 'FeatureCollection', features }
}

// ── Square graticule: ≈1km cells, very large bbox for "infinite" appearance ───
// At 52°N: lonStep=0.015° ≈ 1.02km, latStep=0.009° ≈ 0.995km → square in Mercator
function buildGraticule() {
  const features = []
  const lonStep = 0.015, latStep = 0.009
  const [minLon, maxLon, minLat, maxLat] = [8.0, 15.0, 49.0, 56.0] // large area = "infinite"
  for (let lat = Math.ceil(minLat / latStep) * latStep; lat <= maxLat; lat = parseFloat((lat + latStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[minLon, lat], [maxLon, lat]] }, properties: {} })
  for (let lon = Math.ceil(minLon / lonStep) * lonStep; lon <= maxLon; lon = parseFloat((lon + lonStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, minLat], [lon, maxLat]] }, properties: {} })
  return { type: 'FeatureCollection', features }
}

// ── City mask: inverted polygon — white fill outside city boundary ─────────────
function buildCityMask(cityGeoJSON) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const holes = []
  for (const f of (cityGeoJSON?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => holes.push([...poly[0]].reverse()))
  }
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return { type: 'FeatureCollection', features: [{
    type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] }, properties: {},
  }] }
}

// ── Point-in-polygon ───────────────────────────────────────────────────────────
function pointInRing([px, py], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function isInsideCity(lng, lat, cityGeo) {
  if (!cityGeo?.features?.length) return true
  for (const f of cityGeo.features) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon' && pointInRing([lng, lat], g.coordinates[0])) return true
    if (g.type === 'MultiPolygon') for (const poly of g.coordinates) if (pointInRing([lng, lat], poly[0])) return true
  }
  return false
}

// ── Parking: polygon → centroid Point, clipped to city ────────────────────────
function centroid(g) {
  if (!g) return null
  if (g.type === 'Point') return g.coordinates
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null
  if (!ring?.length) return null
  return [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length]
}
function parkingToPoints(geoJSON, cityGeo) {
  const features = []
  for (const f of (geoJSON?.features || [])) {
    const coords = centroid(f.geometry)
    if (!coords || !isInsideCity(coords[0], coords[1], cityGeo)) continue
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: f.properties || {} })
  }
  return { type: 'FeatureCollection', features }
}

// ── Activity heat grid ─────────────────────────────────────────────────────────
// 500m × 500m invisible grid, proportional circles (50–240m radius) per cell.
// At 52.42°N: 500m ≈ 0.004524° lat, 500m ≈ 0.007382° lon
const ACT_LAT = 0.004524, ACT_LON = 0.007382
const ACT_MIN_R = 50, ACT_MAX_R = 240  // meters — max 240 leaves ~20m gap at full size

function buildActivityGrid(roads, busStops, carParkings, bikeParkings, cycling, cityGeo) {
  if (!cityGeo?.features?.length) return { type: 'FeatureCollection', features: [] }
  const [minLon, maxLon, minLat, maxLat] = [10.55, 10.95, 52.35, 52.60]
  const rowOf = lat => Math.round((lat - minLat) / ACT_LAT)
  const colOf = lon => Math.round((lon - minLon) / ACT_LON)
  const key   = (r, c) => `${r}|${c}`

  // Pre-populate all cells inside city
  const grid = new Map()
  const rows = Math.ceil((maxLat - minLat) / ACT_LAT)
  const cols = Math.ceil((maxLon - minLon) / ACT_LON)
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const lat = minLat + r * ACT_LAT, lon = minLon + c * ACT_LON
      if (isInsideCity(lon, lat, cityGeo)) grid.set(key(r, c), { lat, lon, score: 0 })
    }
  }

  // Spread score from a feature point into adjacent cells (distance-weighted)
  const addScore = (lon, lat, w) => {
    const rc = rowOf(lat), cc = colOf(lon)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cell = grid.get(key(rc + dr, cc + dc))
      if (cell) cell.score += w / (1 + (dr * dr + dc * dc) * 0.5)
    }
  }

  const RW = { motorway: 5, trunk: 4.5, primary: 3.5, secondary: 2.5, tertiary: 1.5, residential: 1, cycleway: 1.5 }
  for (const f of roads?.features || []) {
    const w = RW[f.properties?.highway] || 0.8
    const coords = f.geometry?.coordinates || []
    for (let i = 0; i < coords.length; i += 2) addScore(coords[i][0], coords[i][1], w)
  }
  for (const f of busStops?.features || []) {
    const [lon, lat] = f.geometry?.coordinates || []; if (lat) addScore(lon, lat, 20)
  }
  for (const f of carParkings?.features || []) {
    if (f.geometry?.type === 'Point') {
      addScore(f.geometry.coordinates[0], f.geometry.coordinates[1], 8)
    } else {
      const ring = f.geometry?.coordinates?.[0]
      if (ring?.length) addScore(ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length, 8)
    }
  }
  for (const f of bikeParkings?.features || []) {
    const [lon, lat] = f.geometry?.coordinates || []; if (lat) addScore(lon, lat, 4)
  }
  for (const f of cycling?.features || []) {
    const lines = f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates
      : f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : []
    for (const line of lines) for (let i = 0; i < line.length; i += 4) addScore(line[i][0], line[i][1], 2)
  }

  const cells = [...grid.values()]
  const sorted = cells.map(c => c.score).sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1  // cap outliers

  return {
    type: 'FeatureCollection',
    features: cells.map(({ lat, lon, score }) => {
      const t = Math.sqrt(Math.min(score, p95) / p95)  // sqrt → perceptual uniformity
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { radius_m: Math.round(ACT_MIN_R + t * (ACT_MAX_R - ACT_MIN_R)) },
      }
    }),
  }
}

// ── Fetch bus routes from Overpass ────────────────────────────────────────────
// "way(r)" gets only the way members of each relation with their geometry —
// much lighter than ">;" which also pulls all constituent nodes.
async function fetchBusRoutes() {
  const q = `[out:json][timeout:60];relation["route"="bus"](52.32,10.60,52.56,11.00);way(r);out geom;`
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: `data=${encodeURIComponent(q)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const raw = osmtogeojson(await r.json())
  const features = raw.features.filter(f =>
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  )
  return { type: 'FeatureCollection', features }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MobilityMapSection({ tab = 'auto', onTabChange }) {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const busRoutesFetchedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [cityGeoJSON, setCityGeoJSON] = useState(null)

  const {
    roads, districtBoundaries,
    localCarParkings, localBusStops, localCycling, localBikeParkings, localCyclingOfficial,
    selectedDay, selectedTime,
    landingCityGeoJSON, setLandingCityGeoJSON,
    landingBusRoutes, setLandingBusRoutes,
  } = useAppStore()

  const districtScores = useMemo(
    () => computeDistrictRoadScores(roads, districtBoundaries),
    [roads, districtBoundaries],
  )

  // Proportional symbol grid — recomputes once all transport data + city boundary are loaded
  const activityGrid = useMemo(
    () => buildActivityGrid(roads, localBusStops, localCarParkings, localBikeParkings, localCyclingOfficial, cityGeoJSON),
    [roads, localBusStops, localCarParkings, localBikeParkings, localCyclingOfficial, cityGeoJSON],
  )

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: BLANK_STYLE,
      center: CENTER, zoom: ZOOM, attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
    mapRef.current = map

    map.on('load', () => {
      // ── DATA LAYERS (below the white city mask) ──────────────────────────

      // District fill (shown only in Public tab)
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#FFFCB5', 'fill-opacity': 0.9 } })

      // District outline (always visible in all tabs)
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#1D1D1F', 'line-width': 0.5, 'line-opacity': 0.7 } })

      // Activity Map: proportional symbol circles (Activity tab)
      // radius_m property (50–240m) → zoom-dependent pixel size
      // Scale: at 52.42°N, 1m ≈ 1/23.25 px at zoom 12, doubles each zoom level
      map.addSource('activity-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'activity-circles', type: 'circle', source: 'activity-grid',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#1D1D1F',
          'circle-opacity': 0.10,
          'circle-stroke-color': '#1D1D1F',
          'circle-stroke-width': 0.8,
          'circle-stroke-opacity': 0.55,
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'],
            9,  ['*', ['get', 'radius_m'], 0.00536],
            10, ['*', ['get', 'radius_m'], 0.01073],
            11, ['*', ['get', 'radius_m'], 0.02146],
            12, ['*', ['get', 'radius_m'], 0.04301],
            13, ['*', ['get', 'radius_m'], 0.08602],
            14, ['*', ['get', 'radius_m'], 0.17204],
            15, ['*', ['get', 'radius_m'], 0.34408],
          ],
        },
      })

      // Parking halo (Auto — capacity-scaled pink circle, behind dot)
      map.addSource('parking', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'parking-halo', type: 'circle', source: 'parking',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#FF99CC', 'circle-opacity': 0.35, 'circle-stroke-width': 0,
          'circle-radius': [
            'interpolate', ['linear'],
            ['to-number', ['coalesce', ['get', 'capacity'], 0]],
            0, 9, 20, 12, 50, 16, 150, 20, 300, 26,
          ],
        },
      })

      // Bus route glow (Public — #ff6464, behind red route line)
      map.addSource('bus-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bus-routes-glow', type: 'line', source: 'bus-routes',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ff6464', 'line-width': 8, 'line-opacity': 0.55 } })

      // Bus route line (Public — #C10016, on top of glow)
      map.addLayer({ id: 'bus-routes-line', type: 'line', source: 'bus-routes',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#C10016', 'line-width': 2, 'line-opacity': 0.9 } })

      // Auto road glow (#FF1493, behind blue line)
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'roads-glow', type: 'line', source: 'roads',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FF1493', 'line-width': makeAutoGlowWidth(1.8), 'line-opacity': 0.65 } })

      // Auto road line (blue, on top of glow)
      map.addLayer({ id: 'roads-line', type: 'line', source: 'roads',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0000FF', 'line-width': BLUE_ROAD_WIDTH, 'line-opacity': 0.9 } })

      // Parking dot (Auto — purple, small, no stroke, above halo)
      map.addLayer({ id: 'parking-dot', type: 'circle', source: 'parking',
        layout: { visibility: 'none' },
        paint: { 'circle-color': '#5539CC', 'circle-radius': 2, 'circle-opacity': 0.95, 'circle-stroke-width': 0 } })

      // Bus stop halo (Public — #ff6464, time-varying radius)
      map.addSource('bus-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bus-stops-halo', type: 'circle', source: 'bus-stops',
        layout: { visibility: 'none' },
        paint: { 'circle-color': '#ff6464', 'circle-radius': 8, 'circle-opacity': 0.30, 'circle-stroke-width': 0 } })

      // Bus stop circle (Public — red, same small size as parking dot)
      map.addLayer({ id: 'bus-stops-circle', type: 'circle', source: 'bus-stops',
        layout: { visibility: 'none' },
        paint: { 'circle-color': '#C10016', 'circle-radius': 2, 'circle-opacity': 0.95, 'circle-stroke-width': 0 } })

      // Cycling routes — official city data (Cycling tab)
      // Buffer: teal #71BC68, zoom-dependent ~400m total width (200m each side)
      // At 52°N ground res ≈ 23.25 m/px at zoom 12 → 400m ≈ 17.2px, doubles each zoom level
      map.addSource('cycling-official', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cycling-official-buffer', type: 'line', source: 'cycling-official',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#71BC68', 'line-opacity': 0.35,
          'line-width': ['interpolate', ['exponential', 2], ['zoom'],
            10, 4.3, 11, 8.6, 12, 17.2, 13, 34.4, 14, 68.8, 15, 137.6],
        } })
      map.addLayer({ id: 'cycling-official-line', type: 'line', source: 'cycling-official',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#004225', 'line-width': 1.5, 'line-opacity': 0.9 } })

      // Bike parking halo — #71BC68, zoom-dependent ~400m radius
      map.addSource('bike-parking', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bike-parking-halo', type: 'circle', source: 'bike-parking',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#71BC68', 'circle-opacity': 0.25, 'circle-stroke-width': 0,
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'],
            10, 4.3, 11, 8.6, 12, 17.2, 13, 34.4, 14, 68.8, 15, 137.6],
        } })
      // Bike parking dot — dark green #004225, same size as car parking dot
      map.addLayer({ id: 'bike-parking-circle', type: 'circle', source: 'bike-parking',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 2, 'circle-color': '#004225', 'circle-opacity': 0.95, 'circle-stroke-width': 0 } })

      // ── WHITE MASK — hides everything above except grid/labels/boundary ──
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // ── ABOVE MASK (visible everywhere) ─────────────────────────────────

      // Square dashed graticule — added ABOVE mask so it extends outside city ("infinite")
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.6, 'line-dasharray': [4, 6] } })

      // District name labels (above mask, centroids are inside city anyway)
      map.addSource('district-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'district-labels', type: 'symbol', source: 'district-centroids',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 9,
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85, 'text-halo-width': 0 },
      })

      // City boundary line — topmost, thicker
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })

      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── City boundary: localStorage → store cache → Overpass (in that order) ──
  // localStorage persists across page reloads so Overpass is only hit once ever.
  useEffect(() => {
    if (!mapReady) return

    function applyCity(gj) {
      setCityGeoJSON(gj)
      setLandingCityGeoJSON(gj)
      mapRef.current?.getSource('city-boundary')?.setData(gj)
      mapRef.current?.getSource('city-mask')?.setData(buildCityMask(gj))
    }

    // 1. In-session store cache (component remount within same page load)
    if (landingCityGeoJSON) {
      applyCity(landingCityGeoJSON)
      return
    }

    // 2. localStorage cache (persists across page reloads)
    try {
      const raw = localStorage.getItem('wolfsburg_city_boundary_v1')
      if (raw) {
        applyCity(JSON.parse(raw))
        return
      }
    } catch (_) {}

    // 3. Fetch from Overpass (first ever load)
    let cancelled = false
    const q = `[out:json][timeout:30];relation["boundary"="administrative"]["name"="Wolfsburg"]["admin_level"="6"];out geom;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: `data=${encodeURIComponent(q)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const gj = osmtogeojson(data)
        try { localStorage.setItem('wolfsburg_city_boundary_v1', JSON.stringify(gj)) } catch (_) {}
        applyCity(gj)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mapReady, landingCityGeoJSON])

  // ── Bus routes: use store cache, fetch only once per session ─────────────
  useEffect(() => {
    if (!mapReady || tab !== 'public') return
    if (landingBusRoutes) {
      // Already fetched — apply from cache immediately
      mapRef.current?.getSource('bus-routes')?.setData(landingBusRoutes)
      return
    }
    if (busRoutesFetchedRef.current) return
    busRoutesFetchedRef.current = true
    fetchBusRoutes()
      .then(gj => {
        setLandingBusRoutes(gj)  // cache in store
        mapRef.current?.getSource('bus-routes')?.setData(gj)
      })
      .catch(() => { busRoutesFetchedRef.current = false })  // allow retry on error
  }, [mapReady, tab, landingBusRoutes])

  // ── District polygons + centroids ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      if (!fc?.features) continue
      for (const f of fc.features) features.push({ ...f, properties: { ...f.properties, districtName: name } })
    }
    mapRef.current.getSource('districts')?.setData({ type: 'FeatureCollection', features })
    mapRef.current.getSource('district-centroids')?.setData(buildDistrictCentroids(districtBoundaries))
  }, [mapReady, districtBoundaries])

  // ── Static data sources ────────────────────────────────────────────────────
  useEffect(() => { if (mapReady && roads)                mapRef.current?.getSource('roads')?.setData(roads) },                [mapReady, roads])
  useEffect(() => { if (mapReady && localBusStops)        mapRef.current?.getSource('bus-stops')?.setData(localBusStops) },    [mapReady, localBusStops])
  useEffect(() => { if (mapReady && localCyclingOfficial) mapRef.current?.getSource('cycling-official')?.setData(localCyclingOfficial) }, [mapReady, localCyclingOfficial])
  useEffect(() => {
    if (!mapReady || !localBikeParkings) return
    const features = localBikeParkings.features.filter(f => {
      const c = f.geometry?.coordinates
      return c && isInsideCity(c[0], c[1], cityGeoJSON)
    })
    mapRef.current?.getSource('bike-parking')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, localBikeParkings, cityGeoJSON])

  // ── Activity grid → map source ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activityGrid) return
    mapRef.current?.getSource('activity-grid')?.setData(activityGrid)
  }, [mapReady, activityGrid])

  // ── Parking (ALL, centroid Points, clipped to city) ────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !localCarParkings) return
    mapRef.current.getSource('parking')?.setData(parkingToPoints(localCarParkings, cityGeoJSON))
  }, [mapReady, localCarParkings, cityGeoJSON])

  // ── Tab → layer visibility + district choropleth ──────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isAuto    = tab === 'auto'
    const isPublic  = tab === 'public'
    const isCycling = tab === 'cycling'

    const setVis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    // Activity tab
    setVis('activity-circles', tab === 'activity')
    // Auto layers
    setVis('roads-glow',          isAuto)
    setVis('roads-line',          isAuto)
    setVis('parking-halo',        isAuto)
    setVis('parking-dot',         isAuto)
    // Public layers
    setVis('bus-routes-glow',     isPublic)
    setVis('bus-routes-line',     isPublic)
    setVis('bus-stops-halo',      isPublic)
    setVis('bus-stops-circle',    isPublic)
    // Cycling layers
    setVis('cycling-official-buffer', isCycling)
    setVis('cycling-official-line',   isCycling)
    setVis('bike-parking-halo',       isCycling)
    setVis('bike-parking-circle',     isCycling)
    // District fill hidden on all tabs — only outlines shown
    setVis('district-fill', false)
  }, [mapReady, tab, districtScores])

  // ── Time-driven: auto road glow + bus route glow + bus stop halo ──────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const f = trafficFactor(selectedDay, selectedTime)

    if (map.getLayer('roads-glow'))
      map.setPaintProperty('roads-glow', 'line-width', makeAutoGlowWidth(f))

    // Bus route glow: 5px (off-peak) → 11px (rush hour)
    const busGlowW = 2 + 3 + Math.round((f - 1.0) * 3)
    if (map.getLayer('bus-routes-glow'))
      map.setPaintProperty('bus-routes-glow', 'line-width', busGlowW)

    // Bus stop halo: 6px (off-peak) → 14px (rush hour)
    const busHaloR = Math.round(6 + (f - 1.0) * 4)
    if (map.getLayer('bus-stops-halo'))
      map.setPaintProperty('bus-stops-halo', 'circle-radius', busHaloR)
  }, [mapReady, selectedDay, selectedTime])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {mapReady && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          {TABS.map(({ label, id }) => (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              background: tab === id ? '#1D1D1F' : 'transparent',
              color:      tab === id ? '#fff'    : '#666',
              transition: 'background 0.15s, color 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
