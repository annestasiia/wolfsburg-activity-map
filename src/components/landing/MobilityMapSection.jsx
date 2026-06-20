import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM = 12
const CENTER_LAT = 52.42
const BBOX = [10.50, 52.26, 11.10, 52.62]

const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

export const TABS = [
  { label: 'Activity Map', id: 'activity' },
  { label: 'Auto',         id: 'auto'     },
  { label: 'Public',       id: 'public'   },
  { label: 'Cycling',      id: 'cycling'  },
]

// ── Original automobile road colors ──────────────────────────────────────────
const ROAD_COLOR_EXPR = ['match', ['get', 'highway'],
  'motorway',      '#FF2D55',  'motorway_link', '#FF2D55',
  'trunk',         '#FF6B00',  'trunk_link',    '#FF6B00',
  'primary',       '#FF9500',  'primary_link',  '#FF9500',
  'secondary',     '#FFCC00',  'secondary_link','#FFCC00',
  '#AAAAAA',
]
const ROAD_WIDTH_EXPR = ['match', ['get', 'highway'],
  'motorway', 3.5, 'motorway_link', 2.5,
  'trunk', 3,      'trunk_link',    2,
  'primary', 2.5,  'primary_link',  1.5,
  'secondary', 2,  'secondary_link',1.5,
  1.2,
]

// ── District fill: original red gradient ──────────────────────────────────────
function scoreToFill(n) {
  const s = n * 10
  if (s <= 0)  return '#F5F5F5'
  if (s <= 2)  return '#FDE8EC'
  if (s <= 4)  return '#F7B8C4'
  if (s <= 6)  return '#F07090'
  if (s <= 8)  return '#E03060'
  return '#C01040'
}

// ── Road density → district score ─────────────────────────────────────────────
function computeDistrictRoadScores(roads, districtBoundaries) {
  if (!roads?.features?.length || !Object.keys(districtBoundaries).length) return {}
  const roadFirst = roads.features.map(f => f.geometry?.coordinates?.[0]).filter(Boolean)
  const scores = {}
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    const addCoord = ([lo, la]) => {
      if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo
      if (la < minLat) minLat = la; if (la > maxLat) maxLat = la
    }
    for (const f of fc.features) {
      const g = f.geometry
      if (!g) continue
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(addCoord))
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(addCoord)))
    }
    let count = 0
    for (const [lon, lat] of roadFirst) {
      if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) count++
    }
    scores[name] = count
  }
  const maxV = Math.max(...Object.values(scores), 1)
  const result = {}
  for (const [name, v] of Object.entries(scores)) result[name] = v / maxV
  return result
}

// ── Zoom-adaptive SQUARE graticule ───────────────────────────────────────────
// lonStep/latStep chosen so cells are visually square in Mercator at 52°N
// cos(52.4°) ≈ 0.609, so latStep ≈ lonStep × 0.609
const GRID_PRESETS = [
  // [minZoom, lonStep, latStep]
  [14, 0.005, 0.003],
  [13, 0.01,  0.006],
  [12, 0.025, 0.015],
  [11, 0.05,  0.03 ],
  [10, 0.1,   0.06 ],
  [9,  0.2,   0.12 ],
  [8,  0.5,   0.3  ],
  [0,  1.0,   0.6  ],
]

function getGridSteps(zoom) {
  for (const [minZ, lonStep, latStep] of GRID_PRESETS) {
    if (zoom >= minZ) return { lonStep, latStep }
  }
  return { lonStep: 1.0, latStep: 0.6 }
}

function buildGraticule(lonStep, latStep) {
  const [minLon, minLat, maxLon, maxLat] = BBOX
  const features = []
  for (let lat = Math.ceil(minLat / latStep) * latStep; lat <= maxLat; lat = parseFloat((lat + latStep).toFixed(8))) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[minLon, lat], [maxLon, lat]] }, properties: {} })
  }
  for (let lon = Math.ceil(minLon / lonStep) * lonStep; lon <= maxLon; lon = parseFloat((lon + lonStep).toFixed(8))) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, minLat], [lon, maxLat]] }, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

// ── Car parking SVG markers (× cross + orange glow) ──────────────────────────
function parkingStroke(type) {
  if (type === 'multi-storey') return '#5C5C5C'
  if (type === 'underground')  return '#808080'
  return '#1D1D1F'
}
const GLOW_R = { small: 11, medium: 16, large: 22 }
function capBin(cap) { const n = parseInt(cap) || 0; return n >= 200 ? 'large' : n >= 40 ? 'medium' : 'small' }

