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

const TC = { l: '#111111', m: '#01796F', s: '#3EA055' }

export const HUB_TABS = [
  { id: 'placement', label: 'Hub Placement' },
  { id: 'fleet',     label: 'Fleet'          },
  { id: 'network',   label: 'Network'         },
]

const NET_TABS = [
  { id: 'hub-net',   label: 'Network Hubs'    },
  { id: 'fac-net',   label: 'Facility Network' },
  { id: 'ext-flow',  label: 'External Flows'   },
]

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

// External commuter cities (Pendleratlas BA 2022 estimates)
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

// Facility categories to exclude (non-trip-generating land uses)
const EXCLUDED_CATS = new Set(['parking', 'forest', 'meadow', 'farmland', 'water', 'natural'])

// ── Geo helpers ───────────────────────────────────────────────────────────────
function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
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
  const f = [], ls = 0.015, as = 0.009
  const [a, b, c, d] = [8.0, 15.0, 49.0, 56.0]
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

// ── Fleet bar marker ──────────────────────────────────────────────────────────
function fleetTotal(fp, tier) {
  const data = fp?.[`hub_${tier}`] || {}
  return Object.values(data).reduce((s, v) => s + v, 0)
}

function makeBarEl(tier, total, maxTotal) {
  const color = TC[tier] || '#111'
  const w = tier === 'l' ? 10 : tier === 'm' ? 7 : 5
  const h = Math.max(5, Math.round((total / Math.max(1, maxTotal)) * 72))
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'
  el.innerHTML = `<div style="width:${w}px;height:${h}px;background:${color};flex-shrink:0;border-radius:1px 1px 0 0;"></div>`
  return el
}

// ── Line GeoJSON builder ──────────────────────────────────────────────────────
function lines(pairs) {
  return { type: 'FeatureCollection', features: pairs.map(([c1, c2]) =>
    ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c1, c2] }, properties: {} })) }
}

// ── Hub Network algorithms ────────────────────────────────────────────────────
function buildHubNetwork(lHubs, mHubs, sHubs) {
  const blackPairs = []  // L-L: autonomous bus
  const tealPairs  = []  // L-M (≤1500m) + M-M (≤1000m): shuttle + pod
  const greenPairs = []  // M-S (≤600m) + S-S (≤400m): pod + e-bike

  // L-L: full mesh, no distance limit
  for (let i = 0; i < lHubs.length; i++)
    for (let j = i + 1; j < lHubs.length; j++)
      blackPairs.push([[lHubs[i].lon ?? lHubs[i].lng, lHubs[i].lat],
                       [lHubs[j].lon ?? lHubs[j].lng, lHubs[j].lat]])

  // L-M: ≤1500m
  for (const l of lHubs) {
    const lLon = l.lon ?? l.lng
    for (const m of mHubs) {
      const mLon = m.lon ?? m.lng
      if (hav(l.lat, lLon, m.lat, mLon) <= 1500)
        tealPairs.push([[lLon, l.lat], [mLon, m.lat]])
    }
  }

  // M-M: ≤1000m
  for (let i = 0; i < mHubs.length; i++)
    for (let j = i + 1; j < mHubs.length; j++) {
      const mLon1 = mHubs[i].lon ?? mHubs[i].lng, mLon2 = mHubs[j].lon ?? mHubs[j].lng
      if (hav(mHubs[i].lat, mLon1, mHubs[j].lat, mLon2) <= 1000)
        tealPairs.push([[mLon1, mHubs[i].lat], [mLon2, mHubs[j].lat]])
    }

  // M-S: ≤600m
  for (const m of mHubs) {
    const mLon = m.lon ?? m.lng
    for (const s of sHubs)
      if (hav(m.lat, mLon, s.lat, s.lng) <= 600)
        greenPairs.push([[mLon, m.lat], [s.lng, s.lat]])
  }

  // S-S: ≤400m
  for (let i = 0; i < sHubs.length; i++)
    for (let j = i + 1; j < sHubs.length; j++)
      if (hav(sHubs[i].lat, sHubs[i].lng, sHubs[j].lat, sHubs[j].lng) <= 400)
        greenPairs.push([[sHubs[i].lng, sHubs[i].lat], [sHubs[j].lng, sHubs[j].lat]])

  return { black: lines(blackPairs), teal: lines(tealPairs), green: lines(greenPairs) }
}

