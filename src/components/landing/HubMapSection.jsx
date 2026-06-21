import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import { computeFleetPerHub, MODE_META } from '../../utils/fleetCalc'

const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5

export const HUB_TABS = [
  { id: 'placement', label: 'Hub Placement' },
  { id: 'fleet',     label: 'Fleet'          },
  { id: 'network',   label: 'Network'         },
]

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

// ── Geo helpers ───────────────────────────────────────────────────────────────
function makeCircleGeo(lon, lat, radiusM, steps = 64) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dLon = (radiusM / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle)
    const dLat = (radiusM / 110540) * Math.sin(angle)
    coords.push([lon + dLon, lat + dLat])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

function makeCirclesFC(hubs, radiusM, lonKey = 'lon', latKey = 'lat') {
  if (!hubs?.length) return { type: 'FeatureCollection', features: [] }
  return { type: 'FeatureCollection', features: hubs.map(h => makeCircleGeo(h[lonKey] ?? h.lng, h[latKey] ?? h.lat, radiusM)) }
}

function buildGraticule() {
  const features = [], lonStep = 0.015, latStep = 0.009
  const [mnLon, mxLon, mnLat, mxLat] = [8.0, 15.0, 49.0, 56.0]
  for (let lat = Math.ceil(mnLat / latStep) * latStep; lat <= mxLat; lat = parseFloat((lat + latStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[mnLon, lat], [mxLon, lat]] }, properties: {} })
  for (let lon = Math.ceil(mnLon / lonStep) * lonStep; lon <= mxLon; lon = parseFloat((lon + lonStep).toFixed(6)))
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, mnLat], [lon, mxLat]] }, properties: {} })
  return { type: 'FeatureCollection', features }
}

function buildCityMask(cityGeoJSON) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const holes = []
  for (const f of (cityGeoJSON?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => holes.push([...p[0]].reverse()))
  }
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] }, properties: {} }] }
}

function buildCentroids(districtBoundaries) {
  const features = []
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    let sLon = 0, sLat = 0, cnt = 0
    const visit = ([lo, la]) => { sLon += lo; sLat += la; cnt++ }
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.forEach(visit))
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => r.forEach(visit)))
    }
    if (cnt > 0) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [sLon / cnt, sLat / cnt] }, properties: { name } })
  }
  return { type: 'FeatureCollection', features }
}

