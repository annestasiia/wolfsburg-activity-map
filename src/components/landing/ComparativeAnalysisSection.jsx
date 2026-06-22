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
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#F9F9F7' } }],
}

// Tier colours matching HubMapSection
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

function buildCityMask(cityGeoJSON) {
  const world = [[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]
  const holes = []
  for (const f of (cityGeoJSON?.features || [])) {
    const g = f.geometry; if (!g) continue
    if (g.type === 'Polygon') holes.push([...g.coordinates[0]].reverse())
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => holes.push([...p[0]].reverse()))
  }
  if (!holes.length) return { type:'FeatureCollection', features:[] }
  return { type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Polygon', coordinates:[world,...holes] }, properties:{} }] }
}

function buildCentroids(districtBoundaries) {
  const features = []
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features?.length) continue
    let sLon=0, sLat=0, cnt=0
    const visit = ([lo,la]) => { sLon+=lo; sLat+=la; cnt++ }
    for (const f of fc.features) {
      const g = f.geometry; if (!g) continue
      if (g.type==='Polygon') g.coordinates.forEach(r=>r.forEach(visit))
      else if (g.type==='MultiPolygon') g.coordinates.forEach(p=>p.forEach(r=>r.forEach(visit)))
    }
    if (cnt>0) features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[sLon/cnt, sLat/cnt] }, properties:{ name } })
  }
  return { type:'FeatureCollection', features }
}

function inCity(lon, lat) {
  return lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat
}

// ── Hub network ───────────────────────────────────────────────────────────────
function linesFC(pairs) {
  return { type:'FeatureCollection', features: pairs.map(([c1, c2]) =>
    ({ type:'Feature', geometry:{ type:'LineString', coordinates:[c1, c2] }, properties:{} })) }
}

function buildHubNetwork(lHubs, mHubs, sHubs) {
  const list = [
    ...lHubs.map(h => ({ lat:h.lat, lon:h.lon??h.lng, cov:NET_COV.l })),
    ...mHubs.map(h => ({ lat:h.lat, lon:h.lon??h.lng, cov:NET_COV.m })),
    ...sHubs.map(h => ({ lat:h.lat, lon:h.lng,         cov:NET_COV.s })),
  ]
  const pairs = []
  for (let i=0; i<list.length; i++)
    for (let j=i+1; j<list.length; j++)
      if (hav(list[i].lat, list[i].lon, list[j].lat, list[j].lon) <= Math.max(list[i].cov, list[j].cov))
        pairs.push([[list[i].lon, list[i].lat], [list[j].lon, list[j].lat]])
  return linesFC(pairs)
}

function buildHubDots(lHubs, mHubs, sHubs) {
  const features = []
  for (const h of lHubs) if (inCity(h.lon??h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[h.lon??h.lng, h.lat] }, properties:{ tier:'l' } })
  for (const h of mHubs) if (inCity(h.lon??h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[h.lon??h.lng, h.lat] }, properties:{ tier:'m' } })
  for (const h of sHubs) if (inCity(h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[h.lng, h.lat] }, properties:{ tier:'s' } })
  return { type:'FeatureCollection', features }
}