function makeParkingEl(type, capacity) {
  const stroke = parkingStroke(type)
  const gR = GLOW_R[capBin(capacity)]
  const cR = 7, pad = 5
  const size = (gR + pad) * 2, half = size / 2, cross = 4.5
  const uid = `p${Math.random().toString(36).slice(2, 7)}`
  const el = document.createElement('div')
  el.style.cssText = `width:${size}px;height:${size}px;pointer-events:none`
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="display:block">
  <defs><filter id="${uid}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
  <circle cx="${half}" cy="${half}" r="${gR}" fill="#FFB300" opacity="0.45" filter="url(#${uid})"/>
  <circle cx="${half}" cy="${half}" r="${cR}" fill="white" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="${half-cross}" y1="${half-cross}" x2="${half+cross}" y2="${half+cross}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="${half+cross}" y1="${half-cross}" x2="${half-cross}" y2="${half+cross}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
  return el
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MobilityMapSection({ tab = 'auto', onTabChange }) {
  const mapDivRef  = useRef(null)
  const mapRef     = useRef(null)
  const markersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  const { roads, districtBoundaries, localCarParkings, localBusStops, localCycling, localBikeParkings } = useAppStore()

  const districtScores = useMemo(
    () => computeDistrictRoadScores(roads, districtBoundaries),
    [roads, districtBoundaries],
  )

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: BLANK_STYLE,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
    mapRef.current = map

    map.on('load', () => {
      // Adaptive square dashed graticule
      const { lonStep, latStep } = getGridSteps(ZOOM)
      map.addSource('grid', { type: 'geojson', data: buildGraticule(lonStep, latStep) })
      map.addLayer({
        id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#CECECE', 'line-width': 0.6, 'line-opacity': 0.75, 'line-dasharray': [5, 5] },
      })

      // District fill + black thin outline
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: { 'fill-color': '#F5F5F5', 'fill-opacity': 1 } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts', paint: { 'line-color': '#1D1D1F', 'line-width': 0.4, 'line-opacity': 0.6 } })

      // City boundary (thicker black)
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary', paint: { 'line-color': '#1D1D1F', 'line-width': 2.5, 'line-opacity': 0.95 } })

      // Roads (Auto + Public)
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'roads-line', type: 'line', source: 'roads', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROAD_COLOR_EXPR, 'line-width': ROAD_WIDTH_EXPR, 'line-opacity': 0.85 } })

      // Bus stops (Public)
      map.addSource('bus-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bus-stops-circle', type: 'circle', source: 'bus-stops', layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': '#0077FF', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 } })

      // Cycling routes (Cycling)
      map.addSource('cycling-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cycling-line', type: 'line', source: 'cycling-routes', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#00C853', 'line-width': 2, 'line-opacity': 0.8 } })

      // Bike parking (Cycling)
      map.addSource('bike-parking', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bike-parking-circle', type: 'circle', source: 'bike-parking', layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': '#00897B', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.85 } })

      setMapReady(true)
    })

    // Update graticule on zoom (throttled to one RAF per zoom event burst)
    let gridPending = false
    map.on('zoom', () => {
      if (gridPending) return
      gridPending = true
      requestAnimationFrame(() => {
        gridPending = false
        if (!map.getSource('grid')) return
        const { lonStep, latStep } = getGridSteps(map.getZoom())
        map.getSource('grid').setData(buildGraticule(lonStep, latStep))
      })
    })

    return () => { markersRef.current.forEach(m => m.remove()); map.remove(); mapRef.current = null }
  }, [])

  // ── Fetch city boundary from Overpass ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
    const q = `[out:json][timeout:30];relation["boundary"="administrative"]["name"="Wolfsburg"]["admin_level"="6"];out geom;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: `data=${encodeURIComponent(q)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) mapRef.current?.getSource('city-boundary')?.setData(osmtogeojson(data)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mapReady])

  // ── Populate district polygons ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      if (!fc?.features) continue
      for (const f of fc.features) features.push({ ...f, properties: { ...f.properties, districtName: name } })
    }
    mapRef.current.getSource('districts')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, districtBoundaries])

  // ── Load static GeoJSON into map sources ──────────────────────────────────
  useEffect(() => { if (mapReady && roads) mapRef.current?.getSource('roads')?.setData(roads) }, [mapReady, roads])
  useEffect(() => { if (mapReady && localBusStops) mapRef.current?.getSource('bus-stops')?.setData(localBusStops) }, [mapReady, localBusStops])
  useEffect(() => { if (mapReady && localCycling) mapRef.current?.getSource('cycling-routes')?.setData(localCycling) }, [mapReady, localCycling])
  useEffect(() => { if (mapReady && localBikeParkings) mapRef.current?.getSource('bike-parking')?.setData(localBikeParkings) }, [mapReady, localBikeParkings])

  // ── Tab → layer visibility + choropleth ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isAuto   = tab === 'auto'
    const isPublic = tab === 'public'
    const isCycling = tab === 'cycling'

    const setVis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    setVis('roads-line',        isAuto || isPublic)
    setVis('bus-stops-circle',  isPublic)
    setVis('cycling-line',      isCycling)
    setVis('bike-parking-circle', isCycling)
    setVis('district-fill',     !isCycling)

    if (map.getLayer('district-fill')) {
      if ((isAuto || isPublic) && Object.keys(districtScores).length) {
        map.setPaintProperty('district-fill', 'fill-color', [
          'match', ['get', 'districtName'],
          ...Object.entries(districtScores).flatMap(([n, s]) => [n, scoreToFill(s)]),
          '#F5F5F5',
        ])
        map.setPaintProperty('district-fill', 'fill-opacity', 0.80)
      } else {
        map.setPaintProperty('district-fill', 'fill-color', '#F5F5F5')
        map.setPaintProperty('district-fill', 'fill-opacity', 1)
      }
    }
  }, [mapReady, tab, districtScores])

  // ── Car parking markers — Auto tab only ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (tab !== 'auto' || !localCarParkings?.features?.length) return
    const map = mapRef.current
    const VALID = new Set(['surface', 'multi-storey', 'underground'])
    for (const f of localCarParkings.features) {
      const p = f.properties || {}
      if (!VALID.has(p.parking)) continue
      if (p.parking === 'surface' && (parseInt(p.capacity) || 0) < 30) continue
      const coords = f.geometry?.coordinates
      if (!coords) continue
      const [lng, lat] = Array.isArray(coords[0]) ? [coords[0][0], coords[0][1]] : coords
      if (!lng || !lat) continue
      markersRef.current.push(
        new maplibregl.Marker({ element: makeParkingEl(p.parking, p.capacity), anchor: 'center' })
          .setLngLat([lng, lat]).addTo(map)
      )
    }
  }, [mapReady, tab, localCarParkings])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Tab toolbar ─────────────────────────────────────────────────── */}
      {mapReady && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          zIndex: 10,
          whiteSpace: 'nowrap',
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
