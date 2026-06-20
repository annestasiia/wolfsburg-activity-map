import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/appStore'
import { buildRunAllHubs } from '../HubNetworkSidebar'
import CapacitySidebar from '../CapacitySidebar'
import HubLMDataPanel from '../HubLMDataPanel'
import HubLMHubPopup from '../HubLMHubPopup'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CENTER = [10.7865, 52.4227]
const ZOOM = 13

function makeCirclePolygon(lon, lat, radiusM, steps = 64) {
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dLon = (radiusM / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle)
    const dLat = (radiusM / 110540) * Math.sin(angle)
    coords.push([lon + dLon, lat + dLat])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

function makeCircles(hubs, radiusM, lonKey = 'lon', latKey = 'lat') {
  if (!hubs?.length) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: hubs.map(h => makeCirclePolygon(h[lonKey] ?? h.lng, h[latKey] ?? h.lat, radiusM)),
  }
}

export default function HubMapSection() {
  const mapDivRef   = useRef(null)
  const mapRef      = useRef(null)
  const markersRef  = useRef([])
  const [mapReady, setMapReady] = useState(false)
  const autoTriggeredRef = useRef(false)

  const store = useAppStore()
  const {
    hubLMResults, hubSBusOnly,
    hubLMShowL, hubLMShowM, hubLMShowS,
    hubLMShowCoverageL, hubLMShowCoverageM, hubLMShowCoverageS,
    hubLMSStatusFilter, hubLMConfig,
    setHubLMSelectedHub,
    localCarParkings, localBusStops,
  } = store

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

    map.on('load', () => {
      for (const id of ['hub-cov-l', 'hub-cov-m', 'hub-cov-s', 'hub-cand-l', 'hub-cand-m']) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      }
      // Coverage circles
      for (const [id, color] of [['hub-cov-l', '#1D1D1F'], ['hub-cov-m', '#1D7A3A'], ['hub-cov-s', '#185FA5']]) {
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, layout: { visibility: 'none' }, paint: { 'fill-color': color, 'fill-opacity': 0.06 } })
        map.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: { visibility: 'none' }, paint: { 'line-color': color, 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } })
      }
      // Candidate points
      map.addLayer({ id: 'hub-cand-l-circle', type: 'circle', source: 'hub-cand-l', layout: { visibility: 'none' }, paint: { 'circle-radius': 5, 'circle-color': '#1D1D1F', 'circle-opacity': 0.25, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'hub-cand-m-circle', type: 'circle', source: 'hub-cand-m', layout: { visibility: 'none' }, paint: { 'circle-radius': 5, 'circle-color': '#1D7A3A', 'circle-opacity': 0.25, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })

      setMapReady(true)
    })
    return () => {
      markersRef.current.forEach(m => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Auto-run algorithm once when data is ready ───────────────────────────
  useEffect(() => {
    if (!mapReady || !localCarParkings || !localBusStops) return
    if (hubLMResults || autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    const runAll = buildRunAllHubs(store)
    runAll()
  }, [mapReady, localCarParkings, localBusStops, hubLMResults])

  // ── Hub L/M/S markers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!hubLMResults) return

    const makeMarker = (hub, tier, svgW, svgH, svgInner) => {
      const el = document.createElement('div')
      el.innerHTML = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`
      el.style.cssText = `cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));width:${svgW}px;height:${svgH}px`
      el.addEventListener('click', e => { e.stopPropagation(); setHubLMSelectedHub({ hub, tier }) })
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([hub.lon ?? hub.lng, hub.lat]).addTo(map)
    }

    const markers = []
    if (hubLMShowL && hubLMResults.hubL?.hubs?.length) {
      for (const hub of hubLMResults.hubL.hubs) {
        markers.push(makeMarker(hub, 'hub_l', 34, 34,
          `<circle cx="17" cy="17" r="15" fill="#1D1D1F" stroke="white" stroke-width="2.5"/>
           <text x="17" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="white">L</text>`))
      }
    }
    if (hubLMShowM && hubLMResults.hubM?.hubs?.length) {
      for (const hub of hubLMResults.hubM.hubs) {
        markers.push(makeMarker(hub, 'hub_m', 28, 28,
          `<circle cx="14" cy="14" r="12" fill="#1D7A3A" stroke="white" stroke-width="2.5"/>
           <text x="14" y="18.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="white">M</text>`))
      }
    }
    if (hubLMShowS && hubSBusOnly?.length) {
      const filtered = hubSBusOnly.filter(h => {
        if (hubLMSStatusFilter === 'existing') return h.status === 'existing'
        if (hubLMSStatusFilter === 'proposed') return h.status === 'proposed'
        return true
      })
      for (const hub of filtered) {
        markers.push(makeMarker({ ...hub, lon: hub.lng }, 'hub_s', 22, 22,
          `<circle cx="11" cy="11" r="9" fill="#185FA5" stroke="white" stroke-width="2"/>
           <text x="11" y="15" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="white">S</text>`))
      }
    }
    markersRef.current = markers
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMShowL, hubLMShowM, hubLMShowS, hubLMSStatusFilter, hubLMConfig])

  // ── Coverage circles ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !hubLMResults) return
    const map = mapRef.current
    const hubSRadius = hubLMConfig?.hubSCoverageRadius || 200

    const updateCircle = (srcId, hubs, radius, showLayer, lonKey = 'lon', latKey = 'lat') => {
      const gj = showLayer ? makeCircles(hubs, radius, lonKey, latKey) : { type: 'FeatureCollection', features: [] }
      if (map.getSource(srcId)) map.getSource(srcId).setData(gj)
      const vis = showLayer ? 'visible' : 'none'
      if (map.getLayer(`${srcId}-fill`)) map.setLayoutProperty(`${srcId}-fill`, 'visibility', vis)
      if (map.getLayer(`${srcId}-line`)) map.setLayoutProperty(`${srcId}-line`, 'visibility', vis)
    }

    updateCircle('hub-cov-l', hubLMResults.hubL?.hubs, 4000, hubLMShowCoverageL)
    updateCircle('hub-cov-m', hubLMResults.hubM?.hubs, 2000, hubLMShowCoverageM)
    const filteredS = (hubSBusOnly || []).filter(h => {
      if (hubLMSStatusFilter === 'existing') return h.status === 'existing'
      if (hubLMSStatusFilter === 'proposed') return h.status === 'proposed'
      return true
    })
    updateCircle('hub-cov-s', filteredS, hubSRadius, hubLMShowCoverageS, 'lng', 'lat')
  }, [mapReady, hubLMResults, hubSBusOnly, hubLMShowCoverageL, hubLMShowCoverageM, hubLMShowCoverageS, hubLMSStatusFilter, hubLMConfig])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />
      {mapReady && <CapacitySidebar />}
      {mapReady && <HubLMDataPanel />}
      {mapReady && <HubLMHubPopup />}
    </div>
  )
}
