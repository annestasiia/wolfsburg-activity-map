import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM = 12

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

// ── Road colors: dark plum (#3F012C) → berry (#990F4B) ───────────────────────
const ROAD_COLOR_EXPR = ['match', ['get', 'highway'],
  'motorway',      '#3F012C',  'motorway_link', '#3F012C',
  'trunk',         '#591B30',  'trunk_link',    '#591B30',
  'primary',       '#7A1A3A',  'primary_link',  '#7A1A3A',
  'secondary',     '#8A1241',  'secondary_link','#8A1241',
  'tertiary',      '#940E45',  'tertiary_link', '#940E45',
  '#990F4B',
]
const ROAD_WIDTH_EXPR = ['match', ['get', 'highway'],
  'motorway', 3.5, 'motorway_link', 2.5,
  'trunk', 3,      'trunk_link',    2,
  'primary', 2.5,  'primary_link',  1.5,
  'secondary', 2,  'secondary_link',1.5,
  'tertiary', 1.5, 'tertiary_link', 1,
  1,
]

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

// ── Static dashed graticule — same parameters as pre-today version ─────────────
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

// ── City mask: inverted polygon — world bbox with city as hole ─────────────────
// World ring is CCW (GeoJSON exterior); city ring reversed to CW (hole)
function buildCityMask(cityGeoJSON) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]] // CCW
  const holes = []
  for (const f of (cityGeoJSON?.features || [])) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon')
      holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon')
      g.coordinates.forEach(poly => holes.push([...poly[0]].reverse()))
  }
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] }, properties: {} }],
  }
}

// ── Point-in-polygon: filter DOM markers to city extent ───────────────────────
function pointInRing([px, py], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}
function isInsideCity(lng, lat, cityGeo) {
  if (!cityGeo?.features?.length) return true
  for (const f of cityGeo.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon' && pointInRing([lng, lat], g.coordinates[0])) return true
    if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates)
        if (pointInRing([lng, lat], poly[0])) return true
    }
  }
  return false
}

// ── Car parking SVG markers ───────────────────────────────────────────────────
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
  const [cityGeoJSON, setCityGeoJSON] = useState(null)

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
      // Static dashed graticule
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({
        id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#CECECE', 'line-width': 0.6, 'line-opacity': 0.75, 'line-dasharray': [5, 5] },
      })

      // District fill + thin black outline
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts',
        paint: { 'fill-color': '#FFFCB5', 'fill-opacity': 1 } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#1D1D1F', 'line-width': 0.4, 'line-opacity': 0.6 } })

      // Roads (Auto + Public)
      map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'roads-line', type: 'line', source: 'roads',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROAD_COLOR_EXPR, 'line-width': ROAD_WIDTH_EXPR, 'line-opacity': 0.85 } })

      // Bus stops (Public)
      map.addSource('bus-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bus-stops-circle', type: 'circle', source: 'bus-stops',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': '#0077FF', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 } })

      // Cycling routes (Cycling)
      map.addSource('cycling-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cycling-line', type: 'line', source: 'cycling-routes',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#00C853', 'line-width': 2, 'line-opacity': 0.8 } })

      // Bike parking (Cycling)
      map.addSource('bike-parking', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bike-parking-circle', type: 'circle', source: 'bike-parking',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 4, 'circle-color': '#00897B', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.85 } })

      // White mask covering everything OUTSIDE the city (above all data layers)
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // City boundary line (topmost)
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 2.5, 'line-opacity': 0.95 } })

      setMapReady(true)
    })

    return () => { markersRef.current.forEach(m => m.remove()); map.remove(); mapRef.current = null }
  }, [])

  // ── Fetch city boundary → build mask ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
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
        setCityGeoJSON(gj)
        mapRef.current?.getSource('city-boundary')?.setData(gj)
        mapRef.current?.getSource('city-mask')?.setData(buildCityMask(gj))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mapReady])

  // ── District polygons ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      if (!fc?.features) continue
      for (const f of fc.features) features.push({ ...f, properties: { ...f.properties, districtName: name } })
    }
    mapRef.current.getSource('districts')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, districtBoundaries])

  // ── Static data sources ────────────────────────────────────────────────────
  useEffect(() => { if (mapReady && roads)             mapRef.current?.getSource('roads')?.setData(roads) },             [mapReady, roads])
  useEffect(() => { if (mapReady && localBusStops)     mapRef.current?.getSource('bus-stops')?.setData(localBusStops) }, [mapReady, localBusStops])
  useEffect(() => { if (mapReady && localCycling)      mapRef.current?.getSource('cycling-routes')?.setData(localCycling) }, [mapReady, localCycling])
  useEffect(() => { if (mapReady && localBikeParkings) mapRef.current?.getSource('bike-parking')?.setData(localBikeParkings) }, [mapReady, localBikeParkings])

  // ── Tab → layer visibility + choropleth ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isAuto    = tab === 'auto'
    const isPublic  = tab === 'public'
    const isCycling = tab === 'cycling'

    const setVis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    setVis('roads-line',          isAuto || isPublic)
    setVis('bus-stops-circle',    isPublic)
    setVis('cycling-line',        isCycling)
    setVis('bike-parking-circle', isCycling)

    if (map.getLayer('district-fill')) {
      const hasScores = (isAuto || isPublic) && Object.keys(districtScores).length > 0
      if (hasScores) {
        map.setPaintProperty('district-fill', 'fill-color', [
          'match', ['get', 'districtName'],
          ...Object.entries(districtScores).flatMap(([n, s]) => [n, scoreToYellow(s)]),
          '#FFFCB5',
        ])
        map.setPaintProperty('district-fill', 'fill-opacity', 0.9)
      } else {
        map.setPaintProperty('district-fill', 'fill-color', '#F5F5F5')
        map.setPaintProperty('district-fill', 'fill-opacity', 1)
      }
    }
  }, [mapReady, tab, districtScores])

  // ── Parking markers — Auto only, clipped to city boundary ─────────────────
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
      if (!isInsideCity(lng, lat, cityGeoJSON)) continue
      markersRef.current.push(
        new maplibregl.Marker({ element: makeParkingEl(p.parking, p.capacity), anchor: 'center' })
          .setLngLat([lng, lat]).addTo(map)
      )
    }
  }, [mapReady, tab, localCarParkings, cityGeoJSON])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

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
