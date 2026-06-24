import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const F      = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5
const BBOX   = { minLon: 10.55, maxLon: 10.95, minLat: 52.28, maxLat: 52.60 }

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

// ── Constants ─────────────────────────────────────────────────────────────────
const HUB_COLOR      = '#10069F'
const CAR_COLOR      = '#10069F'
const BUS_COLOR      = '#C90016'
const BIKE_COLOR     = '#1A7A00'
const COV_L_COLOR    = '#FFD200'
const COV_M_COLOR    = '#2D68C4'
const COV_S_COLOR    = '#FA2A55'
const ROAD_GREY      = '#AAAAAA'
const CYCLING_GREY   = '#999999'

// Road types to show (hide service, track, path, footway)
const ROAD_TYPES = ['motorway','motorway_link','trunk','trunk_link',
  'primary','primary_link','secondary','secondary_link',
  'tertiary','tertiary_link','residential','unclassified','living_street']

const ROAD_FILTER = ['in', ['get', 'highway'], ['literal', ROAD_TYPES]]

// Thicker widths
const ROAD_WIDTH = ['match', ['get', 'highway'],
  'motorway', 3.5, 'motorway_link', 2.5,
  'trunk', 3.0,    'trunk_link', 2.2,
  'primary', 2.5,  'primary_link', 2.0,
  'secondary', 1.8,'secondary_link', 1.5,
  'tertiary', 1.2, 'tertiary_link', 1.0,
  'residential', 0.8, 'living_street', 0.8, 'unclassified', 0.8,
  0.5,
]

// Zoom-interpolated radius expression for a given metres value
const radExpr = (rm) => ['interpolate', ['exponential', 2], ['zoom'],
  9,  rm * 0.00536,
  10, rm * 0.01073,
  11, rm * 0.02146,
  12, rm * 0.04301,
  13, rm * 0.08602,
  14, rm * 0.17204,
  15, rm * 0.34408,
]

// ── Geo helpers ───────────────────────────────────────────────────────────────
function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

function circleCoords(lon, lat, radiusM, steps = 48) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    pts.push([
      lon + (radiusM / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(a),
      lat + (radiusM / 110540) * Math.sin(a),
    ])
  }
  return pts
}

function inCity(lon, lat) {
  return lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat
}

function buildGraticule() {
  const features = [], lonStep = 0.015, latStep = 0.009
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

function buildDistrictLines(districtBoundaries) {
  const features = []
  for (const [, fc] of Object.entries(districtBoundaries))
    if (fc?.features) features.push(...fc.features)
  return { type: 'FeatureCollection', features }
}

// ── Hub geometry ──────────────────────────────────────────────────────────────
const EMPTY = { type: 'FeatureCollection', features: [] }

function linesFC(pairs) {
  return { type: 'FeatureCollection', features: pairs.map(([c1, c2]) =>
    ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c1, c2] }, properties: {} })) }
}

