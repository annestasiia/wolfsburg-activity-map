import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/appStore'
import {
  GREENERY_FEATURES_QUERY,
  GREENERY_QUERY_VERSION,
  CATEGORY_COLOR_EXPRESSION,
  greeneryOsmToGeoJSON,
  computeVisibleGeoJSON,
} from '../../utils/greeneryConfig'
import GreenerySidebar from '../GreenerySidebar'
import TransportPoolPanel from '../TransportPoolPanel'
import AnalysisInfoModal from '../panels/AnalysisInfoModal'
import { scoreToGSAColor } from '../../utils/greenSocialAnalysis'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CENTER = [10.7865, 52.4227]
const ZOOM = 12.5

export default function GreeneryMapSection() {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const tooltipRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const {
    parks, water, forest,
    greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles,
    greeneryQueryVersion,
    setGreeneryGeoJSON, setGreeneryDataLoading, setGreeneryDataError,
    showGreeneryDistrictBorders, districtBoundaries,
    greenSocialScores, showGreenSocialMap,
    socialAmenitiesGeoJSON, showSocialAmenities,
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

    map.on('load', () => {
      // Pre-load sources
      map.addSource('greenery-all', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'greenery-fill', type: 'fill', source: 'greenery-all',
        filter: ['!=', ['get', '_categoryId'], 'network'],
        paint: { 'fill-color': CATEGORY_COLOR_EXPRESSION, 'fill-opacity': 0.30 },
      })
      map.addLayer({
        id: 'greenery-outline', type: 'line', source: 'greenery-all',
        filter: ['!=', ['get', '_categoryId'], 'network'],
        paint: { 'line-color': CATEGORY_COLOR_EXPRESSION, 'line-width': 0.8, 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: 'greenery-line', type: 'line', source: 'greenery-all',
        filter: ['==', ['get', '_categoryId'], 'network'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': CATEGORY_COLOR_EXPRESSION, 'line-width': 2.5, 'line-opacity': 0.65 },
      })
      map.addLayer({
        id: 'greenery-point', type: 'circle', source: 'greenery-all',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': CATEGORY_COLOR_EXPRESSION, 'circle-opacity': 0.7, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
      })

      // Add pre-loaded base green layers
      for (const [id, fill, line] of [
        ['parks-base',  { 'fill-color': '#90EE90', 'fill-opacity': 0.20 }, { 'line-color': '#32CD32', 'line-width': 0.8, 'line-opacity': 0.35 }],
        ['forest-base', { 'fill-color': '#228B22', 'fill-opacity': 0.18 }, { 'line-color': '#228B22', 'line-width': 0.7, 'line-opacity': 0.35 }],
        ['water-base',  { 'fill-color': '#4A90E2', 'fill-opacity': 0.22 }, { 'line-color': '#2E75CC', 'line-width': 0.8, 'line-opacity': 0.45 }],
      ]) {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: `${id}-fill`, type: 'fill',   source: id, paint: fill,  layout: { visibility: 'none' } }, 'greenery-fill')
        map.addLayer({ id: `${id}-line`, type: 'line',   source: id, paint: line,  layout: { visibility: 'none' } }, 'greenery-fill')
      }

      // GSA district choropleth source
      map.addSource('gsa-districts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'gsa-district-fill', type: 'fill', source: 'gsa-districts',
        layout: { visibility: 'none' },
        paint: { 'fill-color': ['coalesce', ['get', 'color'], '#F0F0F0'], 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'gsa-district-outline', type: 'line', source: 'gsa-districts',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#888', 'line-width': 1, 'line-opacity': 0.5 },
      })

      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Load pre-built GeoJSON layers ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (parks && map.getSource('parks-base')) {
      map.getSource('parks-base').setData(parks)
      map.setLayoutProperty('parks-base-fill', 'visibility', 'visible')
      map.setLayoutProperty('parks-base-line', 'visibility', 'visible')
    }
    if (forest && map.getSource('forest-base')) {
      map.getSource('forest-base').setData(forest)
      map.setLayoutProperty('forest-base-fill', 'visibility', 'visible')
      map.setLayoutProperty('forest-base-line', 'visibility', 'visible')
    }
    if (water && map.getSource('water-base')) {
      map.getSource('water-base').setData(water)
      map.setLayoutProperty('water-base-fill', 'visibility', 'visible')
      map.setLayoutProperty('water-base-line', 'visibility', 'visible')
    }
  }, [mapReady, parks, forest, water])

  // ── Fetch full greenery from Overpass (once) ──────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    if (greeneryGeoJSON && greeneryQueryVersion === GREENERY_QUERY_VERSION) return
    let cancelled = false
    setGreeneryDataLoading(true)
    const fetchUrl = 'https://overpass-api.de/api/interpreter'
    Promise.allSettled([
      fetch(fetchUrl, { method: 'POST', body: `data=${encodeURIComponent(GREENERY_FEATURES_QUERY)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(r => r.json()),
    ]).then(([greenResult]) => {
      if (cancelled) return
      const features = greenResult.status === 'fulfilled'
        ? greeneryOsmToGeoJSON(greenResult.value.elements || []).features
        : []
      const gj = { type: 'FeatureCollection', features }
      setGreeneryGeoJSON(gj, GREENERY_QUERY_VERSION)
    }).catch(e => {
      if (!cancelled) setGreeneryDataError('Failed to load greenery data.')
    }).finally(() => { if (!cancelled) setGreeneryDataLoading(false) })
    return () => { cancelled = true }
  }, [mapReady])

  // ── Update greenery layers when data or toggles change ────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !greeneryGeoJSON) return
    const map = mapRef.current
    const visible = computeVisibleGeoJSON(greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles)
    if (map.getSource('greenery-all')) {
      map.getSource('greenery-all').setData(visible)
      for (const id of ['greenery-fill', 'greenery-outline', 'greenery-line', 'greenery-point']) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
      }
    }
  }, [mapReady, greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles])

  // ── GSA district choropleth ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const hasScores = greenSocialScores && Object.keys(greenSocialScores).length > 0
    const vis = (hasScores && showGreenSocialMap) ? 'visible' : 'none'
    if (!hasScores || !showGreenSocialMap || !Object.keys(districtBoundaries).length) {
      if (map.getLayer('gsa-district-fill')) map.setLayoutProperty('gsa-district-fill', 'visibility', 'none')
      if (map.getLayer('gsa-district-outline')) map.setLayoutProperty('gsa-district-outline', 'visibility', 'none')
      return
    }
    const features = []
    for (const [name, fc] of Object.entries(districtBoundaries)) {
      const score = greenSocialScores[name]
      if (!fc?.features || score == null) continue
      for (const f of fc.features) {
        features.push({ ...f, properties: { ...f.properties, districtName: name, color: scoreToGSAColor(score.total ?? score) } })
      }
    }
    const gj = { type: 'FeatureCollection', features }
    if (map.getSource('gsa-districts')) map.getSource('gsa-districts').setData(gj)
    if (map.getLayer('gsa-district-fill')) map.setLayoutProperty('gsa-district-fill', 'visibility', vis)
    if (map.getLayer('gsa-district-outline')) map.setLayoutProperty('gsa-district-outline', 'visibility', vis)
  }, [mapReady, greenSocialScores, showGreenSocialMap, districtBoundaries])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />
      {mapReady && <GreenerySidebar />}
      {mapReady && <TransportPoolPanel />}
      {mapReady && <AnalysisInfoModal />}
    </div>
  )
}
