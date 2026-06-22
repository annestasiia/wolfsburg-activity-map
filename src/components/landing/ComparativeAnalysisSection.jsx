import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/appStore'

const F      = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#F8F8F6' } }],
}

export const COMP_TABS = [
  { id: 'walk',   label: 'Walk',   color: '#16A34A', propKey: 'score_walk'  },
  { id: 'bike',   label: 'Bike',   color: '#059669', propKey: 'score_bike'  },
  { id: 'public', label: 'Public', color: '#CA8A04', propKey: 'score_pt'    },
  { id: 'auto',   label: 'Auto',   color: '#DC2626', propKey: 'score_drive' },
]

// ── GL expression helpers ─────────────────────────────────────────────────────
function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function colorExpr(propKey, color) {
  if (propKey === 'score_drive') {
    return ['interpolate', ['linear'], ['get', propKey],
      0, '#FFF44F', 50, '#FF7A00', 100, '#E62020']
  }
  return ['interpolate', ['linear'], ['get', propKey],
    0,   'rgba(255,255,255,0)',
    15,  hexAlpha(color, 0.25),
    40,  hexAlpha(color, 0.55),
    70,  hexAlpha(color, 0.80),
    100, hexAlpha(color, 1.00),
  ]
}

function radiusExpr(propKey) {
  const val = ['get', propKey]
  if (propKey === 'score_drive') {
    return ['interpolate', ['linear'], val, 0, 0.3, 20, 1.2, 50, 3.0, 80, 5.5, 100, 8.0]
  }
  return ['interpolate', ['linear'], val, 0, 0.4, 20, 1.8, 50, 3.5, 80, 5.5, 100, 7.5]
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
  return { type:'FeatureCollection', features:[{
    type:'Feature',
    geometry:{ type:'Polygon', coordinates:[world,...holes] },
    properties:{},
  }] }
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

// ── Single choropleth map ─────────────────────────────────────────────────────
function ChoroplethMap({ id, data, tab, cityGeoJSON, districtBoundaries, onMove, syncRef }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady] = useState(false)
  const syncing = useRef(false)

  const cfg = COMP_TABS.find(t => t.id === tab) || COMP_TABS[0]

  // Init map
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    })
    mapRef.current = map
    syncRef.current[id] = map

    map.on('load', () => setReady(true))

    // Sync pan/zoom to the other map
    map.on('move', () => {
      if (syncing.current) return
      onMove(map.getCenter(), map.getZoom(), map.getBearing(), map.getPitch(), id)
    })

    return () => {
      delete syncRef.current[id]
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Apply incoming sync
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current._onSyncMove = ({ center, zoom, bearing, pitch, sourceId }) => {
      if (sourceId === id) return
      syncing.current = true
      mapRef.current.jumpTo({ center, zoom, bearing, pitch })
      syncing.current = false
    }
  }, [id])

  // Add layers once map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const cityMask = buildCityMask(cityGeoJSON)
    const centroids = buildCentroids(districtBoundaries)

    // City boundary source
    if (!map.getSource('city-bound')) {
      map.addSource('city-bound', { type:'geojson', data: cityGeoJSON || { type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'city-bound-line', type:'line', source:'city-bound',
        paint:{ 'line-color':'#AAAAAA', 'line-width':1, 'line-dasharray':[4,3] } })
    }

    // City mask
    if (!map.getSource('city-mask')) {
      map.addSource('city-mask', { type:'geojson', data: cityMask })
      map.addLayer({ id:'city-mask-fill', type:'fill', source:'city-mask',
        paint:{ 'fill-color':'#F8F8F6', 'fill-opacity':1 } })
    }

    // District labels
    if (!map.getSource('district-labels')) {
      map.addSource('district-labels', { type:'geojson', data: centroids })
      map.addLayer({ id:'district-label-layer', type:'symbol', source:'district-labels',
        layout:{
          'text-field':['get','name'], 'text-size':8,
          'text-font':['Noto Sans Regular'], 'text-anchor':'center',
        },
        paint:{ 'text-color':'rgba(0,0,0,0.25)', 'text-halo-color':'rgba(248,248,246,0.7)', 'text-halo-width':1 },
      })
    }

    // Centrality dots
    if (!map.getSource('centrality')) {
      map.addSource('centrality', { type:'geojson', data: data || { type:'FeatureCollection', features:[] } })
      map.addLayer({
        id: 'centrality-layer', type:'circle', source:'centrality',
        paint:{
          'circle-radius': radiusExpr(cfg.propKey),
          'circle-color':  colorExpr(cfg.propKey, cfg.color),
          'circle-blur':   0.4,
        },
      }, 'city-mask-fill')
    }
  }, [ready])

  // Update centrality data when it changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !data) return
    map.getSource('centrality')?.setData(data)
  }, [ready, data])

  // Update layer style when tab changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setPaintProperty('centrality-layer', 'circle-color',  colorExpr(cfg.propKey, cfg.color))
    map.setPaintProperty('centrality-layer', 'circle-radius', radiusExpr(cfg.propKey))
  }, [ready, tab])

  // Update city mask / boundary when city data loads
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !cityGeoJSON) return
    map.getSource('city-bound')?.setData(cityGeoJSON)
    map.getSource('city-mask')?.setData(buildCityMask(cityGeoJSON))
  }, [ready, cityGeoJSON])

  // Update district labels when boundaries load
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.getSource('district-labels')?.setData(buildCentroids(districtBoundaries))
  }, [ready, districtBoundaries])

  return <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
}

