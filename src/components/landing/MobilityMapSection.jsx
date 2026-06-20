import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM = 12

// White basemap — no tiles, just plain white
const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

const TABS = [
  { label: 'Activity Map', id: 'activity' },
  { label: 'Auto',         id: 'auto'     },
  { label: 'Public',       id: 'public'   },
  { label: 'Cycling',      id: 'cycling'  },
]

// ── Color helpers ─────────────────────────────────────────────────────────────

function highwayColor(highway) {
  // dark plum (#3F012C) = highest → berry (#990F4B) = lowest
  const t = {
    motorway: 0, motorway_link: 0,
    trunk: 0.2, trunk_link: 0.2,
    primary: 0.42, primary_link: 0.42,
    secondary: 0.60, secondary_link: 0.60,
    tertiary: 0.76, tertiary_link: 0.76,
  }[highway] ?? 0.92
  const r = Math.round(63  + 90  * t)
  const g = Math.round(1   + 14  * t)
  const b = Math.round(44  + 31  * t)
  return `rgb(${r},${g},${b})`
}

const ROAD_COLOR_EXPR = ['match', ['get', 'highway'],
  'motorway',      '#3F012C',
  'motorway_link', '#3F012C',
  'trunk',         '#591B30',
  'trunk_link',    '#591B30',
  'primary',       '#7A1A3A',
  'primary_link',  '#7A1A3A',
  'secondary',     '#8A1241',
  'secondary_link','#8A1241',
  'tertiary',      '#940E45',
  'tertiary_link', '#940E45',
  '#990F4B',
]
const ROAD_WIDTH_EXPR = ['match', ['get', 'highway'],
  'motorway', 3.5, 'motorway_link', 2.5,
  'trunk', 3, 'trunk_link', 2,
  'primary', 2.5, 'primary_link', 1.5,
  'secondary', 2, 'secondary_link', 1.5,
  'tertiary', 1.5, 'tertiary_link', 1,
  1,
]

function scoreToYellow(n) {
  // #FFF300 (n=1, most active) → #FFFCB5 (n=0, least active)
  const g = Math.round(243 + 9   * (1 - n))
  const b = Math.round(181 * (1 - n))
  return `rgb(255,${g},${b})`
}

// ── District road-score computation ──────────────────────────────────────────

function bboxFromFeatureCollection(fc) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  const visit = (coord) => {
    minLon = Math.min(minLon, coord[0]); maxLon = Math.max(maxLon, coord[0])
    minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1])
  }
  const walk = (g) => {
    if (!g) return
    if (g.type === 'Point') visit(g.coordinates)
    else if (g.type === 'LineString') g.coordinates.forEach(visit)
    else if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(visit))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(visit)))
  }
  fc?.features?.forEach(f => walk(f.geometry))
  return [minLon, minLat, maxLon, maxLat]
}

