import React, { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM = 12

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

export const TABS = [
  { label: 'Livability', id: 'livability' },
  { label: 'Land Use',   id: 'landuse'    },
  { label: 'Centrality', id: 'centrality' },
  { label: 'Facility',   id: 'facility'   },
]

// ── Land use colours ──────────────────────────────────────────────────────────
export const LANDUSE_COLORS = {
  residential:    '#F4A429',
  commercial:     '#E8305A',
  industrial:     '#5B4FCF',
  park:           '#29C17E',
  forest:         '#29C17E',
  education:      '#2496E8',
  administrative: '#F26B3A',
  institutional:  '#D43FB8',
  parking:        '#14C4C4',
  railway:        '#8FC73E',
}

// ── Shared base utilities ─────────────────────────────────────────────────────
function buildGraticule() {
  const features = []
  const lonStep = 0.015, latStep = 0.009
  const [minLon, maxLon, minLat, maxLat] = [8.0, 15.0, 49.0, 56.0]
  for (let lat = Math.ceil(minLat / latStep) * latStep; lat <= maxLat; lat = parseFloat((lat + latStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[minLon, lat], [maxLon, lat]] }, properties: {} })
  for (let lon = Math.ceil(minLon / lonStep) * lonStep; lon <= maxLon; lon = parseFloat((lon + lonStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, minLat], [lon, maxLat]] }, properties: {} })
  return { type: 'FeatureCollection', features }
}

function buildCityMask(cityGeoJSON) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const holes = []
  for (const f of (cityGeoJSON?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => holes.push([...poly[0]].reverse()))
  }
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] }, properties: {} }] }
}

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
    if (count > 0) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sumLon / count, sumLat / count] }, properties: { name } })
  }
  return { type: 'FeatureCollection', features }
}

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

// ── Livability proportional symbol grid (250m, facility density) ──────────────
const LIV_LAT = 0.002262, LIV_LON = 0.003691
const LIV_MIN_R = 50, LIV_MAX_R = 240

function buildLivabilityGrid(venues, localFacilities, localHistoric, cityGeo) {
  if (!cityGeo?.features?.length) return { type: 'FeatureCollection', features: [] }
  const [minLon, maxLon, minLat, maxLat] = [10.55, 10.95, 52.28, 52.60]
  const rowOf = lat => Math.round((lat - minLat) / LIV_LAT)
  const colOf = lon => Math.round((lon - minLon) / LIV_LON)
  const key   = (r, c) => `${r}|${c}`

  const grid = new Map()
  const rows = Math.ceil((maxLat - minLat) / LIV_LAT)
  const cols = Math.ceil((maxLon - minLon) / LIV_LON)
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const lat = minLat + r * LIV_LAT, lon = minLon + c * LIV_LON
      if (isInsideCity(lon, lat, cityGeo)) grid.set(key(r, c), { lat, lon, score: 0 })
    }
  }

  const addScore = (lon, lat, w) => {
    const rc = rowOf(lat), cc = colOf(lon)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cell = grid.get(key(rc + dr, cc + dc))
      if (cell) cell.score += w / (1 + (dr * dr + dc * dc) * 0.5)
    }
  }

  for (const v of (venues || [])) {
    if (v.lat && v.lng) addScore(v.lng, v.lat, 12)
  }
  for (const f of (localFacilities?.features || [])) {
    const c = f.geometry?.coordinates
    if (!c || Array.isArray(c[0])) continue
    addScore(c[0], c[1], 8)
  }
  for (const f of (localHistoric?.features || [])) {
    const c = f.geometry?.coordinates
    if (!c || Array.isArray(c[0])) continue
    addScore(c[0], c[1], 5)
  }

  const cells = [...grid.values()]
  const sorted = cells.map(c => c.score).sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1

  return {
    type: 'FeatureCollection',
    features: cells.map(({ lat, lon, score }) => {
      const t = Math.sqrt(Math.min(score, p95) / p95)
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { radius_m: Math.round(LIV_MIN_R + t * (LIV_MAX_R - LIV_MIN_R)) } }
    }),
  }
}