// ── Facility Network algorithm ────────────────────────────────────────────────
function buildFacilityNetwork(lHubs, mHubs, sHubs, venues) {
  const allHubs = [
    ...lHubs.map(h => ({ tier: 'l', lat: h.lat, lon: h.lon ?? h.lng })),
    ...mHubs.map(h => ({ tier: 'm', lat: h.lat, lon: h.lon ?? h.lng })),
    ...sHubs.map(h => ({ tier: 's', lat: h.lat, lon: h.lng })),
  ]
  const lPairs = [], mPairs = [], sPairs = []
  for (const v of (venues || [])) {
    if (!v.lat || !v.lng) continue
    const cat = (v.category || v.type || '').toLowerCase()
    if (EXCLUDED_CATS.has(cat)) continue
    let best = null, bestD = Infinity
    for (const h of allHubs) {
      const d = hav(v.lat, v.lng, h.lat, h.lon)
      if (d < bestD) { bestD = d; best = h }
    }
    if (!best || bestD > 800) continue
    const pair = [[best.lon, best.lat], [v.lng, v.lat]]
    if (best.tier === 'l') lPairs.push(pair)
    else if (best.tier === 'm') mPairs.push(pair)
    else sPairs.push(pair)
  }
  return { black: lines(lPairs), teal: lines(mPairs), green: lines(sPairs) }
}

// ── External Commuter Flows ───────────────────────────────────────────────────
function buildExternalFlows(lHubs) {
  const pairs = []
  for (const city of COMMUTER_CITIES) {
    if (!lHubs.length) continue
    let best = lHubs[0], bestD = Infinity
    for (const h of lHubs) {
      const d = hav(city.lat, city.lon, h.lat, h.lon ?? h.lng)
      if (d < bestD) { bestD = d; best = h }
    }
    pairs.push([[city.lon, city.lat], [best.lon ?? best.lng, best.lat]])
  }
  return lines(pairs)
}

