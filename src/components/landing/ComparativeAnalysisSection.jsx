import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
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

const TC = { l: '#111111', m: '#01796F', s: '#3EA055' }
const NET_COV = { l: 6000, m: 4000, s: 5000 }

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
function linesFC(pairs) {
  return { type: 'FeatureCollection', features: pairs.map(([c1, c2]) =>
    ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c1, c2] }, properties: {} })) }
}

// Peak hour: only hierarchical connections L→M, L→S, M→S (not S→S)
function buildPeakHourNetwork(lHubs, mHubs, sHubs) {
  const pairs = []
  const lon = h => h.lon ?? h.lng

  for (const l of lHubs) {
    for (const m of mHubs)
      if (hav(l.lat, lon(l), m.lat, lon(m)) <= NET_COV.l)
        pairs.push([[lon(l), l.lat], [lon(m), m.lat]])
    for (const s of sHubs)
      if (hav(l.lat, lon(l), s.lat, s.lng) <= NET_COV.l)
        pairs.push([[lon(l), l.lat], [s.lng, s.lat]])
  }
  for (const m of mHubs)
    for (const s of sHubs)
      if (hav(m.lat, lon(m), s.lat, s.lng) <= NET_COV.m)
        pairs.push([[lon(m), m.lat], [s.lng, s.lat]])

  return linesFC(pairs)
}

function buildHubDots(lHubs, mHubs, sHubs) {
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

function buildCoverageCircles(lHubs, mHubs, sHubs) {
  const features = []
  const lon = h => h.lon ?? h.lng
  for (const h of sHubs) if (inCity(h.lng, h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(h.lng, h.lat, 400)] }, properties: { tier: 's' } })
  for (const h of mHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(lon(h), h.lat, 800)] }, properties: { tier: 'm' } })
  for (const h of lHubs) if (inCity(lon(h), h.lat))
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(lon(h), h.lat, 1200)] }, properties: { tier: 'l' } })
  return { type: 'FeatureCollection', features }
}

const EMPTY = { type: 'FeatureCollection', features: [] }