function computeDistrictRoadScores(roads, districtBoundaries) {
  if (!roads?.features?.length || !Object.keys(districtBoundaries).length) return {}
  const roadFirst = roads.features.map(f => f.geometry?.coordinates?.[0]).filter(Boolean)
  const scores = {}
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    const [minLon, minLat, maxLon, maxLat] = bboxFromFeatureCollection(fc)
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

// ── Parking marker factory ────────────────────────────────────────────────────

function parkingStroke(type) {
  if (type === 'multi-storey') return '#5C5C5C'
  if (type === 'underground')  return '#808080'
  return '#1D1D1F'
}

function capacityBin(cap) {
  const n = parseInt(cap) || 0
  if (n >= 200) return 'large'
  if (n >= 40)  return 'medium'
  return 'small'
}
const GLOW_R = { small: 11, medium: 16, large: 22 }

function makeParkingEl(type, capacity) {
  const stroke = parkingStroke(type)
  const gR = GLOW_R[capacityBin(capacity)]
  const cR = 7
  const pad = 5
  const size = (gR + pad) * 2
  const half = size / 2
  const cross = 4.5
  const uid = `p${Math.random().toString(36).slice(2, 7)}`
  const el = document.createElement('div')
  el.style.cssText = `width:${size}px;height:${size}px;cursor:default;pointer-events:none`
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="display:block">
  <defs>
    <filter id="${uid}">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <circle cx="${half}" cy="${half}" r="${gR}" fill="#FFB300" opacity="0.45" filter="url(#${uid})"/>
  <circle cx="${half}" cy="${half}" r="${cR}" fill="white" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="${half - cross}" y1="${half - cross}" x2="${half + cross}" y2="${half + cross}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="${half + cross}" y1="${half - cross}" x2="${half - cross}" y2="${half + cross}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
  return el
}

// ── Graticule (coordinate grid) ───────────────────────────────────────────────

function buildGraticule() {
  const features = []
  const latStep = 0.02, lonStep = 0.025
  const [minLon, maxLon, minLat, maxLat] = [10.60, 11.00, 52.32, 52.56]
  for (let lat = Math.ceil(minLat / latStep) * latStep; lat <= maxLat; lat = parseFloat((lat + latStep).toFixed(6))) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[minLon, lat], [maxLon, lat]] }, properties: {} })
  }
  for (let lon = Math.ceil(minLon / lonStep) * lonStep; lon <= maxLon; lon = parseFloat((lon + lonStep).toFixed(6))) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, minLat], [lon, maxLat]] }, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MobilityMapSection({ tab = 'auto', onTabChange }) {
  const mapDivRef  = useRef(null)
  const mapRef     = useRef(null)
  const markersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  const { roads, districtBoundaries, localCarParkings } = useAppStore()

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
      // Graticule grid
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid', paint: { 'line-color': '#E8E8E8', 'line-width': 0.5, 'line-opacity': 0.8 } })

      // Districts fill + outline
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: { 'fill-color': '#F9F9F9', 'fill-opacity': 1 } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts', paint: { 'line-color': '#CCCCCC', 'line-width': 0.6 } })

      // City boundary (black, loaded from Overpass)
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary', paint: { 'line-color': '#1D1D1F', 'line-width': 2, 'line-opacity': 0.9 } })

      // Roads
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'roads-line', type: 'line', source: 'roads', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROAD_COLOR_EXPR, 'line-width': ROAD_WIDTH_EXPR, 'line-opacity': 0.85 } })

      setMapReady(true)
    })
    return () => { markersRef.current.forEach(m => m.remove()); map.remove(); mapRef.current = null }
  }, [])

  // ── Fetch city boundary from Overpass ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
    const q = `[out:json][timeout:30];relation["name"="Wolfsburg"]["admin_level"="6"]["type"="boundary"];out geom;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(q)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const gj = osmtogeojson(data)
        const map = mapRef.current
        if (map?.getSource('city-boundary')) map.getSource('city-boundary').setData(gj)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mapReady])

  // ── Populate district source ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      if (!fc?.features) continue
      for (const f of fc.features) {
        features.push({ ...f, properties: { ...f.properties, districtName: name } })
      }
    }
    mapRef.current.getSource('districts')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, districtBoundaries])

  // ── Roads layer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !roads) return
    const map = mapRef.current
    if (map.getSource('roads')) map.getSource('roads').setData(roads)
  }, [mapReady, roads])

  // ── Tab changes: choropleth + layer visibility ─────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isAuto = tab === 'auto'

    // District fill — yellow choropleth in Auto mode
    if (Object.keys(districtScores).length && isAuto) {
      const expr = ['match', ['get', 'districtName'],
        ...Object.entries(districtScores).flatMap(([n, s]) => [n, scoreToYellow(s)]),
        '#F9F9F9',
      ]
      map.setPaintProperty('district-fill', 'fill-color', expr)
      map.setPaintProperty('district-fill', 'fill-opacity', 1)
    } else {
      map.setPaintProperty('district-fill', 'fill-color', '#F9F9F9')
      map.setPaintProperty('district-fill', 'fill-opacity', 1)
    }

    // Roads
    if (map.getLayer('roads-line')) {
      map.setLayoutProperty('roads-line', 'visibility', isAuto ? 'visible' : 'none')
    }
  }, [mapReady, tab, districtScores])

  // ── Parking markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (tab !== 'auto' || !localCarParkings?.features?.length) return
    const map = mapRef.current

    const VALID_TYPES = new Set(['surface', 'multi-storey', 'underground'])
    const markers = []
    for (const f of localCarParkings.features) {
      const p = f.properties || {}
      const type = p.parking
      if (!VALID_TYPES.has(type)) continue
      const cap = parseInt(p.capacity) || 0
      if (type === 'surface' && cap < 30) continue  // skip tiny surface lots
      const coords = f.geometry?.coordinates
      if (!coords) continue
      const [lng, lat] = Array.isArray(coords[0]) ? coords[0] : coords
      if (!lng || !lat) continue
      const el = makeParkingEl(type, p.capacity)
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
      markers.push(m)
    }
    markersRef.current = markers
  }, [mapReady, tab, localCarParkings])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Tab toolbar — top of map */}
      {mapReady && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E0E0E0',
          borderRadius: 8,
          padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          zIndex: 10,
        }}>
          {TABS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                background: tab === id ? '#1D1D1F' : 'transparent',
                color:      tab === id ? '#ffffff' : '#666',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