// ── Composite section ─────────────────────────────────────────────────────────
export default function ComparativeAnalysisSection({ tab, onTabChange }) {
  const { localCentrality, landingCityGeoJSON, setLandingCityGeoJSON, districtBoundaries } = useAppStore()

  const [hubsData,  setHubsData]  = useState(null)
  const [hasHubs,   setHasHubs]   = useState(false)
  const syncRef = useRef({})  // id → maplibregl.Map

  // Fetch hub centrality data
  useEffect(() => {
    fetch('/wolfsburg_centrality_hubs.geojson')
      .then(r => r.json())
      .then(d => {
        setHubsData(d)
        setHasHubs((d?.features?.length || 0) > 0)
      })
      .catch(() => {})
  }, [])

  // Fetch city boundary if not in store
  useEffect(() => {
    if (landingCityGeoJSON) return
    fetch('/wolfsburg_districts_union.geojson')
      .then(r => r.json())
      .then(setLandingCityGeoJSON)
      .catch(() => {})
  }, [landingCityGeoJSON])

  // Cross-map sync handler
  const handleMove = useCallback((center, zoom, bearing, pitch, sourceId) => {
    for (const [id, map] of Object.entries(syncRef.current)) {
      if (id === sourceId) continue
      map._onSyncMove?.({ center, zoom, bearing, pitch, sourceId })
    }
  }, [])

  const cfg = COMP_TABS.find(t => t.id === tab) || COMP_TABS[0]

  return (
    <section style={{ background: '#fff', borderTop: '2px solid #111' }}>
      {/* Header */}
      <div style={{
        padding: '40px 72px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #E8E8E8',
      }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 }}>
            05 — Comparative Analysis · Before / After
          </div>
          <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
            Centrality Shift
          </h2>
          <p style={{ fontFamily: F, fontSize: 12, color: '#888', marginTop: 8, maxWidth: 520, lineHeight: 1.6 }}>
            Accessibility centrality before and after hub network introduction —
            how many destinations reachable within 15 min per mode, at each point in the city.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E0E0E0',
          borderRadius: 8, padding: '3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        }}>
          {COMP_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: F, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              background: tab === id ? '#1D1D1F' : 'transparent',
              color:      tab === id ? '#fff'    : '#666',
              transition: 'background 0.15s, color 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Two maps side by side */}
      <div style={{ display: 'flex', height: '80vh' }}>
        {/* Left — Before */}
        <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #E8E8E8' }}>
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.92)', border: '1px solid #E0E0E0',
            borderRadius: 6, padding: '6px 12px',
            fontFamily: F, fontSize: 11, fontWeight: 700, color: '#444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            Before — Current State
          </div>
          <ChoroplethMap
            id="before"
            data={localCentrality}
            tab={tab}
            cityGeoJSON={landingCityGeoJSON}
            districtBoundaries={districtBoundaries}
            onMove={handleMove}
            syncRef={syncRef}
          />
        </div>

        {/* Right — After Hubs */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.92)', border: `1px solid ${cfg.color}44`,
            borderRadius: 6, padding: '6px 12px',
            fontFamily: F, fontSize: 11, fontWeight: 700, color: cfg.color,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            After — Hub Network
          </div>
          {!hasHubs && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(248,248,246,0.92)',
            }}>
              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                  Hub centrality data not yet generated
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#888', background: '#F0F0EE', padding: '8px 12px', borderRadius: 4 }}>
                  python scripts/compute_centrality_hubs.py
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: '#AAA', marginTop: 8 }}>
                  Run from the repo root. Output: ~15–30 min.
                </div>
              </div>
            </div>
          )}
          <ChoroplethMap
            id="after"
            data={hubsData}
            tab={tab}
            cityGeoJSON={landingCityGeoJSON}
            districtBoundaries={districtBoundaries}
            onMove={handleMove}
            syncRef={syncRef}
          />
        </div>
      </div>

      {/* Colour scale legend */}
      <div style={{ padding: '16px 72px', borderTop: '1px solid #E8E8E8', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: F, fontSize: 10, color: '#999' }}>Accessibility score 0 → 100%</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: `linear-gradient(to right, rgba(255,255,255,0), ${cfg.color})` }} />
        <span style={{ fontFamily: F, fontSize: 10, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#BBB' }}>· {cfg.id === 'auto' ? '50 km/h' : cfg.id === 'bike' ? '15 km/h' : cfg.id === 'walk' ? '4.5 km/h' : 'bus network'} · 15 min budget</span>
      </div>
    </section>
  )
}
