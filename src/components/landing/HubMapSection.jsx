import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import { computeFleetPerHub } from '../../utils/fleetCalc'

const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5
const BBOX = { minLon: 10.55, maxLon: 10.95, minLat: 52.28, maxLat: 52.60 }
const inCity = (lon, lat) =>
  lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat

const TC = { l: '#1D1D1F', m: '#01796F', s: '#3EA055' }

export const HUB_TABS = [
  { id: 'placement', label: 'Hub Placement' },
  { id: 'fleet',     label: 'Fleet'          },
  { id: 'network',   label: 'Network'         },
]

const NET_TABS = [
  { id: 'hub-net',   label: 'Network Hubs'    },
  { id: 'fac-net',   label: 'Facility Network' },
  { id: 'hub-l-ext', label: 'Hub L External'   },
]

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

const EXT_CITIES = [
  { name: 'Braunschweig', lon: 10.5267, lat: 52.2653 },
  { name: 'Gifhorn',      lon: 10.5477, lat: 52.4894 },
  { name: 'Hannover',     lon:  9.7320, lat: 52.3759 },
]

// ── Geo helpers ───────────────────────────────────────────────────────────────
function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

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

function makeCirclesFC(hubs, radiusM, lk = 'lon', lak = 'lat') {
  if (!hubs?.length) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: hubs
      .filter(h => inCity(h[lk] ?? h.lng, h[lak] ?? h.lat))
      .map(h => makeCircleGeo(h[lk] ?? h.lng, h[lak] ?? h.lat, radiusM)),
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

// ── Fleet bar marker ──────────────────────────────────────────────────────────
function fleetTotal(fp, tier) {
  const data = fp?.[`hub_${tier}`] || {}
  return Object.values(data).reduce((s, v) => s + v, 0)
}

function makeBarEl(tier, total, maxTotal) {
  const color = TC[tier] || '#1D1D1F'
  const w = tier === 'l' ? 10 : tier === 'm' ? 7 : 5
  const h = Math.max(5, Math.round((total / Math.max(1, maxTotal)) * 72))
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'
  el.innerHTML = `<div style="width:${w}px;height:${h}px;background:${color};flex-shrink:0;border-radius:1px 1px 0 0;"></div>`
  return el
}

// ── Network line builders ─────────────────────────────────────────────────────
function buildLines(pairs) {
  return { type: 'FeatureCollection', features: pairs.map(([c1, c2]) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c1, c2] }, properties: {} })) }
}

function connectHubs(fromHubs, toHubs, maxDist, maxConn, lk1 = 'lon', lk2 = 'lng') {
  const pairs = []
  for (const from of fromHubs) {
    const fLon = from[lk1] ?? from.lng
    const nearby = toHubs
      .map(to => ({ to, d: hav(from.lat, fLon, to.lat, to[lk2] ?? to.lng) }))
      .filter(x => x.d <= maxDist)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxConn)
    for (const { to } of nearby)
      pairs.push([[fLon, from.lat], [to[lk2] ?? to.lng, to.lat]])
  }
  return buildLines(pairs)
}

function connectHubsToVenues(hubs, venues, radiusM, maxV, lk = 'lon') {
  const pairs = []
  for (const hub of hubs) {
    const hLon = hub[lk] ?? hub.lng
    const nearby = venues
      .map(v => ({ v, d: hav(hub.lat, hLon, v.lat, v.lng) }))
      .filter(x => x.d <= radiusM)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxV)
    for (const { v } of nearby)
      pairs.push([[hLon, hub.lat], [v.lng, v.lat]])
  }
  return buildLines(pairs)
}