// ── Venue/facility → GeoJSON points (for Facility tab) ────────────────────────
function venuesToGeoJSON(venues) {
  const features = (venues || [])
    .filter(v => v.lat && v.lng)
    .map(v => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lng, v.lat] }, properties: { name: v.name, category: v.category } }))
  return { type: 'FeatureCollection', features }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LivabilityMapSection({ tab = 'livability', onTabChange }) {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [cityGeoJSON, setCityGeoJSON] = useState(null)

  const {
    venues, districtBoundaries,
    localFacilities, localHistoric, localLandUse,
    landingCityGeoJSON, setLandingCityGeoJSON,
  } = useAppStore()

  const livabilityGrid = useMemo(
    () => buildLivabilityGrid(venues, localFacilities, localHistoric, cityGeoJSON),
    [venues, localFacilities, localHistoric, cityGeoJSON],
  )

  const venueGeoJSON = useMemo(() => venuesToGeoJSON(venues), [venues])

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
      // ── Districts ────────────────────────────────────────────────────────
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#1D1D1F', 'line-width': 0.5, 'line-opacity': 0.7 } })

      // ── Livability proportional symbols ──────────────────────────────────
      map.addSource('liv-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'liv-circles', type: 'circle', source: 'liv-grid',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#FFD300', 'circle-opacity': 0.90, 'circle-stroke-width': 0,
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

      // ── Land use polygons ────────────────────────────────────────────────
      map.addSource('landuse', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      const luColor = ['match', ['get', 'category'],
        'residential', '#F4A429', 'commercial', '#E8305A', 'industrial', '#5B4FCF',
        'park', '#29C17E', 'forest', '#29C17E', 'education', '#2496E8',
        'administrative', '#F26B3A', 'institutional', '#D43FB8',
        'parking', '#14C4C4', 'railway', '#8FC73E', '#cccccc',
      ]
      map.addLayer({ id: 'landuse-fill', type: 'fill', source: 'landuse',
        layout: { visibility: 'none' },
        paint: { 'fill-color': luColor, 'fill-opacity': 0.65 } })
      map.addLayer({ id: 'landuse-line', type: 'line', source: 'landuse',
        layout: { visibility: 'none' },
        paint: { 'line-color': luColor, 'line-width': 0.4, 'line-opacity': 0.8 } })

      // ── Facility venues ──────────────────────────────────────────────────
      map.addSource('venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'venue-circle', type: 'circle', source: 'venues',
        layout: { visibility: 'none' },
        paint: { 'circle-color': '#E8305A', 'circle-radius': 3, 'circle-opacity': 0.75, 'circle-stroke-width': 0 } })

      // ── WHITE MASK (above all data layers) ──────────────────────────────
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // ── Above mask: grid, labels, boundary ──────────────────────────────
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.6, 'line-dasharray': [4, 6] } })

      map.addSource('district-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-labels', type: 'symbol', source: 'district-centroids',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85, 'text-halo-width': 0 },
      })

      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })

      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── City boundary (localStorage → store → Overpass) ──────────────────────
  useEffect(() => {
    if (!mapReady) return
    function applyCity(gj) {
      setCityGeoJSON(gj); setLandingCityGeoJSON(gj)
      mapRef.current?.getSource('city-boundary')?.setData(gj)
      mapRef.current?.getSource('city-mask')?.setData(buildCityMask(gj))
    }
    if (landingCityGeoJSON) { applyCity(landingCityGeoJSON); return }
    try {
      const raw = localStorage.getItem('wolfsburg_city_boundary_v1')
      if (raw) { applyCity(JSON.parse(raw)); return }
    } catch (_) {}
    const q = `[out:json][timeout:30];relation["boundary"="administrative"]["name"="Wolfsburg"]["admin_level"="6"];out geom;`
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(r => r.json()).then(data => {
        const gj = osmtogeojson(data)
        try { localStorage.setItem('wolfsburg_city_boundary_v1', JSON.stringify(gj)) } catch (_) {}
        applyCity(gj)
      }).catch(() => {})
  }, [mapReady, landingCityGeoJSON])

  // ── Districts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      if (!fc?.features) continue
      for (const f of fc.features) features.push({ ...f, properties: { ...f.properties, districtName: name } })
    }
    mapRef.current?.getSource('districts')?.setData({ type: 'FeatureCollection', features })
    mapRef.current?.getSource('district-centroids')?.setData(buildDistrictCentroids(districtBoundaries))
  }, [mapReady, districtBoundaries])

  // ── Data sources ──────────────────────────────────────────────────────────
  useEffect(() => { if (mapReady && localLandUse) mapRef.current?.getSource('landuse')?.setData(localLandUse) }, [mapReady, localLandUse])
  useEffect(() => { if (mapReady && venueGeoJSON) mapRef.current?.getSource('venues')?.setData(venueGeoJSON) }, [mapReady, venueGeoJSON])

  useEffect(() => {
    if (!mapReady || !livabilityGrid) return
    mapRef.current?.getSource('liv-grid')?.setData(livabilityGrid)
  }, [mapReady, livabilityGrid])

  // ── Tab → layer visibility ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const setVis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    setVis('liv-circles',   tab === 'livability')
    setVis('landuse-fill',  tab === 'landuse')
    setVis('landuse-line',  tab === 'landuse')
    setVis('venue-circle',  tab === 'facility')
  }, [mapReady, tab])

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