function buildCityCircles() {
  const maxCount = COMMUTER_CITIES[0].count
  return { type: 'FeatureCollection', features: COMMUTER_CITIES.map(c => ({
    ...circleGeo(c.lon, c.lat, 6000 + (c.count / maxCount) * 6000),
    properties: {},
  })) }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HubMapSection({ tab = 'placement', onTabChange }) {
  const mapDivRef       = useRef(null)
  const mapRef          = useRef(null)
  const fleetMarkersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)
  const [netTab, setNetTab]     = useState('hub-net')
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
    venues,
  } = store

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: BLANK_STYLE, center: CENTER, zoom: ZOOM, attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
    mapRef.current = map

    map.on('load', () => {
      // Districts (always visible)
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

      // ── Network line sources (all below mask) ─────────────────────────────
      // Hub network: 3 color groups
      for (const [id, color] of [['hn-black', TC.l], ['hn-teal', TC.m], ['hn-green', TC.s]]) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-layer`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': color, 'line-width': 1, 'line-opacity': 0.6 } })
      }

      // Facility network: 3 color groups
      for (const [id, color] of [['fn-black', TC.l], ['fn-teal', TC.m], ['fn-green', TC.s]]) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-layer`, type: 'line', source: id, layout: { visibility: 'none' },
          paint: { 'line-color': color, 'line-width': 1, 'line-opacity': 0.6 } })
      }
      map.addSource('fn-venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'fn-venues-layer', type: 'circle', source: 'fn-venues', layout: { visibility: 'none' },
        paint: { 'circle-color': '#888', 'circle-radius': 2, 'circle-opacity': 0.7, 'circle-stroke-width': 0 } })

      // External flows (below mask — mask hidden for this view)
      map.addSource('ef-city-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-city-fill-layer', type: 'fill', source: 'ef-city-fill', layout: { visibility: 'none' },
        paint: { 'fill-color': '#FF0800', 'fill-opacity': 0.04 } })
      map.addLayer({ id: 'ef-city-line-layer', type: 'line', source: 'ef-city-fill', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 0.8, 'line-opacity': 0.35, 'line-dasharray': [4, 3] } })

      map.addSource('ef-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-lines-layer', type: 'line', source: 'ef-lines', layout: { visibility: 'none' },
        paint: { 'line-color': '#FF0800', 'line-width': 1, 'line-opacity': 0.6 } })

      // ── City mask ─────────────────────────────────────────────────────────
      map.addSource('city-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

      // ── Layers above mask ─────────────────────────────────────────────────
      // Placement dots
      map.addSource('pl-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      for (const [tier, color] of [['l', TC.l], ['m', TC.m], ['s', TC.s]]) {
        map.addLayer({ id: `pl-dot-${tier}`, type: 'circle', source: 'pl-dots',
          filter: ['==', ['get', 'tier'], tier],
          layout: { visibility: 'none' },
          paint: { 'circle-color': color, 'circle-radius': 7, 'circle-opacity': 1, 'circle-stroke-width': 0 } })
      }

      // Hub network node circles
      for (const [tier, color, r] of [['l', TC.l, 9], ['m', TC.m, 7], ['s', TC.s, 5]]) {
        map.addLayer({ id: `hn-dot-${tier}`, type: 'circle', source: 'pl-dots',
          filter: ['==', ['get', 'tier'], tier],
          layout: { visibility: 'none' },
          paint: { 'circle-color': color, 'circle-radius': r, 'circle-opacity': 1,
                   'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } })
      }

      // External flow Hub L markers (above mask)
      map.addSource('ef-hub-l', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-hub-l-layer', type: 'circle', source: 'ef-hub-l', layout: { visibility: 'none' },
        paint: { 'circle-color': TC.l, 'circle-radius': 8, 'circle-opacity': 1,
                 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

      // External city name labels (above mask)
      map.addSource('ef-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'ef-labels-layer', type: 'symbol', source: 'ef-labels', layout: { visibility: 'none' },
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
                  'text-size': 10, 'text-anchor': 'center', 'text-offset': [0, 2.2], 'text-allow-overlap': true },
        paint: { 'text-color': '#FF0800', 'text-opacity': 0.9 } })

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
    for (const [, fc] of Object.entries(districtBoundaries))
      if (fc?.features) features.push(...fc.features)
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

  // ── Hub dots source (placement + network nodes) ───────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const features = []
    for (const hub of (hubLMResults?.hubL?.hubs || []))
      if (inCity(hub.lon ?? hub.lng, hub.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lon ?? hub.lng, hub.lat] }, properties: { tier: 'l' } })
    for (const hub of (hubLMResults?.hubM?.hubs || []))
      if (inCity(hub.lon ?? hub.lng, hub.lat))
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lon ?? hub.lng, hub.lat] }, properties: { tier: 'm' } })
    for (const hub of (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat)))
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [hub.lng, hub.lat] }, properties: { tier: 's' } })
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

    // Placement
    show('pl-dot-l', isPl && hubLMShowL); show('pl-dot-m', isPl && hubLMShowM); show('pl-dot-s', isPl && hubLMShowS)

    // Fleet circles
    show('fleet-cov-l-fill', isFl); show('fleet-cov-l-line', isFl)
    show('fleet-cov-m-fill', isFl); show('fleet-cov-m-line', isFl)
    show('fleet-cov-s-fill', isFl); show('fleet-cov-s-line', isFl)

    // Hub network nodes + lines
    show('hn-dot-l', isHN); show('hn-dot-m', isHN); show('hn-dot-s', isHN)
    show('hn-black-layer', isHN); show('hn-teal-layer', isHN); show('hn-green-layer', isHN)

    // Facility network lines + dots
    show('fn-black-layer', isFN); show('fn-teal-layer', isFN); show('fn-green-layer', isFN)
    show('fn-venues-layer', isFN)

    // External flows
    show('ef-city-fill-layer', isEF); show('ef-city-line-layer', isEF)
    show('ef-lines-layer', isEF)
    show('ef-hub-l-layer', isEF); show('ef-labels-layer', isEF)

    // Zoom transitions
    const nowIsEF = isEF, wasEF = prevNetTab.current === 'ext-flow'
    if (nowIsEF && !wasEF) map.flyTo({ center: [10.7, 52.25], zoom: 7.8, duration: 700 })
    else if (!nowIsEF && wasEF) map.flyTo({ center: CENTER, zoom: ZOOM, duration: 600 })
    prevNetTab.current = netTab
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

    const fp = computeFleetPerHub(lHubs.length, mHubs.length, sHubs.length)
    const tl = fleetTotal(fp, 'l'), tm = fleetTotal(fp, 'm'), ts = fleetTotal(fp, 's')
    const max = Math.max(1, tl, tm, ts)
    const markers = []
    const addBars = (hubs, tier, lk = 'lon', lak = 'lat') => {
      for (const hub of hubs) {
        const el = makeBarEl(tier, fleetTotal(fp, tier), max)
        markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([hub[lk] ?? hub.lng, hub[lak] ?? hub.lat]).addTo(map))
      }
    }
    addBars(lHubs, 'l'); addBars(mHubs, 'm'); addBars(sHubs, 's', 'lng', 'lat')
    fleetMarkersRef.current = markers
  }, [mapReady, tab, hubLMResults, hubSBusOnly, hubLMSStatusFilter])

  // ── Network data computation ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || tab !== 'network' || !hubLMResults) return
    const map = mapRef.current

    const lHubs = (hubLMResults.hubL?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const mHubs = (hubLMResults.hubM?.hubs || []).filter(h => inCity(h.lon ?? h.lng, h.lat))
    const sHubs = (hubSBusOnly || []).filter(h =>
      (hubLMSStatusFilter === 'all' ? true : h.status === hubLMSStatusFilter) && inCity(h.lng, h.lat))

    // Hub network
    const hn = buildHubNetwork(lHubs, mHubs, sHubs)
    map.getSource('hn-black')?.setData(hn.black)
    map.getSource('hn-teal')?.setData(hn.teal)
    map.getSource('hn-green')?.setData(hn.green)

    // Facility network
    const fn = buildFacilityNetwork(lHubs, mHubs, sHubs, venues)
    map.getSource('fn-black')?.setData(fn.black)
    map.getSource('fn-teal')?.setData(fn.teal)
    map.getSource('fn-green')?.setData(fn.green)
    map.getSource('fn-venues')?.setData({ type: 'FeatureCollection',
      features: (venues || []).filter(v => v.lat && v.lng && inCity(v.lng, v.lat) &&
        !EXCLUDED_CATS.has((v.category || v.type || '').toLowerCase()))
        .map(v => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [v.lng, v.lat] }, properties: {} })) })

    // External flows
    map.getSource('ef-lines')?.setData(buildExternalFlows(lHubs))
    map.getSource('ef-city-fill')?.setData(buildCityCircles())
    map.getSource('ef-labels')?.setData({ type: 'FeatureCollection',
      features: COMMUTER_CITIES.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { name: `${c.name}\n${(c.count/1000).toFixed(0)}k` } })) })
    map.getSource('ef-hub-l')?.setData({ type: 'FeatureCollection',
      features: lHubs.map(h => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lon ?? h.lng, h.lat] }, properties: {} })) })
  }, [mapReady, tab, netTab, hubLMResults, hubSBusOnly, hubLMSStatusFilter, venues])

  const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

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
