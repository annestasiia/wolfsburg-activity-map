import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/appStore'
import MobilityLeftBar from '../MobilityLeftBar'
import MobilityToolbar from '../MobilityToolbar'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CENTER = [10.7865, 52.4227]
const ZOOM = 12

function buildDistrictGeoJSON(districtBoundaries) {
  const features = []
  for (const [name, fc] of Object.entries(districtBoundaries)) {
    if (!fc?.features) continue
    for (const f of fc.features) {
      features.push({ ...f, properties: { ...f.properties, districtName: name } })
    }
  }
  return { type: 'FeatureCollection', features }
}

function scoreToFill(score) {
  if (!score || score <= 0) return '#F0F0F0'
  if (score <= 2)  return '#FDE8EC'
  if (score <= 4)  return '#F7B8C4'
  if (score <= 6)  return '#F07090'
  if (score <= 8)  return '#E03060'
  return '#C01040'
}

export default function MobilityMapSection() {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const markersRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  const {
    districtBoundaries,
    localBusStops, localCycling, roads, footways,
    activeMobilityModes,
    mobilityScoresPerMode,
    mobilityOverlayPerMode,
    mobilityDataLoading,
    setMobilityDataLoading,
    setMobilityDataCache, setMobilityScoresForMode, setMobilityOverlayForMode,
    mobilityDataCache,
  } = useAppStore()

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: MAP_STYLE,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    map.on('load', () => setMapReady(true))
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── District boundary outlines ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !Object.keys(districtBoundaries).length) return
    const map = mapRef.current
    const gj = buildDistrictGeoJSON(districtBoundaries)
    if (!map.getSource('districts')) {
      map.addSource('districts', { type: 'geojson', data: gj })
      map.addLayer({
        id: 'district-fill', type: 'fill', source: 'districts',
        paint: { 'fill-color': '#F5F5F7', 'fill-opacity': 0.45 },
      })
      map.addLayer({
        id: 'district-outline', type: 'line', source: 'districts',
        paint: { 'line-color': '#888888', 'line-width': 1, 'line-opacity': 0.6 },
      })
    } else {
      map.getSource('districts').setData(gj)
    }
  }, [mapReady, districtBoundaries])

  // ── Score choropleth ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer('district-fill')) return
    const allScores = {}
    for (const modeScores of Object.values(mobilityScoresPerMode)) {
      for (const [name, score] of Object.entries(modeScores)) {
        allScores[name] = Math.max(allScores[name] || 0, score)
      }
    }
    if (!Object.keys(allScores).length) {
      map.setPaintProperty('district-fill', 'fill-color', '#F5F5F7')
      return
    }
    const expr = ['match', ['get', 'districtName'],
      ...Object.entries(allScores).flatMap(([n, s]) => [n, scoreToFill(s)]),
      '#F5F5F7',
    ]
    map.setPaintProperty('district-fill', 'fill-color', expr)
    map.setPaintProperty('district-fill', 'fill-opacity', 0.55)
  }, [mapReady, mobilityScoresPerMode])

  // ── Fetch Overpass data when modes are toggled (mirrors MapView logic) ────
  useEffect(() => {
    if (!mapReady || !Object.keys(districtBoundaries).length) return
    const QUERIES = {
      automobile: `[out:json][timeout:90];(way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
      transport: `[out:json][timeout:30];(node["highway"="bus_stop"](52.35,10.68,52.52,10.93););out body;`,
      cycling: `[out:json][timeout:30];(way["highway"="cycleway"](52.35,10.68,52.52,10.93);way["bicycle"="designated"]["highway"~"path|track|footway"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
    }
    for (const mode of activeMobilityModes) {
      if (mobilityOverlayPerMode[mode]) continue
      const stored = mobilityDataCache[mode]
      const raw = stored
      if (!raw) {
        setMobilityDataLoading(true)
        fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(QUERIES[mode] || '')}`,
        })
          .then(r => r.json())
          .then(data => {
            setMobilityDataCache(mode, data)
            const features = (data.elements || [])
              .filter(el => el.type === 'way' || el.type === 'node')
              .map(el => {
                if (el.type === 'node') {
                  return { type: 'Feature', geometry: { type: 'Point', coordinates: [el.lon, el.lat] }, properties: el.tags || {} }
                }
                const coords = (el.geometry || []).map(n => [n.lon, n.lat]).filter(c => c[0] && c[1])
                if (coords.length < 2) return null
                return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: el.tags || {} }
              })
              .filter(Boolean)
            const gj = { type: 'FeatureCollection', features }
            setMobilityOverlayForMode(mode, gj)
            setMobilityScoresForMode(mode, {})
          })
          .catch(() => {})
          .finally(() => setMobilityDataLoading(false))
      }
    }
  }, [mapReady, activeMobilityModes, districtBoundaries])

  // ── Pre-loaded layers: bus stops ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !localBusStops) return
    const map = mapRef.current
    const vis = activeMobilityModes.has('transport') ? 'visible' : 'none'
    if (!map.getSource('local-bus-stops')) {
      map.addSource('local-bus-stops', { type: 'geojson', data: localBusStops })
      map.addLayer({
        id: 'local-bus-stops-circle', type: 'circle', source: 'local-bus-stops',
        layout: { visibility: vis },
        paint: { 'circle-radius': 4, 'circle-color': '#0077FF', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 },
      })
    } else {
      if (map.getLayer('local-bus-stops-circle'))
        map.setLayoutProperty('local-bus-stops-circle', 'visibility', vis)
    }
  }, [mapReady, localBusStops, activeMobilityModes])

  // ── Pre-loaded layers: cycling ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !localCycling) return
    const map = mapRef.current
    const vis = activeMobilityModes.has('cycling') ? 'visible' : 'none'
    if (!map.getSource('local-cycling')) {
      map.addSource('local-cycling', { type: 'geojson', data: localCycling })
      map.addLayer({
        id: 'local-cycling-line', type: 'line', source: 'local-cycling',
        layout: { visibility: vis, 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#00C853', 'line-width': 2, 'line-opacity': 0.8 },
      })
    } else {
      if (map.getLayer('local-cycling-line'))
        map.setLayoutProperty('local-cycling-line', 'visibility', vis)
    }
  }, [mapReady, localCycling, activeMobilityModes])

  // ── Pre-loaded layers: roads (automobile) ─────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !roads) return
    const map = mapRef.current
    const vis = activeMobilityModes.has('automobile') ? 'visible' : 'none'
    if (!map.getSource('auto-roads')) {
      map.addSource('auto-roads', { type: 'geojson', data: roads })
      map.addLayer({
        id: 'auto-roads-line', type: 'line', source: 'auto-roads',
        layout: { visibility: vis, 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'highway'],
            'motorway', '#FF2D55', 'trunk', '#FF6B00', 'primary', '#FF9500',
            'secondary', '#FFCC00', '#AAAAAA'],
          'line-width': ['match', ['get', 'highway'], 'motorway', 4, 'trunk', 3, 'primary', 2.5, 1.5],
          'line-opacity': 0.75,
        },
      })
    } else {
      if (map.getLayer('auto-roads-line'))
        map.setLayoutProperty('auto-roads-line', 'visibility', vis)
    }
  }, [mapReady, roads, activeMobilityModes])

  // ── Overpass mobility overlay ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    for (const [mode, gj] of Object.entries(mobilityOverlayPerMode)) {
      const isActive = activeMobilityModes.has(mode)
      const srcId = `mob-overlay-${mode}`
      const lineId = `mob-overlay-${mode}-line`
      const dotId  = `mob-overlay-${mode}-dot`
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data: gj })
        const lineFeatures = gj.features.filter(f => f.geometry.type === 'LineString')
        const pointFeatures = gj.features.filter(f => f.geometry.type === 'Point')
        if (lineFeatures.length) {
          map.addLayer({
            id: lineId, type: 'line', source: srcId,
            filter: ['==', '$type', 'LineString'],
            layout: { visibility: isActive ? 'visible' : 'none', 'line-cap': 'round' },
            paint: { 'line-color': mode === 'automobile' ? '#FF4400' : mode === 'transport' ? '#0077FF' : '#00C853', 'line-width': 2, 'line-opacity': 0.6 },
          })
        }
        if (pointFeatures.length) {
          map.addLayer({
            id: dotId, type: 'circle', source: srcId,
            filter: ['==', '$type', 'Point'],
            layout: { visibility: isActive ? 'visible' : 'none' },
            paint: { 'circle-radius': 4, 'circle-color': mode === 'transport' ? '#0077FF' : '#00C853', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
          })
        }
      } else {
        map.getSource(srcId).setData(gj)
        if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', isActive ? 'visible' : 'none')
        if (map.getLayer(dotId))  map.setLayoutProperty(dotId,  'visibility', isActive ? 'visible' : 'none')
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />
      {mapReady && <MobilityLeftBar />}
      {mapReady && <MobilityToolbar />}
    </div>
  )
}