// ── Single map component ──────────────────────────────────────────────────────
function IntermodalMap({ id, layers, cityGeoJSON, districtBoundaries, onMove, syncRef }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady] = useState(false)
  const syncing = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: CENTER, zoom: ZOOM,
      attributionControl: false,
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
    mapRef.current = map
    syncRef.current[id] = map

    map.on('load', () => setReady(true))
    map.on('move', () => {
      if (syncing.current) return
      onMove({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), sourceId: id })
    })
    return () => {
      delete syncRef.current[id]
      map.remove(); mapRef.current = null; setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current._syncReceive = ({ center, zoom, bearing, pitch, sourceId }) => {
      if (sourceId === id) return
      syncing.current = true
      mapRef.current.jumpTo({ center, zoom, bearing, pitch })
      syncing.current = false
    }
  }, [id])

  // Add all layers on load
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const addSrc = (sid, data) => { if (!map.getSource(sid)) map.addSource(sid, { type: 'geojson', data: data || EMPTY }) }

    // Sources
    addSrc('districts',   EMPTY)
    addSrc('hub-net',     EMPTY)
    addSrc('hub-circles', EMPTY)
    addSrc('roads',       EMPTY)
    addSrc('busRoutes',   EMPTY)
    addSrc('cycling',     EMPTY)
    addSrc('carPark',     EMPTY)
    addSrc('bikePark',    EMPTY)
    addSrc('busStops',    EMPTY)
    addSrc('hub-dots',    EMPTY)
    addSrc('city-mask',   EMPTY)
    addSrc('city-bound',  EMPTY)
    addSrc('grid',        buildGraticule())
    addSrc('dist-labels', EMPTY)

    // ── Layer order (bottom → top) ────────────────────────────────────────────

    // 1. District boundary lines
    map.addLayer({ id: 'district-outline', type: 'line', source: 'districts',
      paint: { 'line-color': '#CCCCCC', 'line-width': 0.5, 'line-opacity': 0.8 } })

    // 2. Hub connections — BOTTOMMOST data layer, below everything
    map.addLayer({ id: 'hub-net-layer', type: 'line', source: 'hub-net',
      paint: { 'line-color': '#999999', 'line-width': 0.5, 'line-opacity': 0.3 } })

    // 3. Hub coverage circles (fill then stroke)
    map.addLayer({ id: 'hub-cov-fill', type: 'fill', source: 'hub-circles',
      paint: {
        'fill-color': ['match', ['get', 'tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'fill-opacity': 0.05,
      } })
    map.addLayer({ id: 'hub-cov-stroke', type: 'line', source: 'hub-circles',
      paint: {
        'line-color': ['match', ['get', 'tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'line-width': 0.7, 'line-opacity': 0.25, 'line-dasharray': [3, 4],
      } })

    // 4. Roads
    map.addLayer({ id: 'roads-layer', type: 'line', source: 'roads',
      paint: { 'line-color': '#CCCCCC', 'line-width': 0.6 } })

    // 5. Bus routes
    map.addLayer({ id: 'bus-routes-layer', type: 'line', source: 'busRoutes',
      paint: { 'line-color': '#5539CC', 'line-width': 1.2, 'line-opacity': 0.65 } })

    // 6. Cycling
    map.addLayer({ id: 'cycling-layer', type: 'line', source: 'cycling',
      paint: { 'line-color': '#004225', 'line-width': 1.0, 'line-opacity': 0.65 } })

    // 7. Point layers
    map.addLayer({ id: 'car-park-layer', type: 'circle', source: 'carPark',
      paint: { 'circle-radius': 1.5, 'circle-color': '#C10016', 'circle-opacity': 0.5 } })
    map.addLayer({ id: 'bike-park-layer', type: 'circle', source: 'bikePark',
      paint: { 'circle-radius': 1.5, 'circle-color': '#004225', 'circle-opacity': 0.6 } })
    map.addLayer({ id: 'bus-stops-layer', type: 'circle', source: 'busStops',
      paint: { 'circle-radius': 2, 'circle-color': '#5539CC', 'circle-opacity': 0.7 } })

    // 8. Hub dots (above stops, below mask)
    map.addLayer({ id: 'hub-dots-layer', type: 'circle', source: 'hub-dots',
      paint: {
        'circle-radius':       ['match', ['get', 'tier'], 'l', 7, 'm', 5, 3.5],
        'circle-color':        ['match', ['get', 'tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      } })

    // 9. City mask — clips everything outside city
    map.addLayer({ id: 'city-mask-fill', type: 'fill', source: 'city-mask',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 1 } })

    // 10. Graticule (above mask)
    map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
      paint: { 'line-color': '#BBBBBB', 'line-width': 0.4, 'line-opacity': 0.5, 'line-dasharray': [4, 6] } })

    // 11. District labels (above mask, above graticule)
    map.addLayer({ id: 'district-labels', type: 'symbol', source: 'dist-labels',
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
        'text-size': 9, 'text-anchor': 'center', 'text-allow-overlap': false,
      },
      paint: { 'text-color': '#555555', 'text-opacity': 0.85 },
    })

    // 12. City boundary (topmost — always visible)
    map.addLayer({ id: 'city-bound-line', type: 'line', source: 'city-bound',
      paint: { 'line-color': '#1D1D1F', 'line-width': 4, 'line-opacity': 0.95 } })
  }, [ready])

  // Update city mask + boundary
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !cityGeoJSON) return
    map.getSource('city-mask')?.setData(buildCityMask(cityGeoJSON))
    map.getSource('city-bound')?.setData(cityGeoJSON)
  }, [ready, cityGeoJSON])

  // Update districts
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !Object.keys(districtBoundaries).length) return
    map.getSource('districts')?.setData(buildDistrictLines(districtBoundaries))
    map.getSource('dist-labels')?.setData(buildCentroids(districtBoundaries))
  }, [ready, districtBoundaries])

  // Update transport layers
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    map.getSource('roads')?.setData(layers.roads || EMPTY)
    map.getSource('busRoutes')?.setData(layers.busRoutes || EMPTY)
    map.getSource('cycling')?.setData(layers.cycling || EMPTY)
    map.getSource('busStops')?.setData(layers.busStops || EMPTY)
    map.getSource('bikePark')?.setData(layers.bikePark || EMPTY)
    map.getSource('carPark')?.setData(layers.carPark || EMPTY)
  }, [ready, layers.roads, layers.busRoutes, layers.cycling, layers.busStops, layers.bikePark, layers.carPark])

  // Update hub layers
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    map.getSource('hub-net')?.setData(layers.hubNet || EMPTY)
    map.getSource('hub-dots')?.setData(layers.hubDots || EMPTY)
    map.getSource('hub-circles')?.setData(layers.hubCircles || EMPTY)
  }, [ready, layers.hubNet, layers.hubDots, layers.hubCircles])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function ComparativeAnalysisSection() {
  const {
    roads, localBusRoutes, localCyclingOfficial,
    localBusStops, localBikeParkings, localCarParkings,
    hubLMResults, hubSBusOnly,
    landingCityGeoJSON, setLandingCityGeoJSON,
    districtBoundaries,
  } = useAppStore()

  const syncRef = useRef({})

  useEffect(() => {
    if (landingCityGeoJSON) return
    fetch(`${import.meta.env.BASE_URL}wolfsburg_districts_union.geojson`)
      .then(r => r.json()).then(setLandingCityGeoJSON).catch(() => {})
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
      return { net: EMPTY, dots: EMPTY, circles: EMPTY }
    return {
      net:     buildPeakHourNetwork(lH, mH, sH),
      dots:    buildHubDots(lH, mH, sH),
      circles: buildCoverageCircles(lH, mH, sH),
    }
  }, [hubLMResults, hubSBusOnly])

  const baseLayers = useMemo(() => ({
    roads: roads, busRoutes: localBusRoutes, cycling: localCyclingOfficial,
    busStops: localBusStops, bikePark: localBikeParkings, carPark: localCarParkings,
    hubNet: EMPTY, hubDots: EMPTY, hubCircles: EMPTY,
  }), [roads, localBusRoutes, localCyclingOfficial, localBusStops, localBikeParkings, localCarParkings])

  const afterLayers = useMemo(() => ({
    ...baseLayers,
    hubNet: hubGeo.net, hubDots: hubGeo.dots, hubCircles: hubGeo.circles,
  }), [baseLayers, hubGeo])

  const hasHubs = (hubLMResults?.hubL?.hubs?.length || 0) + (hubSBusOnly?.length || 0) > 0

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
          Before: bus, cycling and road networks exist as isolated silos — no physical interchange
          points between modes. After: S/M/L hubs connect all modes at transfer nodes,
          enabling chains such as bike → bus → autonomous shuttle within a single journey.
          Connections shown reflect peak hour demand.
        </p>
      </div>

      {/* Two maps */}
      <div style={{ display: 'flex', height: '80vh' }}>
        {/* LEFT — Before */}
        <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #E8E8E8' }}>
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.92)', border: '1px solid #E0E0E0',
            borderRadius: 6, padding: '6px 14px',
            fontFamily: F, fontSize: 11, fontWeight: 700, color: '#444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            Before — Isolated Networks
          </div>
          <IntermodalMap id="before" layers={baseLayers}
            cityGeoJSON={landingCityGeoJSON} districtBoundaries={districtBoundaries}
            onMove={handleMove} syncRef={syncRef} />
        </div>

        {/* RIGHT — After */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.92)', border: `1px solid ${TC.s}44`,
            borderRadius: 6, padding: '6px 14px',
            fontFamily: F, fontSize: 11, fontWeight: 700, color: TC.s,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            After — Hub System · Peak Hour
          </div>
          {!hasHubs && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: F, fontSize: 11, color: '#AAA' }}>Hub data loading…</span>
            </div>
          )}
          <IntermodalMap id="after" layers={afterLayers}
            cityGeoJSON={landingCityGeoJSON} districtBoundaries={districtBoundaries}
            onMove={handleMove} syncRef={syncRef} />
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '14px 72px', borderTop: '1px solid #E8E8E8', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {[
          { color: '#CCCCCC', label: 'Roads',        line: true  },
          { color: '#5539CC', label: 'Bus routes',    line: true  },
          { color: '#004225', label: 'Cycling',       line: true  },
          { color: '#5539CC', label: 'Bus stops',     line: false },
          { color: '#004225', label: 'Bike parking',  line: false },
          { color: '#C10016', label: 'Car parking',   line: false },
        ].map(({ color, label, line }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {line
              ? <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={color} strokeWidth={2} /></svg>
              : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
            <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>{label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: '#E0E0E0' }} />
        {[
          { color: TC.l, label: 'Hub L' },
          { color: TC.m, label: 'Hub M' },
          { color: TC.s, label: 'Hub S' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>{label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: '#E0E0E0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="#999" strokeWidth={1} /></svg>
          <span style={{ fontFamily: F, fontSize: 10, color: '#888' }}>Hub connections (peak hour)</span>
        </div>
      </div>
    </section>
  )
}
