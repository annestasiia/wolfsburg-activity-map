import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import { computeFleetPerHub, MODE_META } from '../../utils/fleetCalc'

const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5

// Wolfsburg bbox — only show markers inside this
const BBOX = { minLon: 10.55, maxLon: 10.95, minLat: 52.28, maxLat: 52.60 }
const inCity = (lon, lat) =>
  lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat

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
  return {
    type: 'FeatureCollection',
    features: hubs
      .filter(h => inCity(h[lonKey] ?? h.lng, h[latKey] ?? h.lat))
      .map(h => makeCircleGeo(h[lonKey] ?? h.lng, h[latKey] ?? h.lat, radiusM)),
  }
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

// ── Fleet callout marker ──────────────────────────────────────────────────────
// anchor:'bottom' → the bottom edge of this element is at the hub coordinate.
// The GL 'fleet-dots' circle layer renders the black dot exactly at lngLat.
// The bottom of the vertical line therefore touches the top of that dot.
function makeCalloutEl(hub, tier, fleetPerHub) {
  const tierLabel = tier === 'hub_l' ? 'L' : tier === 'hub_m' ? 'M' : 'S'
  const fleetData = fleetPerHub?.[tier] || {}
  const fleetLines = Object.entries(fleetData)
    .filter(([k, v]) => k !== '_total' && v > 0)
    .map(([k, v]) => `${MODE_META[k]?.label ?? k} ×${v}`)

  const name = (hub.name || hub.labelBus || '').slice(0, 22) // truncate long names
  const score  = hub.score !== undefined ? Math.round(hub.score) : '—'
  const status = hub.status ?? '—'

  // Tier-proportional line height: L longer, S shorter
  const lineH  = tier === 'hub_l' ? 16 : tier === 'hub_m' ? 14 : 10

  const el = document.createElement('div')
  // Flex column, items centered — anchor:'bottom' puts bottom-center at lngLat
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'
  el.innerHTML = `
    <div style="
      padding:3px 5px;
      background:rgba(255,255,255,0.93);
      border:1px solid rgba(0,0,0,0.18);
      border-radius:3px;
      font-family:Arial,Helvetica,sans-serif;
      font-size:7.5px;
      line-height:1.45;
      color:#1D1D1F;
      white-space:nowrap;
      text-align:left;
      margin-bottom:1px;
    ">
      <span style="font-weight:700;font-size:8.5px">HUB ${tierLabel}</span>
      ${name ? `<br><span style="color:#555">${name}</span>` : ''}
      <br>${status} · ${score}pts
      ${fleetLines.map(l => `<br>${l}`).join('')}
    </div>
    <div style="width:1px;height:${lineH}px;background:#1D1D1F;flex-shrink:0"></div>
  `
  return el
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HubMapSection({ tab = 'placement', onTabChange }) {
  const mapDivRef           = useRef(null)
  const mapRef              = useRef(null)
  const placementMarkersRef = useRef([])
  const fleetMarkersRef     = useRef([])
  const [mapReady, setMapReady] = useState(false)
  const autoTriggeredRef    = useRef(false)

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
      // Districts
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

      // Fleet yellow coverage circles (below mask)
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' },
          paint: { 'fill-color': '#FFD200', 'fill-opacity': 0.09 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': '#FFD200', 'line-width': 1.5, 'line-opacity': 0.75 } })
      }

      // City mask (paints white over outside-city area — hides circles that extend beyond)
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // Fleet black dots — above mask so they're always visible inside city
      map.addSource('fleet-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'fleet-dots-layer', type: 'circle', source: 'fleet-dots',
        layout: { visibility: 'none' },
        paint: { 'circle-color': '#1D1D1F', 'circle-radius': 4.5, 'circle-opacity': 1,
                 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' } })

      // Graticule
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

      // District labels
      map.addSource('dist-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-centroids',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
                  'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85 } })

      // City boundary
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

  // ── Placement markers (no coverage circles) ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    placementMarkersRef.current.forEach(m => m.remove())
    placementMarkersRef.current = []
    if (!hubLMResults || tab !== 'placement') return
    const map = mapRef.current
    const markers = []

    const makeMarker = (hub, svgW, svgH, svgInner) => {
      const lon = hub.lon ?? hub.lng
      const lat = hub.lat
      if (!inCity(lon, lat)) return null
      const el = document.createElement('div')
      el.innerHTML = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${svgInner}</svg>`
      el.style.cssText = `cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));width:${svgW}px;height:${svgH}px`
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map)
    }

    if (hubLMShowL && hubLMResults.hubL?.hubs?.length) {
      for (const hub of hubLMResults.hubL.hubs) {
        const m = makeMarker(hub, 34, 34,
          `<circle cx="17" cy="17" r="15" fill="#1D1D1F" stroke="white" stroke-width="2.5"/>
           <text x="17" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="white">L</text>`)
        if (m) markers.push(m)
      }
    }
    if (hubLMShowM && hubLMResults.hubM?.hubs?.length) {
      for (const hub of hubLMResults.hubM.hubs) {
        const m = makeMarker(hub, 28, 28,
          `<circle cx="14" cy="14" r="12" fill="#1D7A3A" stroke="white" stroke-width="2.5"/>
           <text x="14" y="18.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="white">M</text>`)
        if (m) markers.push(m)
      }
    }
    if (hubLMShowS && hubSBusOnly?.length) {
      const filtered = (hubSBusOnly || []).filter(h =>
        hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter)
      for (const hub of filtered) {
        const m = makeMarker({ ...hub, lon: hub.lng }, 22, 22,
          `<circle cx="11" cy="11" r="9" fill="#185FA5" stroke="white" stroke-width="2"/>
           <text x="11" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="white">S</text>`)
        if (m) markers.push(m)
      }
    }
    placementMarkersRef.current = markers
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMShowL, hubLMShowM, hubLMShowS, hubLMSStatusFilter, tab])

  // ── Fleet: yellow circles + GL dots + callout markers ────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    fleetMarkersRef.current.forEach(m => m.remove())
    fleetMarkersRef.current = []
    const map = mapRef.current
    const show = tab === 'fleet'

    const clearFleet = () => {
      map.getSource('fleet-dots')?.setData({ type: 'FeatureCollection', features: [] })
      map.getLayer('fleet-dots-layer') && map.setLayoutProperty('fleet-dots-layer', 'visibility', 'none')
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.getSource(id)?.setData({ type: 'FeatureCollection', features: [] })
        map.getLayer(`${id}-fill`) && map.setLayoutProperty(`${id}-fill`, 'visibility', 'none')
        map.getLayer(`${id}-line`) && map.setLayoutProperty(`${id}-line`, 'visibility', 'none')
      }
    }

    if (!hubLMResults || !show) { clearFleet(); return }

    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || [])
      .filter(h => (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat))

    // GL black dots (circle layer)
    const dotFeatures = [
      ...lHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: {} })),
      ...mHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: {} })),
      ...sHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] }, properties: {} })),
    ]
    map.getSource('fleet-dots')?.setData({ type: 'FeatureCollection', features: dotFeatures })
    map.getLayer('fleet-dots-layer') && map.setLayoutProperty('fleet-dots-layer', 'visibility', 'visible')

    // Yellow coverage circles (clipped by city-mask layer)
    const setFleetCircle = (srcId, hubs, radius, lk = 'lon', lak = 'lat') => {
      map.getSource(srcId)?.setData(makeCirclesFC(hubs, radius, lk, lak))
      map.getLayer(`${srcId}-fill`) && map.setLayoutProperty(`${srcId}-fill`, 'visibility', 'visible')
      map.getLayer(`${srcId}-line`) && map.setLayoutProperty(`${srcId}-line`, 'visibility', 'visible')
    }
    setFleetCircle('fleet-cov-l', lHubs, 4000)
    setFleetCircle('fleet-cov-m', mHubs, 2000)
    setFleetCircle('fleet-cov-s', sHubs, 500, 'lng', 'lat')

    // HTML callout markers (label + leader line, no dot — dot is GL layer)
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

      {mapReady && tab === 'network' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{ fontFamily: F, fontSize: 13, color: '#ccc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Network visualisation — coming soon
          </div>
        </div>
      )}
    </div>
  )
}
