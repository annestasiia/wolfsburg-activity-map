import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import osmtogeojson from 'osmtogeojson'
import { useAppStore } from '../../store/appStore'

const CENTER = [10.7865, 52.4227]
const ZOOM   = 11.5

const BLANK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

export const CENT_TABS = [
  { id: 'centrality', label: 'Centrality' },
  { id: 'walk',       label: 'Walk'       },
  { id: 'bike',       label: 'Bike'       },
  { id: 'public',     label: 'Public'     },
  { id: 'auto',       label: 'Auto'       },
]

// Mode → score property key + color
const MODE_CONFIG = {
  walk:       { key: 'w', color: '#16A34A', label: 'Walk (4.5 km/h, 15 min)' },
  bike:       { key: 'b', color: '#059669', label: 'Bike (15 km/h, 15 min)'  },
  auto:       { key: 'a', color: '#DC2626', label: 'Auto (50 km/h, 15 min)'  },
  public:     { key: 'p', color: '#CA8A04', label: 'Public Transit, 15 min'  },
  centrality: { key: null, color: '#1D1D1F', label: 'All modes combined'     },
}

function scoreExpr(key, color) {
  return ['interpolate', ['linear'], ['get', key],
    0,   'rgba(255,255,255,0)',
    20,  hexAlpha(color, 0.25),
    50,  hexAlpha(color, 0.55),
    80,  hexAlpha(color, 0.80),
    100, hexAlpha(color, 1.00),
  ]
}

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

// composite = average of w, b, p (excluding auto which is near-uniform)
function compositeExpr(color) {
  // (w + b + p) / 3
  const avg = ['/', ['+', ['+', ['get','w'], ['get','b']], ['get','p']], 3]
  return ['interpolate', ['linear'], avg,
    0,   'rgba(255,255,255,0)',
    20,  hexAlpha(color, 0.25),
    50,  hexAlpha(color, 0.55),
    80,  hexAlpha(color, 0.80),
    100, hexAlpha(color, 1.00),
  ]
}

function buildGraticule() {
  const features = [], lonStep = 0.015, latStep = 0.009
  const [minLon, maxLon, minLat, maxLat] = [8.0, 15.0, 49.0, 56.0]
  for (let lat = Math.ceil(minLat/latStep)*latStep; lat <= maxLat; lat = parseFloat((lat+latStep).toFixed(6)))
    features.push({ type:'Feature', geometry:{ type:'LineString', coordinates:[[minLon,lat],[maxLon,lat]] }, properties:{} })
  for (let lon = Math.ceil(minLon/lonStep)*lonStep; lon <= maxLon; lon = parseFloat((lon+lonStep).toFixed(6)))
    features.push({ type:'Feature', geometry:{ type:'LineString', coordinates:[[lon,minLat],[lon,maxLat]] }, properties:{} })
  return { type:'FeatureCollection', features }
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

export default function CentralityMapSection({ tab = 'centrality', onTabChange }) {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const {
    districtBoundaries, localCentrality,
    landingCityGeoJSON, setLandingCityGeoJSON,
  } = useAppStore()

  // ── Init map ────────────────────────────────────────────────────────────────
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
      // District outlines
      map.addSource('districts', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'district-outline', type:'line', source:'districts',
        paint:{ 'line-color':'#CCCCCC', 'line-width':0.5, 'line-opacity':0.8 } })

      // ── Centrality point layers (one per mode + composite) ────────────────
      map.addSource('centrality', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })

      for (const { id } of CENT_TABS) {
        const cfg   = MODE_CONFIG[id]
        const color = cfg.color
        const colorExpr = id === 'centrality'
          ? compositeExpr(color)
          : scoreExpr(cfg.key, color)

        map.addLayer({
          id:     `cent-${id}`,
          type:   'circle',
          source: 'centrality',
          layout: { visibility: 'none' },
          paint: {
            'circle-color':        colorExpr,
            'circle-opacity':      1,
            'circle-stroke-width': 0,
            'circle-radius':       3.2,
          },
        })
      }

      // ── City mask (above data layers) ────────────────────────────────────
      map.addSource('city-mask', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'city-mask-fill', type:'fill', source:'city-mask',
        paint:{ 'fill-color':'#ffffff', 'fill-opacity':1 } })

      // ── Graticule ────────────────────────────────────────────────────────
      map.addSource('grid', { type:'geojson', data: buildGraticule() })
      map.addLayer({ id:'grid-line', type:'line', source:'grid',
        paint:{ 'line-color':'#BBBBBB', 'line-width':0.4, 'line-opacity':0.5, 'line-dasharray':[4,6] } })

      // ── District labels ──────────────────────────────────────────────────
      map.addSource('dist-centroids', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'district-labels', type:'symbol', source:'dist-centroids',
        layout:{ 'text-field':['get','name'], 'text-font':['Noto Sans Regular'], 'text-size':9, 'text-anchor':'center', 'text-allow-overlap':false },
        paint:{ 'text-color':'#555555', 'text-opacity':0.85 },
      })

      // ── City boundary ────────────────────────────────────────────────────
      map.addSource('city-boundary', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'city-boundary-line', type:'line', source:'city-boundary',
        paint:{ 'line-color':'#1D1D1F', 'line-width':4, 'line-opacity':0.95 } })

      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── City boundary ──────────────────────────────────────────────────────────
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
    fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:`data=${encodeURIComponent(q)}`, headers:{'Content-Type':'application/x-www-form-urlencoded'} })
      .then(r=>r.json()).then(data => {
        const gj = osmtogeojson(data)
        try { localStorage.setItem('wolfsburg_city_boundary_v1', JSON.stringify(gj)) } catch (_) {}
        applyCity(gj)
      }).catch(()=>{})
  }, [mapReady, landingCityGeoJSON])

  // ── Districts ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !Object.keys(districtBoundaries).length) return
    const features = []
    for (const [, fc] of Object.entries(districtBoundaries)) {
      if (fc?.features) features.push(...fc.features)
    }
    mapRef.current?.getSource('districts')?.setData({ type:'FeatureCollection', features })
    mapRef.current?.getSource('dist-centroids')?.setData(buildCentroids(districtBoundaries))
  }, [mapReady, districtBoundaries])

  // ── Centrality data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !localCentrality) return
    mapRef.current?.getSource('centrality')?.setData(localCentrality)
  }, [mapReady, localCentrality])

  // ── Tab visibility ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    for (const { id } of CENT_TABS) {
      if (map.getLayer(`cent-${id}`))
        map.setLayoutProperty(`cent-${id}`, 'visibility', tab === id ? 'visible' : 'none')
    }
  }, [mapReady, tab])

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <div ref={mapDivRef} style={{ position:'absolute', inset:0 }} />
      {mapReady && (
        <div style={{
          position:'absolute', top:12, left:'50%', transform:'translateX(-50%)',
          display:'flex', gap:2,
          background:'rgba(255,255,255,0.96)', border:'1px solid #E0E0E0',
          borderRadius:8, padding:'3px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.10)', zIndex:10, whiteSpace:'nowrap',
        }}>
          {CENT_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
              fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize:12, fontWeight:600, letterSpacing:'-0.01em',
              background: tab === id ? '#1D1D1F' : 'transparent',
              color:      tab === id ? '#fff'    : '#666',
              transition:'background 0.15s, color 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
