import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import { computeFleetPerHub, MODE_META } from '../../utils/fleetCalc'

const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5
const BBOX   = { minLon: 10.55, maxLon: 10.95, minLat: 52.28, maxLat: 52.60 }
const inCity = (lon, lat) =>
  lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat

const TC = { l: '#111111', m: '#01796F', s: '#3EA055' }

// Network connection radii — S uses 5km so outlying villages connect (e.g. Barnstorf–Heiligendorf)
const NET_COV = { l: 6000, m: 4000, s: 5000 }

export const HUB_TABS = [
  { id: 'placement', label: 'Hub Placement' },
  { id: 'fleet',     label: 'Fleet'          },
  { id: 'network',   label: 'Network'         },
]

const NET_TABS = [
  { id: 'hub-net',  label: 'Network Hubs'    },
  { id: 'fac-net',  label: 'Facility Network' },
  { id: 'ext-flow', label: 'External Flows'   },
]

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

const COMMUTER_CITIES = [
  { name: 'Gifhorn',      lon: 10.5477, lat: 52.4894, count: 15000 },
  { name: 'Helmstedt',    lon: 11.0086, lat: 52.2282, count: 12000 },
  { name: 'Braunschweig', lon: 10.5267, lat: 52.2653, count: 10000 },
  { name: 'Peine',        lon: 10.2327, lat: 52.3209, count:  5000 },
  { name: 'Hannover',     lon:  9.7320, lat: 52.3759, count:  4000 },
  { name: 'Salzgitter',   lon: 10.3367, lat: 52.1517, count:  3000 },
  { name: 'Celle',        lon: 10.0798, lat: 52.6238, count:  2500 },
  { name: 'Magdeburg',    lon: 11.6276, lat: 52.1205, count:  2000 },
]

const EXCL_AMENITY = new Set(['parking', 'parking_space', 'parking_entrance', 'fuel'])
const EXCL_LANDUSE = new Set(['forest', 'meadow', 'farmland', 'cemetery', 'military', 'reservoir'])
const EXCL_NATURAL = new Set(['water', 'wetland', 'wood'])

// ── Geo helpers ───────────────────────────────────────────────────────────────
function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

function ringCentroid(ring) {
  let lon = 0, lat = 0
  for (const [lo, la] of ring) { lon += lo; lat += la }
  return [lon / ring.length, lat / ring.length]
}

function circleGeo(lon, lat, radiusM, steps = 64) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    coords.push([lon + (radiusM / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(a),
                 lat + (radiusM / 110540) * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

function makeCirclesFC(hubs, radiusM, lk = 'lon', lak = 'lat') {
  return { type: 'FeatureCollection', features: (hubs || [])
    .filter(h => inCity(h[lk] ?? h.lng, h[lak] ?? h.lat))
    .map(h => circleGeo(h[lk] ?? h.lng, h[lak] ?? h.lat, radiusM)) }
}

function buildGraticule() {
  const f = [], ls = 0.015, as = 0.009, [a, b, c, d] = [8.0, 15.0, 49.0, 56.0]
  for (let lat = Math.ceil(c / as) * as; lat <= d; lat = parseFloat((lat + as).toFixed(6)))
    f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[a, lat], [b, lat]] }, properties: {} })
  for (let lon = Math.ceil(a / ls) * ls; lon <= b; lon = parseFloat((lon + ls).toFixed(6)))
    f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lon, c], [lon, d]] }, properties: {} })
  return { type: 'FeatureCollection', features: f }
}

function buildCityMask(gj) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  const holes = []
  for (const f of (gj?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => holes.push([...p[0]].reverse()))
  }
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] }, properties: {} }] }
}

function buildCentroids(db) {
  const features = []
  for (const [name, fc] of Object.entries(db)) {
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

// Point-in-polygon (ray cast) to strictly clip fleet markers to city boundary
function raycastInPoly(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside
  }
  return inside
}
function pointInCity(lon, lat, cityGeoJSON) {
  if (!cityGeoJSON) return inCity(lon, lat)
  for (const f of (cityGeoJSON.features || [])) {
    const g = f.geometry; if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates]
               : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys)
      if (raycastInPoly(lon, lat, poly[0])) return true
  }
  return false
}

// ── Fleet info label marker ───────────────────────────────────────────────────
const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const TIER_LABEL = { l: 'Hub L', m: 'Hub M', s: 'Hub S' }
const TIER_DESC  = { l: 'Fleet depot + fast charging', m: 'Intermodal transfer node', s: 'Bus/bike interchange' }
const fmtArea = n => n >= 10000 ? `${(n / 10000).toFixed(2)} ha` : `${Math.round(n)} m²`