// ── Callout marker HTML ───────────────────────────────────────────────────────
function makeCalloutEl(hub, tier, fleetPerHub) {
  const tierLabel = tier === 'hub_l' ? 'L' : tier === 'hub_m' ? 'M' : 'S'
  const fleetData = fleetPerHub?.[tier] || {}
  const fleetLines = Object.entries(fleetData)
    .filter(([k, v]) => k !== '_total' && v > 0)
    .map(([k, v]) => `${MODE_META[k]?.label ?? k} ×${v}`)

  const label = hub.name || hub.labelBus || `Hub ${tierLabel}`
  const score = hub.score !== undefined ? Math.round(hub.score) : '—'
  const status = hub.status ? hub.status.charAt(0).toUpperCase() + hub.status.slice(1) : '—'

  const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;'
  el.innerHTML = `
    <div style="border-left:1.5px solid #1D1D1F;padding:0 0 6px 7px;font-family:${F};font-size:9px;line-height:1.55;color:#1D1D1F;white-space:nowrap">
      <div style="font-weight:700;font-size:10px;letter-spacing:0.05em">HUB ${tierLabel}</div>
      <div style="color:#666;font-size:8.5px;max-width:120px;white-space:normal;line-height:1.3;margin-bottom:2px">${label}</div>
      <div>Status: <b>${status}</b> &nbsp;·&nbsp; Score: <b>${score}</b></div>
      <div style="margin-top:2px;font-weight:600">Fleet:</div>
      ${fleetLines.map(l => `<div style="padding-left:4px">${l}</div>`).join('')}
    </div>
    <div style="width:1.5px;height:22px;background:#1D1D1F;margin-left:6px"></div>
  `
  return el
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HubMapSection({ tab = 'placement', onTabChange }) {
  const mapDivRef          = useRef(null)
  const mapRef             = useRef(null)
  const placementMarkersRef = useRef([])
  const fleetMarkersRef    = useRef([])
  const [mapReady, setMapReady]   = useState(false)
  const autoTriggeredRef   = useRef(false)

  const store = useAppStore()
  const {
    hubLMResults, hubSBusOnly,
    hubLMShowL, hubLMShowM, hubLMShowS,
    hubLMSStatusFilter, hubLMConfig,
    districtBoundaries,
    localCarParkings, localBusStops,
    landingCityGeoJSON, setLandingCityGeoJSON,
  } = store

  // ── Init map ──────────────────────────────────────────────────────────────
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
      // ── Districts ──────────────────────────────────────────────────────────
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

      // ── Coverage circles (placement + fleet) ───────────────────────────────
      for (const id of ['cov-l', 'cov-m', 'cov-s', 'fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      }
      // Placement coverage (dashed, dark)
      const placementCols = { 'cov-l': '#1D1D1F', 'cov-m': '#1D7A3A', 'cov-s': '#185FA5' }
      for (const [id, color] of Object.entries(placementCols)) {
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' },
          paint: { 'fill-color': color, 'fill-opacity': 0.05 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': color, 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.45 } })
      }
      // Fleet coverage (yellow solid)
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' },
          paint: { 'fill-color': '#FFD200', 'fill-opacity': 0.08 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': '#FFD200', 'line-width': 1.5, 'line-opacity': 0.7 } })
      }

      // ── Candidate highlights (placement) ───────────────────────────────────
      map.addSource('cand-l', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('cand-m', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cand-l-circle', type: 'circle', source: 'cand-l', layout: { visibility: 'none' },
        paint: { 'circle-radius': 5, 'circle-color': '#1D1D1F', 'circle-opacity': 0.20, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'cand-m-circle', type: 'circle', source: 'cand-m', layout: { visibility: 'none' },
        paint: { 'circle-radius': 5, 'circle-color': '#1D7A3A', 'circle-opacity': 0.20, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })

      // ── City mask (above data layers) ──────────────────────────────────────
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // ── Graticule ──────────────────────────────────────────────────────────
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

      // ── District labels ────────────────────────────────────────────────────
      map.addSource('dist-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-centroids',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85 } })

      // ── City boundary ──────────────────────────────────────────────────────
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })

      setMapReady(true)
    })
    return () => {
      placementMarkersRef.current.forEach(m => m.remove())
      fleetMarkersRef.current.forEach(m => m.remove())
      map.remove(); mapRef.current = null
    }
  }, [])

  // ── City boundary ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    function applyCity(gj) {
      setLandingCityGeoJSON(gj)
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
    for (const [, fc] of Object.entries(districtBoundaries)) {
      if (fc?.features) features.push(...fc.features)
    }
    mapRef.current?.getSource('districts')?.setData({ type: 'FeatureCollection', features })
    mapRef.current?.getSource('dist-centroids')?.setData(buildCentroids(districtBoundaries))
  }, [mapReady, districtBoundaries])

  // ── Auto-run algorithm ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !localCarParkings || !localBusStops) return
    if (hubLMResults || autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    buildRunAllHubs(store)()
  }, [mapReady, localCarParkings, localBusStops, hubLMResults])

  // ── Placement markers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    placementMarkersRef.current.forEach(m => m.remove())
    placementMarkersRef.current = []
    if (!hubLMResults || tab !== 'placement') return
    const map = mapRef.current
    const markers = []

    const makeMarker = (hub, tier, svgW, svgH, svgInner) => {
      const el = document.createElement('div')
      el.innerHTML = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${svgInner}</svg>`
      el.style.cssText = `cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));width:${svgW}px;height:${svgH}px`
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([hub.lon ?? hub.lng, hub.lat]).addTo(map)
    }

    if (hubLMShowL && hubLMResults.hubL?.hubs?.length) {
      for (const hub of hubLMResults.hubL.hubs) {
        markers.push(makeMarker(hub, 'hub_l', 34, 34,
          `<circle cx="17" cy="17" r="15" fill="#1D1D1F" stroke="white" stroke-width="2.5"/>
           <text x="17" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="white">L</text>`))
      }
    }
    if (hubLMShowM && hubLMResults.hubM?.hubs?.length) {
      for (const hub of hubLMResults.hubM.hubs) {
        markers.push(makeMarker(hub, 'hub_m', 28, 28,
          `<circle cx="14" cy="14" r="12" fill="#1D7A3A" stroke="white" stroke-width="2.5"/>
           <text x="14" y="18.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="white">M</text>`))
      }
    }
    if (hubLMShowS && hubSBusOnly?.length) {
      const filtered = (hubSBusOnly || []).filter(h =>
        hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter)
      for (const hub of filtered) {
        markers.push(makeMarker({ ...hub, lon: hub.lng }, 'hub_s', 22, 22,
          `<circle cx="11" cy="11" r="9" fill="#185FA5" stroke="white" stroke-width="2"/>
           <text x="11" y="15" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="white">S</text>`))
      }
    }
    placementMarkersRef.current = markers
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMShowL, hubLMShowM, hubLMShowS, hubLMSStatusFilter, tab])

  // ── Placement coverage circles ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !hubLMResults) return
    const map = mapRef.current
    const show = tab === 'placement'
    const setCircle = (srcId, hubs, radius, lk = 'lon', lak = 'lat') => {
      const gj = show ? makeCirclesFC(hubs, radius, lk, lak) : { type: 'FeatureCollection', features: [] }
      map.getSource(srcId)?.setData(gj)
      const vis = show ? 'visible' : 'none'
      map.getLayer(`${srcId}-fill`) && map.setLayoutProperty(`${srcId}-fill`, 'visibility', vis)
      map.getLayer(`${srcId}-line`) && map.setLayoutProperty(`${srcId}-line`, 'visibility', vis)
    }
    setCircle('cov-l', hubLMResults.hubL?.hubs, 4000)
    setCircle('cov-m', hubLMResults.hubM?.hubs, 2000)
    const filteredS = (hubSBusOnly || []).filter(h => hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter)
    setCircle('cov-s', filteredS, hubLMConfig?.hubSCoverageRadius || 200, 'lng', 'lat')
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMSStatusFilter, hubLMConfig, tab])

  // ── Fleet markers + yellow circles ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    fleetMarkersRef.current.forEach(m => m.remove())
    fleetMarkersRef.current = []
    const map = mapRef.current
    const show = tab === 'fleet'

    if (!hubLMResults || !show) {
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.getSource(id)?.setData({ type: 'FeatureCollection', features: [] })
        const vis = 'none'
        map.getLayer(`${id}-fill`) && map.setLayoutProperty(`${id}-fill`, 'visibility', vis)
        map.getLayer(`${id}-line`) && map.setLayoutProperty(`${id}-line`, 'visibility', vis)
      }
      return
    }

    const lHubs = hubLMResults.hubL?.hubs || []
    const mHubs = hubLMResults.hubM?.hubs || []
    const sHubs = (hubSBusOnly || []).filter(h => hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter)

    // Yellow coverage circles
    const setFleetCircle = (srcId, hubs, radius, lk = 'lon', lak = 'lat') => {
      map.getSource(srcId)?.setData(makeCirclesFC(hubs, radius, lk, lak))
      map.getLayer(`${srcId}-fill`) && map.setLayoutProperty(`${srcId}-fill`, 'visibility', 'visible')
      map.getLayer(`${srcId}-line`) && map.setLayoutProperty(`${srcId}-line`, 'visibility', 'visible')
    }
    setFleetCircle('fleet-cov-l', lHubs, 4000)
    setFleetCircle('fleet-cov-m', mHubs, 2000)
    setFleetCircle('fleet-cov-s', sHubs, 500, 'lng', 'lat')

    // Fleet per-hub data
    const fleetPerHub = computeFleetPerHub(lHubs.length, mHubs.length, sHubs.length)
    const markers = []

    const addCallouts = (hubs, tier, lk = 'lon', lak = 'lat') => {
      for (const hub of hubs) {
        const lon = hub[lk] ?? hub.lng
        const lat = hub[lak] ?? hub.lat
        const el = makeCalloutEl(hub, tier, fleetPerHub)
        markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map))
      }
    }
    addCallouts(lHubs, 'hub_l')
    addCallouts(mHubs, 'hub_m')
    addCallouts(sHubs, 'hub_s', 'lng', 'lat')

    fleetMarkersRef.current = markers
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMSStatusFilter, tab])

  const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Tab selector */}
      {mapReady && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          {HUB_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              background: tab === id ? '#1D1D1F' : 'transparent',
              color:      tab === id ? '#fff'    : '#666',
              transition: 'background 0.15s, color 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Network placeholder */}
      {mapReady && tab === 'network' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{ fontFamily: F, fontSize: 13, color: '#ccc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Network visualisation — coming soon
          </div>
        </div>
      )}
    </div>
  )
}