function buildCoverageCircles(lHubs, mHubs, sHubs) {
  const features = []
  // Only show S-hub coverage circles (walk catchment 400m) to keep map readable
  for (const h of sHubs) if (inCity(h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Polygon', coordinates:[circleCoords(h.lng, h.lat, 400)] }, properties:{ tier:'s' } })
  for (const h of mHubs) if (inCity(h.lon??h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Polygon', coordinates:[circleCoords(h.lon??h.lng, h.lat, 800)] }, properties:{ tier:'m' } })
  for (const h of lHubs) if (inCity(h.lon??h.lng, h.lat))
    features.push({ type:'Feature', geometry:{ type:'Polygon', coordinates:[circleCoords(h.lon??h.lng, h.lat, 1200)] }, properties:{ tier:'l' } })
  return { type:'FeatureCollection', features }
}

const EMPTY = { type:'FeatureCollection', features:[] }

// ── Single map ────────────────────────────────────────────────────────────────
function IntermodalMap({ id, showHubs, layers, cityGeoJSON, districtBoundaries, onMove, syncRef }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady] = useState(false)
  const syncing = useRef(false)

  // Init
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: CENTER, zoom: ZOOM,
      attributionControl: false,
    })
    mapRef.current = map
    syncRef.current[id] = map
    map.on('load', () => setReady(true))
    map.on('move', () => {
      if (syncing.current) return
      onMove({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), sourceId: id })
    })
    return () => {
      delete syncRef.current[id]
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Register sync receiver
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current._syncReceive = ({ center, zoom, bearing, pitch, sourceId }) => {
      if (sourceId === id) return
      syncing.current = true
      mapRef.current.jumpTo({ center, zoom, bearing, pitch })
      syncing.current = false
    }
  }, [id])

  // Add all layers once ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const cityMask   = buildCityMask(cityGeoJSON)
    const centroids  = buildCentroids(districtBoundaries)

    // ── Base transport layers ─────────────────────────────────────────────
    const addSrc = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type:'geojson', data: data || EMPTY }) }

    addSrc('roads',       layers.roads)
    addSrc('busRoutes',   layers.busRoutes)
    addSrc('cycling',     layers.cycling)
    addSrc('busStops',    layers.busStops)
    addSrc('bikePark',    layers.bikePark)
    addSrc('carPark',     layers.carPark)

    // Hub sources (right map only, start empty)
    addSrc('hubNet',      EMPTY)
    addSrc('hubDots',     EMPTY)
    addSrc('hubCircles',  EMPTY)

    // City / labels
    addSrc('city-mask',   cityMask)
    addSrc('city-bound',  cityGeoJSON || EMPTY)
    addSrc('dist-labels', centroids)

    // ── Layer order ───────────────────────────────────────────────────────
    map.addLayer({ id:'roads-layer', type:'line', source:'roads',
      paint:{ 'line-color':'#CCCCCC', 'line-width':0.6 } })

    map.addLayer({ id:'bus-routes-layer', type:'line', source:'busRoutes',
      paint:{ 'line-color':'#5539CC', 'line-width':1.2, 'line-opacity':0.6 } })

    map.addLayer({ id:'cycling-layer', type:'line', source:'cycling',
      paint:{ 'line-color':'#004225', 'line-width':1.0, 'line-opacity':0.65 } })

    // Hub circles fill (below lines, below mask)
    map.addLayer({ id:'hub-circles-fill', type:'fill', source:'hubCircles',
      paint:{
        'fill-color': ['match', ['get','tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'fill-opacity': 0.06,
      } })

    map.addLayer({ id:'hub-circles-stroke', type:'line', source:'hubCircles',
      paint:{
        'line-color': ['match', ['get','tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'line-width': 0.8, 'line-opacity': 0.3,
        'line-dasharray': [3, 3],
      } })

    // Hub network lines
    map.addLayer({ id:'hub-net-layer', type:'line', source:'hubNet',
      paint:{ 'line-color':'#999999', 'line-width':0.5, 'line-opacity':0.35 } })

    // Parking dots
    map.addLayer({ id:'car-park-layer', type:'circle', source:'carPark',
      paint:{ 'circle-radius':1.5, 'circle-color':'#C10016', 'circle-opacity':0.5 } })

    map.addLayer({ id:'bike-park-layer', type:'circle', source:'bikePark',
      paint:{ 'circle-radius':1.5, 'circle-color':'#004225', 'circle-opacity':0.6 } })

    map.addLayer({ id:'bus-stops-layer', type:'circle', source:'busStops',
      paint:{ 'circle-radius':2, 'circle-color':'#5539CC', 'circle-opacity':0.7 } })

    // Hub dots (on top of stops, below mask)
    map.addLayer({ id:'hub-dots-layer', type:'circle', source:'hubDots',
      paint:{
        'circle-radius': ['match', ['get','tier'], 'l', 7, 'm', 5, 3.5],
        'circle-color':  ['match', ['get','tier'], 'l', TC.l, 'm', TC.m, TC.s],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      } })

    // City mask (clips everything outside city boundary)
    map.addLayer({ id:'city-mask-fill', type:'fill', source:'city-mask',
      paint:{ 'fill-color':'#F9F9F7', 'fill-opacity':1 } })

    // City boundary line
    map.addLayer({ id:'city-bound-line', type:'line', source:'city-bound',
      paint:{ 'line-color':'#BBBBBB', 'line-width':1, 'line-dasharray':[4,3] } })

    // District labels
    map.addLayer({ id:'dist-label-layer', type:'symbol', source:'dist-labels',
      layout:{
        'text-field':['get','name'], 'text-size':7.5,
        'text-font':['Noto Sans Regular'], 'text-anchor':'center',
      },
      paint:{ 'text-color':'rgba(0,0,0,0.2)', 'text-halo-color':'rgba(249,249,247,0.8)', 'text-halo-width':1 },
    })
  }, [ready])

  // Update city mask when city data loads
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !cityGeoJSON) return
    map.getSource('city-mask')?.setData(buildCityMask(cityGeoJSON))
    map.getSource('city-bound')?.setData(cityGeoJSON)
  }, [ready, cityGeoJSON])

  // Update district labels
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
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
  }, [ready, layers])

  // Update hub layers
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return
    map.getSource('hubNet')?.setData(layers.hubNet || EMPTY)
    map.getSource('hubDots')?.setData(layers.hubDots || EMPTY)
    map.getSource('hubCircles')?.setData(layers.hubCircles || EMPTY)
  }, [ready, layers.hubNet, layers.hubDots, layers.hubCircles])

  return <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
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

  // Fetch city boundary if needed
  useEffect(() => {
    if (landingCityGeoJSON) return
    fetch(`${import.meta.env.BASE_URL}wolfsburg_districts_union.geojson`)
      .then(r => r.json()).then(setLandingCityGeoJSON).catch(() => {})
  }, [landingCityGeoJSON])

  // Sync handler
  const handleMove = useCallback((evt) => {
    for (const [id, map] of Object.entries(syncRef.current))
      if (id !== evt.sourceId) map._syncReceive?.(evt)
  }, [])

  // Hub geometry (memoised)
  const hubGeo = useMemo(() => {
    const lHubs = hubLMResults?.hubL?.hubs || []
    const mHubs = hubLMResults?.hubM?.hubs || []
    const sHubs = hubSBusOnly || []
    if (!lHubs.length && !mHubs.length && !sHubs.length)
      return { net: EMPTY, dots: EMPTY, circles: EMPTY }
    return {
      net:     buildHubNetwork(lHubs, mHubs, sHubs),
      dots:    buildHubDots(lHubs, mHubs, sHubs),
      circles: buildCoverageCircles(lHubs, mHubs, sHubs),
    }
  }, [hubLMResults, hubSBusOnly])

  // Shared base layers
  const baseLayers = useMemo(() => ({
    roads:     roads,
    busRoutes: localBusRoutes,
    cycling:   localCyclingOfficial,
    busStops:  localBusStops,
    bikePark:  localBikeParkings,
    carPark:   localCarParkings,
    hubNet:    EMPTY, hubDots: EMPTY, hubCircles: EMPTY,
  }), [roads, localBusRoutes, localCyclingOfficial, localBusStops, localBikeParkings, localCarParkings])

  const afterLayers = useMemo(() => ({
    ...baseLayers,
    hubNet:    hubGeo.net,
    hubDots:   hubGeo.dots,
    hubCircles: hubGeo.circles,
  }), [baseLayers, hubGeo])

  const hasHubs = (hubLMResults?.hubL?.hubs?.length || 0) + (hubSBusOnly?.length || 0) > 0

  return (
    <section style={{ background:'#fff', borderTop:'2px solid #111' }}>
      {/* Header */}
      <div style={{ padding:'40px 72px 36px', borderBottom:'1px solid #E8E8E8' }}>
        <div style={{ fontFamily:F, fontSize:10, fontWeight:700, color:'#999', letterSpacing:'0.13em', textTransform:'uppercase', marginBottom:6 }}>
          05 — Comparative Analysis · Before / After
        </div>
        <h2 style={{ fontFamily:F, fontSize:'clamp(20px, 1.8vw, 28px)', fontWeight:700, color:'#111', letterSpacing:'-0.03em', lineHeight:1.1, margin:'0 0 10px' }}>
          Intermodal Connectivity
        </h2>
        <p style={{ fontFamily:F, fontSize:12, color:'#888', lineHeight:1.7, maxWidth:600, margin:0 }}>
          Before: bus, cycling and road networks exist as isolated silos — no physical interchange
          points between modes. After: S/M/L hubs connect all modes at transfer nodes,
          enabling chains such as bike → bus → autonomous shuttle within a single journey.
        </p>
      </div>

      {/* Two maps */}
      <div style={{ display:'flex', height:'80vh' }}>

        {/* LEFT — Before */}
        <div style={{ flex:1, position:'relative', borderRight:'2px solid #E8E8E8' }}>
          <div style={{
            position:'absolute', top:16, left:16, zIndex:10,
            background:'rgba(255,255,255,0.92)', border:'1px solid #E0E0E0',
            borderRadius:6, padding:'6px 14px',
            fontFamily:F, fontSize:11, fontWeight:700, color:'#444',
            boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
          }}>
            Before — Isolated Networks
          </div>
          <IntermodalMap
            id="before" showHubs={false}
            layers={baseLayers}
            cityGeoJSON={landingCityGeoJSON}
            districtBoundaries={districtBoundaries}
            onMove={handleMove} syncRef={syncRef}
          />
        </div>

        {/* RIGHT — After */}
        <div style={{ flex:1, position:'relative' }}>
          <div style={{
            position:'absolute', top:16, left:16, zIndex:10,
            background:'rgba(255,255,255,0.92)', border:'1px solid #3EA05544',
            borderRadius:6, padding:'6px 14px',
            fontFamily:F, fontSize:11, fontWeight:700, color:'#3EA055',
            boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
          }}>
            After — Hub System
          </div>
          {!hasHubs && (
            <div style={{ position:'absolute', inset:0, zIndex:20, background:'rgba(249,249,247,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:F, fontSize:11, color:'#AAA' }}>Hub data loading…</span>
            </div>
          )}
          <IntermodalMap
            id="after" showHubs={true}
            layers={afterLayers}
            cityGeoJSON={landingCityGeoJSON}
            districtBoundaries={districtBoundaries}
            onMove={handleMove} syncRef={syncRef}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding:'14px 72px', borderTop:'1px solid #E8E8E8',
        display:'flex', alignItems:'center', gap:28, flexWrap:'wrap',
      }}>
        {[
          { color:'#CCCCCC', label:'Roads',         line:true  },
          { color:'#5539CC', label:'Bus routes',     line:true  },
          { color:'#004225', label:'Cycling',        line:true  },
          { color:'#5539CC', label:'Bus stops',      line:false },
          { color:'#004225', label:'Bike parking',   line:false },
          { color:'#C10016', label:'Car parking',    line:false },
        ].map(({ color, label, line }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            {line
              ? <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={color} strokeWidth={2} /></svg>
              : <div style={{ width:8, height:8, borderRadius:'50%', background:color }} />
            }
            <span style={{ fontFamily:F, fontSize:10, color:'#888' }}>{label}</span>
          </div>
        ))}
        <div style={{ width:1, height:16, background:'#E0E0E0', margin:'0 4px' }} />
        {[
          { color: TC.l, label: 'Hub L · transfer depot'     },
          { color: TC.m, label: 'Hub M · intermodal node'    },
          { color: TC.s, label: 'Hub S · bus/bike exchange'  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:color }} />
            <span style={{ fontFamily:F, fontSize:10, color:'#888' }}>{label}</span>
          </div>
        ))}
        <div style={{ width:1, height:16, background:'#E0E0E0', margin:'0 4px' }} />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke='#999' strokeWidth={1} strokeDasharray="4 2" /></svg>
          <span style={{ fontFamily:F, fontSize:10, color:'#888' }}>Hub connections</span>
        </div>
      </div>
    </section>
  )
}