function makeHubInfoEl(tier, hub, hubData) {
  const color   = TC[tier]
  const dotSize = { l: 9, m: 7, s: 5 }[tier]
  const status  = hub?.status || (tier === 's' ? 'existing' : 'proposed')

  const el = document.createElement('div')
  el.style.cssText = `display:flex;flex-direction:column;align-items:center;pointer-events:none;`

  // Plain text label — no background, compact, anchored above the dot
  const fleetModes = Object.entries(hubData || {}).filter(([k, v]) => k !== '_total' && v > 0)
  const lbl = document.createElement('div')
  lbl.style.cssText = `font-family:${F};font-size:7.5px;color:#111;text-align:center;white-space:nowrap;margin-bottom:2px;line-height:1.5;`

  const namePart = hub?.name || hub?.labelBus || ''
  const areaPart = hub?.area > 0 ? ` · ${fmtArea(hub.area)}` : ''
  const fleetPart = fleetModes.map(([k, v]) => `${MODE_META[k]?.label||k} ×${v}`).join(' · ')
  const totalPart = hubData?._total ? ` · total ×${hubData._total}` : ''

  lbl.innerHTML = [
    `<b>${TIER_LABEL[tier]}</b>${namePart ? ` · ${namePart}` : ''} · ${status}${areaPart}`,
    fleetPart + totalPart,
  ].filter(Boolean).join('<br>')

  el.appendChild(lbl)

  // Stem + dot
  const stem = document.createElement('div')
  stem.style.cssText = 'width:1px;height:5px;background:#aaa;'
  const dot = document.createElement('div')
  dot.style.cssText = `width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:#111;flex-shrink:0;`
  el.appendChild(stem)
  el.appendChild(dot)
  return el
}

// ── Line GeoJSON builder ──────────────────────────────────────────────────────
function linesFC(pairs) {
  return { type: 'FeatureCollection', features: pairs.map(([c1, c2]) =>
    ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c1, c2] }, properties: {} })) }
}

// ── Hub Network — single grey layer, S hubs use 5km so outlying areas connect ─
function buildHubNetwork(lHubs, mHubs, sHubs) {
  const hubList = [
    ...lHubs.map(h => ({ lat: h.lat, lon: h.lon ?? h.lng, cov: NET_COV.l })),
    ...mHubs.map(h => ({ lat: h.lat, lon: h.lon ?? h.lng, cov: NET_COV.m })),
    ...sHubs.map(h => ({ lat: h.lat, lon: h.lng,           cov: NET_COV.s })),
  ]
  const pairs = []
  for (let i = 0; i < hubList.length; i++) {
    const a = hubList[i]
    for (let j = i + 1; j < hubList.length; j++) {
      const b = hubList[j]
      if (hav(a.lat, a.lon, b.lat, b.lon) <= Math.max(a.cov, b.cov))
        pairs.push([[a.lon, a.lat], [b.lon, b.lat]])
    }
  }
  return linesFC(pairs)
}

// ── Facility Network — single blue layer ──────────────────────────────────────
function extractFacilityPoints(venues, localFacilities) {
  const pts = []
  for (const v of (venues || []))
    if (v.lat && v.lng && inCity(v.lng, v.lat)) pts.push([v.lng, v.lat])
  for (const f of (localFacilities?.features || [])) {
    const g = f.geometry, p = f.properties || {}
    if (!g) continue
    if (EXCL_AMENITY.has(p.amenity) || EXCL_LANDUSE.has(p.landuse) || EXCL_NATURAL.has(p.natural)) continue
    let c = null
    if (g.type === 'Point') c = g.coordinates
    else if (g.type === 'Polygon') c = ringCentroid(g.coordinates[0])
    else if (g.type === 'MultiPolygon') c = ringCentroid(g.coordinates[0][0])
    if (c && inCity(c[0], c[1])) pts.push(c)
  }
  return pts
}