function buildExtLines(lHubs) {
  const pairs = []
  for (const city of EXT_CITIES)
    for (const hub of lHubs)
      pairs.push([[city.lon, city.lat], [hub.lon ?? hub.lng, hub.lat]])
  return buildLines(pairs)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HubMapSection({ tab = 'placement', onTabChange }) {
  const mapDivRef       = useRef(null)
  const mapRef          = useRef(null)
  const fleetMarkersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)
  const [netTab, setNetTab]     = useState('hub-net')
  const autoTriggeredRef        = useRef(false)

  const store = useAppStore()
  const {
    hubLMResults, hubSBusOnly,
    hubLMShowL, hubLMShowM, hubLMShowS,
    hubLMSStatusFilter,
    districtBoundaries,
    localCarParkings, localBusStops,
    landingCityGeoJSON, setLandingCityGeoJSON,
    venues,
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
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

      // Fleet yellow circles (below mask)
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' },
          paint: { 'fill-color': '#FFD200', 'fill-opacity': 0.08 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': '#FFD200', 'line-width': 1.5, 'line-opacity': 0.75 } })
      }

      // Network lines (below mask — mask is hidden for hub-l-ext)
      map.addSource('net-lm', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'net-lm-layer', type: 'line', source: 'net-lm', layout: { visibility: 'none' },
        paint: { 'line-color': TC.l, 'line-width': 1.0, 'line-opacity': 0.65 } })

      map.addSource('net-ms', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'net-ms-layer', type: 'line', source: 'net-ms', layout: { visibility: 'none' },
        paint: { 'line-color': TC.m, 'line-width': 0.8, 'line-opacity': 0.65 } })

      // Facility lines
      for (const [id, color] of [['fac-l', TC.l], ['fac-m', TC.m], ['fac-s', TC.s]]) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-layer`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': color, 'line-width': 0.7, 'line-opacity': 0.6 } })
      }
      map.addSource('fac-venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'fac-venues-layer', type: 'circle', source: 'fac-venues', layout: { visibility: 'none' },
        paint: { 'circle-color': '#888', 'circle-radius': 2, 'circle-opacity': 0.8, 'circle-stroke-width': 0 } })

      // External city circles + lines (below mask; mask hidden for ext view)
      map.addSource('ext-city-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ext-city-fill-layer', type: 'fill', source: 'ext-city-fill', layout: { visibility: 'none' },
        paint: { 'fill-color': '#FF0800', 'fill-opacity': 0.05 } })
      map.addLayer({ id: 'ext-city-fill-line', type: 'line', source: 'ext-city-fill', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 3] } })

      map.addSource('ext-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ext-lines-layer', type: 'line', source: 'ext-lines', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 0.8, 'line-opacity': 0.7 } })

      // City mask
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // ── Above mask ────────────────────────────────────────────────────────
      // Placement colored circles (no letters, no stroke)
      map.addSource('pl-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      for (const [tier, color] of [['l', TC.l], ['m', TC.m], ['s', TC.s]]) {
        map.addLayer({ id: `pl-dot-${tier}`, type: 'circle', source: 'pl-dots',
          filter: ['==', ['get', 'tier'], tier],
          layout: { visibility: 'none' },
          paint: { 'circle-color': color, 'circle-radius': 7, 'circle-opacity': 1, 'circle-stroke-width': 0 } })
      }

      // Network hub node circles (above mask)
      for (const [tier, color, r] of [['l', TC.l, 9], ['m', TC.m, 7], ['s', TC.s, 5]]) {
        map.addLayer({ id: `net-dot-${tier}`, type: 'circle', source: 'pl-dots',
          filter: ['==', ['get', 'tier'], tier],
          layout: { visibility: 'none' },
          paint: { 'circle-color': color, 'circle-radius': r, 'circle-opacity': 1,
                   'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } })
      }

      // External flow Hub L markers (above mask)
      map.addSource('ext-hub-l', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ext-hub-l-layer', type: 'circle', source: 'ext-hub-l', layout: { visibility: 'none' },
        paint: { 'circle-color': TC.l, 'circle-radius': 8, 'circle-opacity': 1,
                 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

      // Graticule (above mask)
      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

      // District labels
      map.addSource('dist-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-centroids',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
                  'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85 } })

      // External city labels
      map.addSource('ext-city-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ext-city-labels-layer', type: 'symbol', source: 'ext-city-labels', layout: { visibility: 'none' },
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
                  'text-size': 11, 'text-anchor': 'center', 'text-offset': [0, 2], 'text-allow-overlap': true },
        paint: { 'text-color': '#FF0800', 'text-opacity': 0.9 } })

      // City boundary
      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })

      setMapReady(true)
    })

    return () => {
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

  // ── Hub dots source (shared by placement + network hub nodes) ─────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const features = []
    for (const hub of (hubLMResults?.hubL?.hubs || [])) {
      if (inCity(hub.lon ?? hub.lng, hub.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lon ?? hub.lng, hub.lat] }, properties: { tier: 'l' } })
    }
    for (const hub of (hubLMResults?.hubM?.hubs || [])) {
      if (inCity(hub.lon ?? hub.lng, hub.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lon ?? hub.lng, hub.lat] }, properties: { tier: 'm' } })
    }
    for (const hub of (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat)))
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lng, hub.lat] }, properties: { tier: 's' } })
    mapRef.current.getSource('pl-dots')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMSStatusFilter])

  // ── Visibility control ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const show = (id, v) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none') }

    const isPl    = tab === 'placement'
    const isFl    = tab === 'fleet'
    const isNet   = tab === 'network'
    const isHubN  = isNet && netTab === 'hub-net'
    const isFacN  = isNet && netTab === 'fac-net'
    const isExtF  = isNet && netTab === 'hub-l-ext'

    show('city-mask-fill', !isExtF)

    show('pl-dot-l', isPl && hubLMShowL)
    show('pl-dot-m', isPl && hubLMShowM)
    show('pl-dot-s', isPl && hubLMShowS)

    show('fleet-cov-l-fill', isFl); show('fleet-cov-l-line', isFl)
    show('fleet-cov-m-fill', isFl); show('fleet-cov-m-line', isFl)
    show('fleet-cov-s-fill', isFl); show('fleet-cov-s-line', isFl)

    show('net-dot-l', isHubN); show('net-dot-m', isHubN); show('net-dot-s', isHubN)
    show('net-lm-layer', isHubN); show('net-ms-layer', isHubN)

    show('fac-l-layer', isFacN); show('fac-m-layer', isFacN); show('fac-s-layer', isFacN)
    show('fac-venues-layer', isFacN)

    show('ext-city-fill-layer', isExtF); show('ext-city-fill-line', isExtF)
    show('ext-lines-layer', isExtF)
    show('ext-hub-l-layer', isExtF)
    show('ext-city-labels-layer', isExtF)

    if (isExtF) map.flyTo({ center: [10.28, 52.38], zoom: 9.2, duration: 700 })
    else if (isNet) map.flyTo({ center: CENTER, zoom: ZOOM, duration: 600 })
  }, [mapReady, tab, netTab, hubLMShowL, hubLMShowM, hubLMShowS])

  // ── Fleet bar markers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    fleetMarkersRef.current.forEach(m => m.remove())
    fleetMarkersRef.current = []

    if (tab !== 'fleet' || !hubLMResults) {
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s'])
        mapRef.current.getSource(id)?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    const map = mapRef.current
    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat))

    map.getSource('fleet-cov-l')?.setData(makeCirclesFC(lHubs, 4000))
    map.getSource('fleet-cov-m')?.setData(makeCirclesFC(mHubs, 2000))
    map.getSource('fleet-cov-s')?.setData(makeCirclesFC(sHubs, 500, 'lng', 'lat'))

    const fp  = computeFleetPerHub(lHubs.length, mHubs.length, sHubs.length)
    const tl  = fleetTotal(fp, 'l'), tm = fleetTotal(fp, 'm'), ts = fleetTotal(fp, 's')
    const max = Math.max(1, tl, tm, ts)

    const markers = []
    const addBars = (hubs, tier, lk = 'lon', lak = 'lat') => {
      for (const hub of hubs) {
        const el = makeBarEl(tier, fleetTotal(fp, tier), max)
        markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([hub[lk] ?? hub.lng, hub[lak] ?? hub.lat]).addTo(map))
      }
    }
    addBars(lHubs, 'l')
    addBars(mHubs, 'm')
    addBars(sHubs, 's', 'lng', 'lat')
    fleetMarkersRef.current = markers
  }, [mapReady, tab, hubLMResults, hubSBusOnly, hubLMSStatusFilter])

  // ── Network data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || tab !== 'network' || !hubLMResults) return
    const map = mapRef.current

    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat))

    // Hub network
    map.getSource('net-lm')?.setData(connectHubs(lHubs, mHubs, 6000, 3))
    map.getSource('net-ms')?.setData(connectHubs(mHubs, sHubs, 2500, 4, 'lon', 'lng'))

    // Facility network
    const vens = (venues || []).filter(v => v.lat && v.lng)
    map.getSource('fac-l')?.setData(connectHubsToVenues(lHubs, vens, 900, 8))
    map.getSource('fac-m')?.setData(connectHubsToVenues(mHubs, vens, 600, 6))
    map.getSource('fac-s')?.setData(connectHubsToVenues(sHubs, vens, 400, 4, 'lng'))
    map.getSource('fac-venues')?.setData({
      type: 'FeatureCollection',
      features: vens.filter(v => inCity(v.lng, v.lat))
        .map(v => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lng, v.lat] }, properties: {} })),
    })

    // Hub L external flow
    map.getSource('ext-city-fill')?.setData({
      type: 'FeatureCollection', features: EXT_CITIES.map(c => makeCircleGeo(c.lon, c.lat, 8000)),
    })
    map.getSource('ext-lines')?.setData(buildExtLines(lHubs))
    map.getSource('ext-city-labels')?.setData({
      type: 'FeatureCollection',
      features: EXT_CITIES.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { name: c.name } })),
    })
    map.getSource('ext-hub-l')?.setData({
      type: 'FeatureCollection',
      features: lHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: {} })),
    })
  }, [mapReady, tab, hubLMResults, hubSBusOnly, hubLMSStatusFilter, venues])

  const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Main tab switcher */}
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

      {/* Network sub-tab switcher */}
      {mapReady && tab === 'network' && (
        <div style={{
          position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          {NET_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setNetTab(id)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 11, fontWeight: 600,
              background: netTab === id ? '#1D1D1F' : 'transparent',
              color:      netTab === id ? '#fff'    : '#888',
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