// k-nearest-neighbour triangulation (k=3) connecting all hub points
function buildTriangulation(lHubs, mHubs, sHubs) {
  const pts = [
    ...lHubs.filter(h => inCity(h.lon ?? h.lng, h.lat)).map(h => [h.lon ?? h.lng, h.lat]),
    ...mHubs.filter(h => inCity(h.lon ?? h.lng, h.lat)).map(h => [h.lon ?? h.lng, h.lat]),
    ...sHubs.filter(h => inCity(h.lng, h.lat)).map(h => [h.lng, h.lat]),
  ]
  const pairs = [], seen = new Set()
  for (let i = 0; i < pts.length; i++) {
    const dists = pts.map((p, j) => [j, hav(pts[i][1], pts[i][0], p[1], p[0])]).filter(([j]) => j !== i)
    dists.sort((a, b) => a[1] - b[1])
    for (const [j] of dists.slice(0, 3)) {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`
      if (!seen.has(key)) { seen.add(key); pairs.push([pts[i], pts[j]]) }
    }
  }
  return linesFC(pairs)
}

function buildAfterHubDots(lHubs, mHubs, sHubs) {
  const features = []
  const lon = h => h.lon ?? h.lng
  for (const h of lHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon(h), h.lat] }, properties: { tier: 'l' } })
  for (const h of mHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon(h), h.lat] }, properties: { tier: 'm' } })
  for (const h of sHubs) if (inCity(h.lng, h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] }, properties: { tier: 's' } })
  return { type: 'FeatureCollection', features }
}

// Coverage circles: L=800m, M=400m, S=200m
function buildAfterCoverage(lHubs, mHubs, sHubs) {
  const features = []
  const lon = h => h.lon ?? h.lng
  for (const h of sHubs) if (inCity(h.lng, h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(h.lng, h.lat, 200)] }, properties: { tier: 's' } })
  for (const h of mHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(lon(h), h.lat, 400)] }, properties: { tier: 'm' } })
  for (const h of lHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(lon(h), h.lat, 800)] }, properties: { tier: 'l' } })
  return { type: 'FeatureCollection', features }
}

// ── Single map ────────────────────────────────────────────────────────────────
function IntermodalMap({ id, side, layers, cityGeoJSON, districtBoundaries, onMove, syncRef }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady] = useState(false)
  const syncing = useRef(false)
  const graticule = useMemo(() => buildGraticule(), [])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current, style: BLANK_STYLE,
      center: CENTER, zoom: ZOOM, attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
    mapRef.current = map
    syncRef.current[id] = map
    map.on('load', () => setReady(true))
    map.on('move', () => {
      if (syncing.current) return
      onMove({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), sourceId: id })
    })
    return () => { delete syncRef.current[id]; map.remove(); mapRef.current = null; setReady(false) }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current._syncReceive = ({ center, zoom, bearing, pitch, sourceId }) => {
      if (sourceId === id) return
      syncing.current = true; mapRef.current.jumpTo({ center, zoom, bearing, pitch }); syncing.current = false
    }
  }, [id])

  // Build layers on load
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    const addSrc = (sid, data) => { if (!map.getSource(sid)) map.addSource(sid, { type: 'geojson', data: data || EMPTY }) }

    addSrc('districts', EMPTY)
    addSrc('roads', EMPTY)
    addSrc('cycling', EMPTY)
    addSrc('city-mask', EMPTY)
    addSrc('city-bound', EMPTY)
    addSrc('grid', graticule)
    addSrc('dist-labels', EMPTY)

    if (side === 'before') {
      addSrc('car-parks', EMPTY)
      addSrc('bus-stops', EMPTY)
      addSrc('bike-parks', EMPTY)
    } else {
      addSrc('hub-tri', EMPTY)
      addSrc('hub-cov', EMPTY)
      addSrc('hub-dots', EMPTY)
    }

    // 1. District outlines
    map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
      paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

    if (side === 'before') {
      // Roads — light grey, thicker hierarchical widths
      map.addLayer({ id: 'roads-layer', type: 'line', source: 'roads',
        filter: ROAD_FILTER,
        paint: { 'line-color': ROAD_GREY, 'line-width': ROAD_WIDTH, 'line-opacity': 1 } })

      // Cycling paths — same grey
      map.addLayer({ id: 'cycling-layer', type: 'line', source: 'cycling',
        paint: { 'line-color': CYCLING_GREY, 'line-width': 1.2, 'line-opacity': 1 } })

      // Point layers — ×3 radii, no opacity
      // Car parking — #10069F, 300m
      map.addLayer({ id: 'car-park-layer', type: 'circle', source: 'car-parks',
        paint: { 'circle-color': CAR_COLOR, 'circle-opacity': 1, 'circle-stroke-width': 0,
          'circle-radius': radExpr(300) } })
      // Bus stops — #C90016, 210m
      map.addLayer({ id: 'bus-stop-layer', type: 'circle', source: 'bus-stops',
        paint: { 'circle-color': BUS_COLOR, 'circle-opacity': 1, 'circle-stroke-width': 0,
          'circle-radius': radExpr(210) } })
      // Bike parking — green, 150m
      map.addLayer({ id: 'bike-park-layer', type: 'circle', source: 'bike-parks',
        paint: { 'circle-color': BIKE_COLOR, 'circle-opacity': 1, 'circle-stroke-width': 0,
          'circle-radius': radExpr(150) } })

    } else {
      // Triangulation network — full opacity, thicker
      map.addLayer({ id: 'hub-tri-layer', type: 'line', source: 'hub-tri',
        paint: { 'line-color': HUB_COLOR, 'line-width': 1.0, 'line-opacity': 1 } })

      // Coverage circles — solid fill, no stroke
      const covColor = ['match', ['get', 'tier'], 'l', COV_L_COLOR, 'm', COV_M_COLOR, COV_S_COLOR]
      map.addLayer({ id: 'hub-cov-fill', type: 'fill', source: 'hub-cov',
        paint: { 'fill-color': covColor, 'fill-opacity': 1 } })

      // Roads — #10069F, full opacity, thicker
      map.addLayer({ id: 'roads-layer', type: 'line', source: 'roads',
        filter: ROAD_FILTER,
        paint: { 'line-color': HUB_COLOR, 'line-width': ROAD_WIDTH, 'line-opacity': 1 } })

      // Cycling paths — same blue
      map.addLayer({ id: 'cycling-layer', type: 'line', source: 'cycling',
        paint: { 'line-color': HUB_COLOR, 'line-width': 1.2, 'line-opacity': 1 } })

      // Hub dots — all #10069F, ×3 radii, no opacity
      map.addLayer({ id: 'hub-l-layer', type: 'circle', source: 'hub-dots',
        filter: ['==', ['get', 'tier'], 'l'],
        paint: { 'circle-color': HUB_COLOR, 'circle-radius': radExpr(300),
          'circle-opacity': 1, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } })
      map.addLayer({ id: 'hub-m-layer', type: 'circle', source: 'hub-dots',
        filter: ['==', ['get', 'tier'], 'm'],
        paint: { 'circle-color': HUB_COLOR, 'circle-radius': radExpr(210),
          'circle-opacity': 1, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 } })
      map.addLayer({ id: 'hub-s-layer', type: 'circle', source: 'hub-dots',
        filter: ['==', ['get', 'tier'], 's'],
        paint: { 'circle-color': HUB_COLOR, 'circle-radius': radExpr(150),
          'circle-opacity': 1, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.8 } })
    }

    // City mask
    map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

    // Graticule
    map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
      paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

    // District labels
    map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-labels',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
        'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false },
      paint: { 'text-color': '#555555', 'text-opacity': 0.85 } })

    // City boundary (topmost)
    map.addLayer({ id: 'city-bound-line', type: 'line', source: 'city-bound',
      paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })
  }, [ready, side])

  // City mask + boundary
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !cityGeoJSON) return
    map.getSource('city-mask')?.setData(buildCityMask(cityGeoJSON))
    map.getSource('city-bound')?.setData(cityGeoJSON)
  }, [ready, cityGeoJSON])

  // Districts
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !Object.keys(districtBoundaries).length) return
    map.getSource('districts')?.setData(buildDistrictLines(districtBoundaries))
    map.getSource('dist-labels')?.setData(buildCentroids(districtBoundaries))
  }, [ready, districtBoundaries])

  // Road data
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    map.getSource('roads')?.setData(layers.roads || EMPTY)
  }, [ready, layers.roads])

  // Cycling data — separate effect so it fires independently when data arrives
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    if (layers.cycling) map.getSource('cycling')?.setData(layers.cycling)
  }, [ready, layers.cycling])

  // Before-specific point data
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || side !== 'before') return
    map.getSource('car-parks')?.setData(layers.carPark || EMPTY)
    map.getSource('bus-stops')?.setData(layers.busStops || EMPTY)
    map.getSource('bike-parks')?.setData(layers.bikePark || EMPTY)
  }, [ready, side, layers.carPark, layers.busStops, layers.bikePark])

  // After-specific hub data
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || side !== 'after') return
    map.getSource('hub-tri')?.setData(layers.hubTri || EMPTY)
    map.getSource('hub-cov')?.setData(layers.hubCov || EMPTY)
    map.getSource('hub-dots')?.setData(layers.hubDots || EMPTY)
  }, [ready, side, layers.hubTri, layers.hubCov, layers.hubDots])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Legend atoms ──────────────────────────────────────────────────────────────
function LegendRow({ children, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ flexShrink: 0 }}>{children}</div>
      <span style={{ fontFamily: F, fontSize: 10, color: '#666' }}>{label}</span>
    </div>
  )
}

function CircleSvg({ r, fill, stroke, strokeW = 0, opacity = 1 }) {
  const s = r * 2 + (strokeW > 0 ? 4 : 2)
  return (
    <svg width={s} height={s}>
      <circle cx={s / 2} cy={s / 2} r={r} fill={fill} fillOpacity={opacity}
        stroke={stroke} strokeWidth={strokeW} />
    </svg>
  )
}

function LineSvg({ color, width = 1.5, dash }) {
  return (
    <svg width={24} height={10}>
      <line x1={0} y1={5} x2={24} y2={5} stroke={color} strokeWidth={width}
        strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────
function mergeCycling(a, b) {
  const features = [
    ...(a?.features || []),
    ...(b?.features || []),
  ]
  return features.length ? { type: 'FeatureCollection', features } : null
}

export default function ComparativeAnalysisSection() {
  const {
    roads, localCycling, localCyclingOfficial,
    localBusStops, localBikeParkings, localCarParkings,
    hubLMResults, hubSBusOnly,
    landingCityGeoJSON, setLandingCityGeoJSON,
    districtBoundaries,
  } = useAppStore()

  const cyclingData = useMemo(
    () => mergeCycling(localCycling, localCyclingOfficial),
    [localCycling, localCyclingOfficial],
  )

  const syncRef = useRef({})

  useEffect(() => {
    if (landingCityGeoJSON) return
    try {
      const raw = localStorage.getItem('wolfsburg_city_boundary_v1')
      if (raw) { setLandingCityGeoJSON(JSON.parse(raw)); return }
    } catch (_) {}
    const q = `[out:json][timeout:30];relation["boundary"="administrative"]["name"="Wolfsburg"]["admin_level"="6"];out geom;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: `data=${encodeURIComponent(q)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then(r => r.json()).then(data => {
      const gj = osmtogeojson(data)
      try { localStorage.setItem('wolfsburg_city_boundary_v1', JSON.stringify(gj)) } catch (_) {}
      setLandingCityGeoJSON(gj)
    }).catch(() => {})
  }, [landingCityGeoJSON])

  const handleMove = useCallback((evt) => {
    for (const [id, map] of Object.entries(syncRef.current))
      if (id !== evt.sourceId) map._syncReceive?.(evt)
  }, [])

  const hubGeo = useMemo(() => {
    const lH = hubLMResults?.hubL?.hubs || []
    const mH = hubLMResults?.hubM?.hubs || []
    const sH = hubSBusOnly || []
    if (!lH.length && !mH.length && !sH.length)
      return { tri: EMPTY, dots: EMPTY, cov: EMPTY }
    return {
      tri:  buildTriangulation(lH, mH, sH),
      dots: buildAfterHubDots(lH, mH, sH),
      cov:  buildAfterCoverage(lH, mH, sH),
    }
  }, [hubLMResults, hubSBusOnly])

  const beforeLayers = useMemo(() => ({
    roads,
    cycling:  cyclingData,
    carPark:  localCarParkings,
    busStops: localBusStops,
    bikePark: localBikeParkings,
  }), [roads, cyclingData, localCarParkings, localBusStops, localBikeParkings])

  const afterLayers = useMemo(() => ({
    roads,
    cycling:  cyclingData,
    hubTri:   hubGeo.tri,
    hubDots:  hubGeo.dots,
    hubCov:   hubGeo.cov,
  }), [roads, cyclingData, hubGeo])

  const hasHubs = (hubLMResults?.hubL?.hubs?.length || 0) + (hubSBusOnly?.length || 0) > 0

  const GAP = 10

  return (
    <section style={{ background: '#fff', borderTop: '2px solid #111' }}>
      {/* Header */}
      <div style={{ padding: '40px 72px 36px', borderBottom: '1px solid #E8E8E8' }}>
        <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>
          05 — Comparative Analysis · Before / After
        </div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 10px' }}>
          Intermodal Connectivity
        </h2>
        <p style={{ fontFamily: F, fontSize: 12, color: '#888', lineHeight: 1.7, maxWidth: 600, margin: 0 }}>
          Before: car parkings, bus stops, and bicycle parking exist as isolated mode-specific
          infrastructure with no physical interchange. After: hub nodes co-locate all modes,
          enabling seamless transfers — bike → bus → autonomous shuttle — within a single journey.
        </p>
      </div>

      {/* Two map columns */}
      <div style={{ display: 'flex' }}>

        {/* ── LEFT — Before ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid #E8E8E8' }}>
          <div style={{ height: '72vh', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 10,
              background: 'rgba(255,255,255,0.92)', border: '1px solid #E0E0E0',
              borderRadius: 6, padding: '6px 14px',
              fontFamily: F, fontSize: 11, fontWeight: 700, color: '#444',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              Before — Isolated Networks
            </div>
            <IntermodalMap id="before" side="before" layers={beforeLayers}
              cityGeoJSON={landingCityGeoJSON} districtBoundaries={districtBoundaries}
              onMove={handleMove} syncRef={syncRef} />
          </div>

          {/* Left legend */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E8', display: 'flex', flexWrap: 'wrap', gap: `${GAP}px 20px` }}>
            <LegendRow label="Roads &amp; cycling paths">
              <LineSvg color={ROAD_GREY} width={2} />
            </LegendRow>
            <LegendRow label="Car parking">
              <CircleSvg r={6} fill={CAR_COLOR} />
            </LegendRow>
            <LegendRow label="Bus stops">
              <CircleSvg r={5} fill={BUS_COLOR} />
            </LegendRow>
            <LegendRow label="Bike parking">
              <CircleSvg r={4} fill={BIKE_COLOR} />
            </LegendRow>
          </div>
        </div>

        {/* ── RIGHT — After ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '72vh', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 10,
              background: 'rgba(255,255,255,0.92)', border: `1px solid ${HUB_COLOR}44`,
              borderRadius: 6, padding: '6px 14px',
              fontFamily: F, fontSize: 11, fontWeight: 700, color: HUB_COLOR,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              After — Hub System
            </div>
            {!hasHubs && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: F, fontSize: 11, color: '#AAA' }}>Hub data loading…</span>
              </div>
            )}
            <IntermodalMap id="after" side="after" layers={afterLayers}
              cityGeoJSON={landingCityGeoJSON} districtBoundaries={districtBoundaries}
              onMove={handleMove} syncRef={syncRef} />
          </div>

          {/* Right legend */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E8', display: 'flex', flexWrap: 'wrap', gap: `${GAP}px 20px` }}>
            <LegendRow label="Hub L">
              <CircleSvg r={7} fill={HUB_COLOR} stroke="#fff" strokeW={1.5} />
            </LegendRow>
            <LegendRow label="Hub M">
              <CircleSvg r={5} fill={HUB_COLOR} stroke="#fff" strokeW={1.2} />
            </LegendRow>
            <LegendRow label="Hub S">
              <CircleSvg r={4} fill={HUB_COLOR} stroke="#fff" strokeW={0.8} />
            </LegendRow>
            <LegendRow label="Hub L coverage">
              <CircleSvg r={7} fill={COV_L_COLOR} stroke={COV_L_COLOR} strokeW={1.5} opacity={0.2} />
            </LegendRow>
            <LegendRow label="Hub M coverage">
              <CircleSvg r={5} fill={COV_M_COLOR} stroke={COV_M_COLOR} strokeW={1.5} opacity={0.2} />
            </LegendRow>
            <LegendRow label="Hub S coverage">
              <CircleSvg r={4} fill={COV_S_COLOR} stroke={COV_S_COLOR} strokeW={1.5} opacity={0.2} />
            </LegendRow>
            <LegendRow label="Hub connection network">
              <LineSvg color={HUB_COLOR} width={1.2} />
            </LegendRow>
            <LegendRow label="Roads &amp; cycling paths">
              <LineSvg color={HUB_COLOR} width={2} />
            </LegendRow>
          </div>
        </div>
      </div>
    </section>
  )
}
