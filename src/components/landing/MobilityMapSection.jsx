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

// ── Fetch bus routes from Overpass ────────────────────────────────────────────
async function fetchBusRoutes() {
  const q = `[out:json][timeout:60];relation["route"="bus"](52.32,10.60,52.56,11.00);out geom;`
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: `data=${encodeURIComponent(q)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return osmtogeojson(await r.json())
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
    localCarParkings, localBusStops, localCycling, localBikeParkings,
    selectedDay, selectedTime,
  } = useAppStore()

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

      // Cycling routes (Cycling)
      map.addSource('cycling-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cycling-line', type: 'line', source: 'cycling-routes',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#00C853', 'line-width': 2, 'line-opacity': 0.8 } })

      // Bike parking (Cycling)
      map.addSource('bike-parking', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bike-parking-circle', type: 'circle', source: 'bike-parking',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 3, 'circle-color': '#00897B', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-opacity': 0.85 } })

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

  // ── Fetch bus routes (lazy — only when Public tab first shown) ────────────
  useEffect(() => {
    if (!mapReady || tab !== 'public' || busRoutesFetchedRef.current) return
    busRoutesFetchedRef.current = true
    fetchBusRoutes()
      .then(gj => mapRef.current?.getSource('bus-routes')?.setData(gj))
      .catch(() => {})
  }, [mapReady, tab])

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
  useEffect(() => { if (mapReady && roads)             mapRef.current?.getSource('roads')?.setData(roads) },             [mapReady, roads])
  useEffect(() => { if (mapReady && localBusStops)     mapRef.current?.getSource('bus-stops')?.setData(localBusStops) }, [mapReady, localBusStops])
  useEffect(() => { if (mapReady && localCycling)      mapRef.current?.getSource('cycling-routes')?.setData(localCycling) }, [mapReady, localCycling])
  useEffect(() => { if (mapReady && localBikeParkings) mapRef.current?.getSource('bike-parking')?.setData(localBikeParkings) }, [mapReady, localBikeParkings])

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
    setVis('cycling-line',        isCycling)
    setVis('bike-parking-circle', isCycling)
    // District fill: yellow only in Public (not in Auto — user requested outline only)
    setVis('district-fill', isPublic)

    if (isPublic && map.getLayer('district-fill') && Object.keys(districtScores).length) {
      map.setPaintProperty('district-fill', 'fill-color', [
        'match', ['get', 'districtName'],
        ...Object.entries(districtScores).flatMap(([n, s]) => [n, scoreToYellow(s)]),
        '#FFFCB5',
      ])
    }
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