function buildFacilityNetwork(lHubs, mHubs, sHubs, venues, localFacilities) {
  const pts = extractFacilityPoints(venues, localFacilities)
  const pairs = []
  for (const hub of lHubs) {
    const lon = hub.lon ?? hub.lng
    for (const [fLon, fLat] of pts)
      if (hav(hub.lat, lon, fLat, fLon) <= NET_COV.l) pairs.push([[lon, hub.lat], [fLon, fLat]])
  }
  for (const hub of mHubs) {
    const lon = hub.lon ?? hub.lng
    for (const [fLon, fLat] of pts)
      if (hav(hub.lat, lon, fLat, fLon) <= NET_COV.m) pairs.push([[lon, hub.lat], [fLon, fLat]])
  }
  for (const hub of sHubs)
    for (const [fLon, fLat] of pts)
      if (hav(hub.lat, hub.lng, fLat, fLon) <= NET_COV.s) pairs.push([[hub.lng, hub.lat], [fLon, fLat]])
  return { lines: linesFC(pairs), pts }
}

// ── External Flows ────────────────────────────────────────────────────────────
function buildExternalFlows(lHubs) {
  if (!lHubs.length) return linesFC([])
  const pairs = COMMUTER_CITIES.map(city => {
    let best = lHubs[0], bestD = Infinity
    for (const h of lHubs) {
      const d = hav(city.lat, city.lon, h.lat, h.lon ?? h.lng)
      if (d < bestD) { bestD = d; best = h }
    }
    return [[city.lon, city.lat], [best.lon ?? best.lng, best.lat]]
  })
  return linesFC(pairs)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HubMapSection({ tab = 'placement', onTabChange, netTab = 'hub-net', onNetTabChange }) {
  const mapDivRef       = useRef(null)
  const mapRef          = useRef(null)
  const fleetMarkersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)
  const setNetTab = onNetTabChange || (() => {})
  const autoTriggeredRef        = useRef(false)
  const prevNetTab              = useRef(null)

  const store = useAppStore()
  const {
    hubLMResults, hubSBusOnly,
    hubLMShowL, hubLMShowM, hubLMShowS,
    hubLMSStatusFilter,
    districtBoundaries,
    localCarParkings, localBusStops,
    landingCityGeoJSON, setLandingCityGeoJSON,
    venues, localFacilities,
    roads, localCyclingOfficial,
  } = store

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return
    const map = new maplibregl.Map({
      container: mapDivRef.current, style: BLANK_STYLE, center: CENTER, zoom: ZOOM, attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
    mapRef.current = map

    map.on('load', () => {
      map.addSource('districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

      // Roads background — shared across Placement, Fleet, Hub Network, Facility Network
      map.addSource('bg-roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bg-roads-layer', type: 'line', source: 'bg-roads', layout: { visibility: 'none' },
        paint: { 'line-color': '#000000', 'line-width': 0.5, 'line-opacity': 0.3 } })
      map.addSource('bg-cycling', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'bg-cycling-layer', type: 'line', source: 'bg-cycling', layout: { visibility: 'none' },
        paint: { 'line-color': '#000000', 'line-width': 0.5, 'line-opacity': 0.3 } })

      // Fleet coverage circles
      for (const id of ['fleet-cov-l', 'fleet-cov-m', 'fleet-cov-s']) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' },
          paint: { 'fill-color': '#FFD200', 'fill-opacity': 0.08 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': '#FFD200', 'line-width': 1.5, 'line-opacity': 0.75 } })
      }

      // Hub Network lines
      map.addSource('hn-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'hn-lines-layer', type: 'line', source: 'hn-lines', layout: { visibility: 'none' },
        paint: { 'line-color': '#999999', 'line-width': 0.5, 'line-opacity': 0.15 } })

      // Facility Network lines
      map.addSource('fn-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'fn-lines-layer', type: 'line', source: 'fn-lines', layout: { visibility: 'none' },
        paint: { 'line-color': '#10069F', 'line-width': 0.5, 'line-opacity': 0.15 } })
      map.addSource('fn-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'fn-dots-layer', type: 'circle', source: 'fn-dots', layout: { visibility: 'none' },
        paint: { 'circle-color': '#10069F', 'circle-radius': 1.5, 'circle-opacity': 0.5, 'circle-stroke-width': 0 } })

      // External flows
      map.addSource('ef-city-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-city-fill-layer', type: 'fill', source: 'ef-city-fill', layout: { visibility: 'none' },
        paint: { 'fill-color': '#FF0800', 'fill-opacity': 0.04 } })
      map.addLayer({ id: 'ef-city-line-layer', type: 'line', source: 'ef-city-fill', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 0.8, 'line-opacity': 0.35, 'line-dasharray': [4, 3] } })
      map.addSource('ef-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-lines-layer', type: 'line', source: 'ef-lines', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 0.5, 'line-opacity': 0.5 } })

      // Hub dots — below city mask so dots outside city boundary are clipped
      map.addSource('pl-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      for (const [tier, color, r] of [['l', TC.l, 8], ['m', TC.m, 6], ['s', TC.s, 4]])
        map.addLayer({ id: `pl-dot-${tier}`, type: 'circle', source: 'pl-dots',
          filter: ['==', ['get', 'tier'], tier], layout: { visibility: 'none' },
          paint: { 'circle-color': color, 'circle-radius': r, 'circle-opacity': 1, 'circle-stroke-width': 0 } })

      // City mask — above hub dots, clips outside-city area
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // Above mask
      map.addSource('ef-hub-l', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-hub-l-layer', type: 'circle', source: 'ef-hub-l', layout: { visibility: 'none' },
        paint: { 'circle-color': TC.l, 'circle-radius': 8, 'circle-opacity': 1,
                 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addSource('ef-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-labels-layer', type: 'symbol', source: 'ef-labels',
        layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
                  'text-size': 10, 'text-anchor': 'center', 'text-offset': [0, 2.2], 'text-allow-overlap': true },
        paint: { 'text-color': '#FF0800', 'text-opacity': 0.9 } })

      map.addSource('grid', { type: 'geojson', data: buildGraticule() })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

      map.addSource('dist-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-centroids',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
                  'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
        paint: { 'text-color': '#555555', 'text-opacity': 0.85 } })

      map.addSource('city-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-boundary-line', type: 'line', source: 'city-boundary',
        paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })

      setMapReady(true)
    })

    return () => { fleetMarkersRef.current.forEach(m => m.remove()); map.remove(); mapRef.current = null }
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
    try { const raw = localStorage.getItem('wolfsburg_city_boundary_v1'); if (raw) { applyCity(JSON.parse(raw)); return } } catch (_) {}
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
    for (const [, fc] of Object.entries(districtBoundaries)) if (fc?.features) features.push(...fc.features)
    mapRef.current?.getSource('districts')?.setData({ type: 'FeatureCollection', features })
    mapRef.current?.getSource('dist-centroids')?.setData(buildCentroids(districtBoundaries))
  }, [mapReady, districtBoundaries])

  // ── Road data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    if (roads) mapRef.current?.getSource('bg-roads')?.setData(roads)
    if (localCyclingOfficial) mapRef.current?.getSource('bg-cycling')?.setData(localCyclingOfficial)
  }, [mapReady, roads, localCyclingOfficial])

  // ── Auto-run hub algorithm ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !localCarParkings || !localBusStops || hubLMResults || autoTriggeredRef.current) return
    autoTriggeredRef.current = true; buildRunAllHubs(store)()
  }, [mapReady, localCarParkings, localBusStops, hubLMResults])

  // ── Hub dots source ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const features = []
    for (const h of (hubLMResults?.hubL?.hubs || []))
      if (inCity(h.lon ?? h.lng, h.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: { tier: 'l' } })
    for (const h of (hubLMResults?.hubM?.hubs || []))
      if (inCity(h.lon ?? h.lng, h.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: { tier: 'm' } })
    for (const h of (hubSBusOnly || []).filter(h => (hubLMSStatusFilter === 'all' || h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat)))
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] }, properties: { tier: 's' } })
    mapRef.current.getSource('pl-dots')?.setData({ type: 'FeatureCollection', features })
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMSStatusFilter])

  // ── Layer visibility ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const show = (id, v) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none') }
    const isPl = tab === 'placement', isFl = tab === 'fleet', isNet = tab === 'network'
    const isHN = isNet && netTab === 'hub-net', isFN = isNet && netTab === 'fac-net', isEF = isNet && netTab === 'ext-flow'

    show('city-mask-fill', !isEF)

    // Roads background: Placement, Fleet, Hub Network, Facility Network
    show('bg-roads-layer',   isPl || isFl || isHN || isFN)
    show('bg-cycling-layer', isPl || isFl || isHN || isFN)

    // Placement hub dots
    show('pl-dot-l', isPl && hubLMShowL); show('pl-dot-m', isPl && hubLMShowM); show('pl-dot-s', isPl && hubLMShowS)

    // Fleet circles (fleet markers are HTML — managed separately)
    show('fleet-cov-l-fill', isFl); show('fleet-cov-l-line', isFl)
    show('fleet-cov-m-fill', isFl); show('fleet-cov-m-line', isFl)
    show('fleet-cov-s-fill', isFl); show('fleet-cov-s-line', isFl)

    // District labels — hide in Fleet to keep map clean
    show('district-labels', !isFl)

    // Network Hubs — lines only, no hub dots
    show('hn-lines-layer', isHN)

    // Facility Network
    show('fn-lines-layer', isFN)
    show('fn-dots-layer', isFN)

    // External Flows
    show('ef-city-fill-layer', isEF); show('ef-city-line-layer', isEF)
    show('ef-lines-layer', isEF); show('ef-hub-l-layer', isEF); show('ef-labels-layer', isEF)

    const wasEF = prevNetTab.current === 'ext-flow'
    if (isEF && !wasEF) map.flyTo({ center: [10.7, 52.25], zoom: 7.8, duration: 700 })
    else if (!isEF && wasEF) map.flyTo({ center: CENTER, zoom: ZOOM, duration: 600 })
    prevNetTab.current = netTab
  }, [mapReady, tab, netTab, hubLMShowL, hubLMShowM, hubLMShowS])

  // ── Fleet info markers ────────────────────────────────────────────────────
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
    const cityGJ = landingCityGeoJSON
    const pip = (lon, lat) => pointInCity(lon, lat, cityGJ)

    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => pip(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => pip(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' || h.status === hubLMSStatusFilter) && pip(h.lng, h.lat))

    map.getSource('fleet-cov-l')?.setData(makeCirclesFC(lHubs, 4000))
    map.getSource('fleet-cov-m')?.setData(makeCirclesFC(mHubs, 2000))
    map.getSource('fleet-cov-s')?.setData(makeCirclesFC(sHubs, 500, 'lng', 'lat'))

    const fp = computeFleetPerHub(lHubs.length, mHubs.length, sHubs.length)
    const markers = []

    const addLabels = (hubs, tier, lk = 'lon', lak = 'lat') => {
      for (const hub of hubs) {
        const el = makeHubInfoEl(tier, hub, fp?.[`hub_${tier}`])
        markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([hub[lk] ?? hub.lng, hub[lak] ?? hub.lat]).addTo(map))
      }
    }
    addLabels(lHubs, 'l')
    addLabels(mHubs, 'm')
    addLabels(sHubs, 's', 'lng', 'lat')
    fleetMarkersRef.current = markers
  }, [mapReady, tab, hubLMResults, hubSBusOnly, hubLMSStatusFilter, landingCityGeoJSON])

  // ── Network data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || tab !== 'network' || !hubLMResults) return
    const map = mapRef.current
    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' || h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat))

    map.getSource('hn-lines')?.setData(buildHubNetwork(lHubs, mHubs, sHubs))

    const fn = buildFacilityNetwork(lHubs, mHubs, sHubs, venues, localFacilities)
    map.getSource('fn-lines')?.setData(fn.lines)
    map.getSource('fn-dots')?.setData({ type: 'FeatureCollection',
      features: fn.pts.map(([lon, lat]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} })) })

    map.getSource('ef-lines')?.setData(buildExternalFlows(lHubs))
    map.getSource('ef-city-fill')?.setData({ type: 'FeatureCollection',
      features: COMMUTER_CITIES.map(c => ({ ...circleGeo(c.lon, c.lat, 6000 + (c.count / 15000) * 6000), properties: {} })) })
    map.getSource('ef-labels')?.setData({ type: 'FeatureCollection',
      features: COMMUTER_CITIES.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: `${c.name}\n${(c.count / 1000).toFixed(0)}k/day` } })) })
    map.getSource('ef-hub-l')?.setData({ type: 'FeatureCollection',
      features: lHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: {} })) })
  }, [mapReady, tab, netTab, hubLMResults, hubSBusOnly, hubLMSStatusFilter, venues, localFacilities])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

      {mapReady && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2, background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E0E0E0', borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          {HUB_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              background: tab === id ? '#1D1D1F' : 'transparent',
              color:      tab === id ? '#fff'    : '#666',
              transition: 'background 0.15s, color 0.15s',
            }}>{label}</button>
          ))}
        </div>
      )}

      {mapReady && tab === 'network' && (
        <div style={{
          position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2, background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E0E0E0', borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)', zIndex: 10, whiteSpace: 'nowrap',
        }}>
          {NET_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setNetTab(id)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 11, fontWeight: 600,
              background: netTab === id ? '#1D1D1F' : 'transparent',
              color:      netTab === id ? '#fff'    : '#888',
              transition: 'background 0.15s, color 0.15s',
            }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
