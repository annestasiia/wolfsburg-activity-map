import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { DISTRICTS, CATEGORIES } from '../constants'
import { HIGHWAY_TYPES, ROAD_STYLE, getTrafficOpacity } from '../utils/trafficPatterns'
import { computeFootwayGeoJSON } from '../utils/footwayActivity'
import { computeBbox, inBbox, expandBbox, getCoordList } from '../utils/geoUtils'
import {
  GREENERY_FEATURES_QUERY,
  NETWORK_QUERY,
  GREENERY_QUERY_VERSION,
  CATEGORY_COLOR_EXPRESSION,
  greeneryOsmToGeoJSON,
  networkOsmToGeoJSON,
  computeVisibleGeoJSON,
} from '../utils/greeneryConfig'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const WOLFSBURG  = { center: [10.7865, 52.4227], zoom: 12 }

const CENTRAL_DISTRICTS = new Set([
  'Schillerteich', 'Stadtmitte', 'Rothenfelde', 'Wohltberg',
  'Volkswagenwerk', 'Alt-Wolfsburg', 'Hellwinkel', 'Heßlingen', 'Hohenstein',
])

const CITY_BBOX = [10.68, 52.35, 10.93, 52.52] // [minLng, minLat, maxLng, maxLat]

const CENTRAL_PADDING = {
  automobile: 0.025,
  transport:  0,
  cycling:    0.020,
}

const OVERPASS_QUERIES = {
  automobile: `[out:json][timeout:90];(way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street"](52.22,10.55,52.62,11.08););out body;>;out skel qt;`,
  cycling:    `[out:json][timeout:30];(way["highway"="cycleway"](52.35,10.68,52.52,10.93);way["cycleway"~"lane|track|shared_lane|opposite_lane|opposite_track"](52.35,10.68,52.52,10.93);way["cycleway:right"~"lane|track"](52.35,10.68,52.52,10.93);way["cycleway:left"~"lane|track"](52.35,10.68,52.52,10.93);way["cycleway:both"~"lane|track"](52.35,10.68,52.52,10.93);way["bicycle"="designated"]["highway"~"path|track|footway"](52.35,10.68,52.52,10.93);way["bicycle"="yes"]["highway"~"path|track"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
  transport:  `[out:json][timeout:60];(relation["route"~"bus|tram|subway|light_rail|trolleybus|share_taxi"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildGeoJSON(venues) {
  return {
    type: 'FeatureCollection',
    features: venues.map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id, name: v.name, type: v.type, category: v.category,
        district: v.district, address: `${v.street}, ${v.city}`,
        rating: v.rating || '', openingHours: v.openingHours || '',
        peakTimes: v.peakTimes || '', notes: v.notes || '',
        ageGroups: v.ageGroups || '', street: v.street || '', city: v.city || '',
        activityLevel: v.activityLevel, openStatus: v.openStatus,
        opacity: v.opacity, radius: v.radius, color: v.color,
      },
    })),
  }
}

function scoreToColor(score) {
  if (score <= 0) return '#FFF0F3'
  if (score <= 2) return '#FFCCD5'
  if (score <= 4) return '#FF8FA3'
  if (score <= 6) return '#FF4D6D'
  return '#FF1744'
}

function normalizeScores(raw, cap = 10) {
  const realVals = Object.values(raw).filter(v => v > 0 && v < 9999)
  const max = realVals.length ? Math.max(...realVals) : 1
  const out  = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v >= 9999)  { out[k] = cap; continue }
    out[k] = v === 0 ? 0 : Math.max(1, Math.round((v / max) * cap))
  }
  return out
}

function scoreDistrictsToCenter(geoJSON, districtBoundaries, centralPadding = 0) {
  const centralBboxes = []
  for (const name of CENTRAL_DISTRICTS) {
    const gj = districtBoundaries[name]
    if (gj) centralBboxes.push(expandBbox(computeBbox(gj), centralPadding))
  }
  if (!centralBboxes.length) return {}

  const scores = {}
  for (const { name } of DISTRICTS) {
    if (CENTRAL_DISTRICTS.has(name)) { scores[name] = 9999; continue }
    const distGeoJSON = districtBoundaries[name]
    if (!distGeoJSON) { scores[name] = 0; continue }
    const distBbox = computeBbox(distGeoJSON)
    let count = 0
    for (const feature of geoJSON.features) {
      const coords = getCoordList(feature.geometry)
      let hitDist = false, hitCenter = false
      for (const [lng, lat] of coords) {
        if (!hitDist && inBbox(lng, lat, distBbox)) hitDist = true
        if (!hitCenter) {
          for (const cb of centralBboxes) {
            if (inBbox(lng, lat, cb)) { hitCenter = true; break }
          }
        }
        if (hitDist && hitCenter) { count++; break }
      }
    }
    scores[name] = count
  }
  return scores
}

function overpassToGeoJSON(data) {
  const nodeMap = {}
  const wayMap  = {}
  data.elements.forEach(el => {
    if (el.type === 'node') nodeMap[el.id] = [el.lon, el.lat]
    else if (el.type === 'way') wayMap[el.id] = el.nodes || []
  })

  const features = []
  const hasRelations = data.elements.some(el => el.type === 'relation')

  if (hasRelations) {
    data.elements.filter(el => el.type === 'relation').forEach(rel => {
      const lines = []
      ;(rel.members || []).forEach(m => {
        if (m.type !== 'way') return
        const coords = (wayMap[m.ref] || []).map(id => nodeMap[id]).filter(Boolean)
        if (coords.length >= 2) lines.push(coords)
      })
      if (lines.length > 0) {
        features.push({
          type: 'Feature',
          geometry: { type: 'MultiLineString', coordinates: lines },
          properties: { ...(rel.tags || {}), _id: rel.id },
        })
      }
    })
  } else {
    data.elements.filter(el => el.type === 'way').forEach(el => {
      const coords = (el.nodes || []).map(id => nodeMap[id]).filter(Boolean)
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { ...(el.tags || {}), _id: el.id },
        })
      }
    })
  }
  return { type: 'FeatureCollection', features }
}

function stopsToGeoJSON(data) {
  const features = data.elements
    .filter(el => el.type === 'node' && el.lat != null)
    .map(el => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      properties: { _id: el.id, name: el.tags?.name || el.tags?.['name:de'] || '', ref: el.tags?.ref || '' },
    }))
  return { type: 'FeatureCollection', features }
}

function parkingToGeoJSON(data) {
  const features = data.elements
    .filter(el => (el.type === 'node' && el.lat != null) || (el.type === 'way' && el.center?.lat != null))
    .map(el => {
      const coords = el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat]
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          _id: el.id,
          capacity: el.tags?.capacity ? (parseInt(el.tags.capacity, 10) || 1) : 1,
          covered: el.tags?.covered === 'yes',
          name: el.tags?.name || '',
        },
      }
    })
  return { type: 'FeatureCollection', features }
}

function tagAutoRoads(geoJSON) {
  return {
    ...geoJSON,
    features: geoJSON.features.map(f => {
      const coords = getCoordList(f.geometry)
      const mid = coords[Math.floor(coords.length / 2)] || coords[0] || [0, 0]
      const inCity = mid[0] >= CITY_BBOX[0] && mid[0] <= CITY_BBOX[2] &&
                     mid[1] >= CITY_BBOX[1] && mid[1] <= CITY_BBOX[3]
      return { ...f, properties: { ...f.properties, inCity: inCity ? 1 : 0 } }
    }),
  }
}

// ── Building activity helpers ─────────────────────────────────────────────────

function polygonCentroid(feature) {
  const ring = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates[0][0]
  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat }
  return [sumLng / ring.length, sumLat / ring.length]
}

function haversineM([lng1, lat1], [lng2, lat2]) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ACTIVITY_SCORE = { High: 1.0, Med: 0.55, Low: 0.25 }
const MATCH_RADIUS   = 80

function enrichBuildings(buildingsData, venues) {
  return {
    ...buildingsData,
    features: buildingsData.features.map(f => {
      const center = polygonCentroid(f)
      const cat    = f.properties.category
      let best = 0
      for (const v of venues) {
        if (v.category !== cat) continue
        const d = haversineM(center, [v.lng, v.lat])
        if (d <= MATCH_RADIUS) {
          const s = ACTIVITY_SCORE[v.activityLevel] ?? 0
          if (s > best) best = s
        }
      }
      return { ...f, properties: { ...f.properties, activityScore: best } }
    }),
  }
}

function buildDistrictLabelGeoJSON(districtBoundaries) {
  const features = Object.entries(districtBoundaries)
    .filter(([, gj]) => gj?.features?.length)
    .map(([name, gj]) => {
      const { minLng, maxLng, minLat, maxLat } = computeBbox(gj)
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] },
        properties: { name },
      }
    })
  return { type: 'FeatureCollection', features }
}

function makeHeatmapOpacity(day, time) {
  const o = (t) => getTrafficOpacity(t, day, time)
  return ['match', ['get', 'highway'],
    'motorway', o('motorway'), 'trunk', o('trunk'),
    'motorway_link', o('motorway'), 'trunk_link', o('trunk'),
    'primary', o('primary'), 'primary_link', o('primary'),
    'secondary', o('secondary'), 'secondary_link', o('secondary'),
    'tertiary', o('tertiary'), 'tertiary_link', o('tertiary'),
    'unclassified', o('unclassified'), 'residential', o('residential'),
    'living_street', o('living_street'), 0.20,
  ]
}

function getTransitActivity(selectedDay, selectedTime) {
  const hour = parseInt(selectedTime.split(':')[0], 10)
  const isWeekend = selectedDay === 'Sat' || selectedDay === 'Sun'
  if (hour >= 23 || hour <= 5) return 0.12
  if (isWeekend) return hour >= 9 && hour <= 20 ? 0.65 : 0.35
  if (hour >= 7 && hour <= 9) return 0.92
  if (hour >= 17 && hour <= 19) return 0.95
  if (hour >= 10 && hour <= 16) return 0.65
  return 0.45
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MapView({ onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const activeMobilityModesRef = useRef(new Set())
  const activeModeRef          = useRef('mobility')

  const {
    districtBoundaries, selectedDistricts,
    parks, water, forest, showParks, showWater, showForest,
    buildings, showBuildingPlots,
    showFacilitiesInMobility,
    roads, footways,
    activeModes, activeMode,
    selectedDay, selectedTime,
    // Mobility multi-mode
    activeMobilityModes,
    mobilityDataCache, mobilityDataLoading,
    mobilityScoresPerMode, mobilityOverlayPerMode,
    mobilityHighlightRoute,
    setMobilityDataLoading, setMobilityDataCache,
    setMobilityScoresForMode, setMobilityOverlayForMode,
    setMobilityHighlightRoute,
    // Automobile
    autoShowRegional, autoShowHeatmap, autoShowParking,
    autoParkingGeoJSON, setAutoParkingGeoJSON,
    // Transit
    transitShowRegional, transitShowHeatmap, transitShowBusStops,
    transitStopsGeoJSON, setTransitStopsGeoJSON,
    // Cycling
    cyclingShowRegional, cyclingShowRoutes, cyclingShowLeisureRoutes, cyclingShowBikeParking,
    cyclingParkingGeoJSON, setCyclingParkingGeoJSON,
    cyclingRoutesGeoJSON, setCyclingRoutesGeoJSON,
    cyclingHighlightLeisureRoute,
    selectedMobilityDistrict, setSelectedMobilityDistrict,
    // Greenery
    greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles,
    showGreeneryDistrictBorders,
    setGreeneryGeoJSON, setGreeneryDataLoading, setGreeneryDataError,
    // Global
    showAllBorders, showDistrictNames,
  } = useAppStore()
  const { filteredVenues } = useFilters()

  useEffect(() => { activeMobilityModesRef.current = activeMobilityModes }, [activeMobilityModes])
  useEffect(() => { activeModeRef.current = activeMode }, [activeMode])

  // ── Initialise map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: WOLFSBURG.center,
      zoom: WOLFSBURG.zoom,
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      map.addLayer({
        id: 'venue-circles', type: 'circle', source: 'venues',
        filter: ['>', ['get', 'radius'], 0],
        paint: {
          'circle-radius': ['get', 'radius'], 'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': ['get', 'opacity'],
        },
      })

      map.addLayer({
        id: 'venue-dots-inactive', type: 'circle', source: 'venues',
        filter: ['==', ['get', 'radius'], 0],
        paint: { 'circle-radius': 3, 'circle-color': '#8E8E93', 'circle-opacity': 0.35, 'circle-stroke-width': 0 },
      })

      // Building footprint source + layers (colored by category, opacity = activity)
      map.addSource('buildings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Fill color = gray → category color (accessibility), opacity = activity level
      map.addLayer({
        id: 'buildings-fill', type: 'fill', source: 'buildings',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'category'], 'Schools'],
            ['interpolate', ['linear'], ['get', 'connectivity_score'], 0, '#ECEFF1', 4, '#185FA5'],
            ['==', ['get', 'category'], 'Culture'],
            ['interpolate', ['linear'], ['get', 'connectivity_score'], 0, '#ECEFF1', 4, '#534AB7'],
            ['==', ['get', 'category'], 'Leisure'],
            ['interpolate', ['linear'], ['get', 'connectivity_score'], 0, '#ECEFF1', 4, '#1D9E75'],
            ['==', ['get', 'category'], 'Commercial'],
            ['interpolate', ['linear'], ['get', 'connectivity_score'], 0, '#ECEFF1', 4, '#BA7517'],
            '#ECEFF1',
          ],
          'fill-opacity': [
            'interpolate', ['linear'], ['get', 'activityScore'],
            0, 0.15, 0.25, 0.45, 0.55, 0.70, 1, 0.95,
          ],
        },
      }, 'venue-circles')

      // Thin neutral outline — just marks the plot boundary, no encoding
      map.addLayer({
        id: 'buildings-outline', type: 'line', source: 'buildings',
        layout: { visibility: 'none' },
        paint: {
          'line-color':   '#90A4AE',
          'line-width':   0.5,
          'line-opacity': 0.5,
        },
      }, 'venue-circles')

      map.on('mouseenter', 'venue-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const feat  = e.features[0]
        const props = feat.properties
        tooltipRef.current?.remove()
        tooltipRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'venue-tooltip' })
          .setLngLat(feat.geometry.coordinates)
          .setHTML(`<div style="font-size:12px;line-height:1.4;color:#1D1D1F"><strong style="display:block;margin-bottom:2px">${props.name}</strong><span style="color:#8E8E93">${props.activityLevel} · ${props.category}</span></div>`)
          .addTo(map)
      })
      map.on('mouseleave', 'venue-circles', () => {
        map.getCanvas().style.cursor = ''
        tooltipRef.current?.remove()
        tooltipRef.current = null
      })

      map.on('click', 'venue-circles',       (e) => onVenueClick?.(e.features[0].properties))
      map.on('click', 'venue-dots-inactive', (e) => onVenueClick?.(e.features[0].properties))

      setMapReady(true)
    })

    mapRef.current = map
    return () => {
      tooltipRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Re-wire venue click handler ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const handler = (e) => onVenueClick?.(e.features[0].properties)
    map.off('click', 'venue-circles',       handler)
    map.off('click', 'venue-dots-inactive', handler)
    map.on('click',  'venue-circles',       handler)
    map.on('click',  'venue-dots-inactive', handler)
  }, [mapReady, onVenueClick])

  // ── District click + cursor in mobility mode ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const handleClick = (e) => {
      if (activeModeRef.current !== 'mobility') return
      const modes = activeMobilityModesRef.current
      if (!modes.has('transport') && !modes.has('cycling')) return
      const layers = DISTRICTS.map(d => `boundary-fill-${d.name}`).filter(id => map.getLayer(id))
      const features = map.queryRenderedFeatures(e.point, { layers })
      if (!features.length) {
        useAppStore.getState().setSelectedMobilityDistrict(null)
        return
      }
      const name = features[0].layer.id.replace('boundary-fill-', '')
      useAppStore.getState().setSelectedMobilityDistrict(name)
    }

    const handleMouseMove = (e) => {
      if (activeModeRef.current !== 'mobility') { map.getCanvas().style.cursor = ''; return }
      const modes = activeMobilityModesRef.current
      if (!modes.has('transport') && !modes.has('cycling')) { map.getCanvas().style.cursor = ''; return }
      const layers = DISTRICTS.map(d => `boundary-fill-${d.name}`).filter(id => map.getLayer(id))
      const features = map.queryRenderedFeatures(e.point, { layers })
      map.getCanvas().style.cursor = features.length ? 'pointer' : ''
    }

    map.on('click',     handleClick)
    map.on('mousemove', handleMouseMove)
    return () => {
      map.off('click',     handleClick)
      map.off('mousemove', handleMouseMove)
    }
  }, [mapReady])

  // ── Natural feature layers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const layers = [
      { id: 'forest', data: forest, fill: { 'fill-color': '#228B22', 'fill-opacity': 0.22 }, line: { 'line-color': '#228B22', 'line-width': 0.8, 'line-opacity': 0.45 }, visible: showForest },
      { id: 'water',  data: water,  fill: { 'fill-color': '#4A90E2', 'fill-opacity': 0.28 }, line: { 'line-color': '#2E75CC', 'line-width': 1,   'line-opacity': 0.55 }, visible: showWater  },
      { id: 'parks',  data: parks,  fill: { 'fill-color': '#90EE90', 'fill-opacity': 0.28 }, line: { 'line-color': '#32CD32', 'line-width': 1,   'line-opacity': 0.50 }, visible: showParks  },
    ]
    for (const { id, data, fill, line, visible } of layers) {
      if (!data) continue
      const vis = (activeMode === 'facilities' && visible) ? 'visible' : 'none'
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data })
        map.addLayer({ id: `${id}-fill`,    type: 'fill', source: id, paint: fill }, 'venue-circles')
        map.addLayer({ id: `${id}-outline`, type: 'line', source: id, paint: line }, 'venue-circles')
      }
      if (map.getLayer(`${id}-fill`))    map.setLayoutProperty(`${id}-fill`,    'visibility', vis)
      if (map.getLayer(`${id}-outline`)) map.setLayoutProperty(`${id}-outline`, 'visibility', vis)
    }
  }, [mapReady, forest, water, parks, showForest, showWater, showParks, activeMode])

  // ── Update venue GeoJSON ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('venues')
    if (src) src.setData(buildGeoJSON(filteredVenues))
  }, [filteredVenues, mapReady])

  // ── Venue circles: show in facilities mode or when facilities overlay active in mobility
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const vis = (
      (activeMode === 'facilities' && !showBuildingPlots) ||
      (activeMode === 'mobility'   &&  showFacilitiesInMobility)
    ) ? 'visible' : 'none'
    if (map.getLayer('venue-circles'))       map.setLayoutProperty('venue-circles',       'visibility', vis)
    if (map.getLayer('venue-dots-inactive')) map.setLayoutProperty('venue-dots-inactive', 'visibility', vis)
  }, [mapReady, activeMode, showBuildingPlots, showFacilitiesInMobility])

  // ── Building plots: enrich with activity scores and push to map ───────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !buildings) return
    const src = mapRef.current.getSource('buildings')
    if (!src) return
    src.setData(enrichBuildings(buildings, filteredVenues))
  }, [mapReady, buildings, filteredVenues])

  // ── Building plots: toggle visibility ────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const vis = showBuildingPlots && activeMode === 'facilities' ? 'visible' : 'none'
    if (map.getLayer('buildings-fill'))    map.setLayoutProperty('buildings-fill',    'visibility', vis)
    if (map.getLayer('buildings-outline')) map.setLayoutProperty('buildings-outline', 'visibility', vis)
  }, [mapReady, showBuildingPlots, activeMode])

  // ── Legacy traffic layer (non-mobility modes) ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !roads) return
    const map = mapRef.current
    if (map.getSource('roads')) return
    map.addSource('roads', { type: 'geojson', data: roads })
    HIGHWAY_TYPES.forEach(type => {
      map.addLayer({
        id: `roads-${type}`, type: 'line', source: 'roads',
        filter: ['==', ['get', 'highway'], type],
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': ROAD_STYLE[type].color, 'line-width': ROAD_STYLE[type].width, 'line-opacity': 0 },
      }, 'venue-circles')
    })
  }, [mapReady, roads])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const showTransport = activeModes.has('transport')
    HIGHWAY_TYPES.forEach(type => {
      const layerId = `roads-${type}`
      if (!map.getLayer(layerId)) return
      map.setLayoutProperty(layerId, 'visibility', showTransport ? 'visible' : 'none')
      if (showTransport) map.setPaintProperty(layerId, 'line-opacity', getTrafficOpacity(type, selectedDay, selectedTime))
    })
  }, [mapReady, activeModes, selectedDay, selectedTime])

  // ── Footway layer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !footways) return
    const map = mapRef.current
    if (map.getSource('footways')) return
    const initial = computeFootwayGeoJSON(footways, [], 'Mon', '12:00')
    map.addSource('footways', { type: 'geojson', data: initial })
    map.addLayer({
      id: 'footways-line', type: 'line', source: 'footways',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#007AFF', 'line-width': 1.8, 'line-opacity': ['get', 'opacity'] },
    }, 'venue-circles')
  }, [mapReady, footways])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !footways || !mapRef.current.getSource('footways')) return
    mapRef.current.getSource('footways').setData(computeFootwayGeoJSON(footways, filteredVenues, selectedDay, selectedTime))
  }, [mapReady, footways, filteredVenues, selectedDay, selectedTime])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapRef.current.getLayer('footways-line')) return
    mapRef.current.setLayoutProperty('footways-line', 'visibility', activeModes.has('pedestrian') ? 'visible' : 'none')
  }, [mapReady, activeModes])

  // ── District boundary layers ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    DISTRICTS.forEach(({ name, color }) => {
      const srcId  = `boundary-${name}`
      const fillId = `boundary-fill-${name}`
      const lineId = `boundary-line-${name}`
      const data   = districtBoundaries[name]
      const vis    = selectedDistricts.has(name) ? 'visible' : 'none'

      if (data?.features?.length && !map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data })
        map.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': color, 'fill-opacity': 0.12 } }, 'venue-circles')
        map.addLayer({ id: lineId, type: 'line', source: srcId, paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85 } }, 'venue-circles')
      }

      if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis)
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis)
    })
  }, [mapReady, districtBoundaries, selectedDistricts])

  // ── Mobility: fetch data for each active mode ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !Object.keys(districtBoundaries).length) return

    for (const mode of activeMobilityModes) {
      if (mobilityOverlayPerMode[mode]) continue // already loaded

      let cancelled = false

      const fetchMode = async () => {
        setMobilityDataLoading(true)
        try {
          let raw = useAppStore.getState().mobilityDataCache[mode]
          if (!raw) {
            const res = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `data=${encodeURIComponent(OVERPASS_QUERIES[mode])}`,
            })
            raw = await res.json()
            if (!cancelled) setMobilityDataCache(mode, raw)
          }
          const geoJSON   = overpassToGeoJSON(raw)
          const rawScores = scoreDistrictsToCenter(geoJSON, districtBoundaries, CENTRAL_PADDING[mode] ?? 0)
          if (!cancelled) {
            setMobilityOverlayForMode(mode, geoJSON)
            setMobilityScoresForMode(mode, normalizeScores(rawScores))
          }
        } catch (err) {
          console.error(`Mobility fetch error (${mode}):`, err)
        } finally {
          if (!cancelled) setMobilityDataLoading(false)
        }
      }

      fetchMode()
      // Note: cleanup is best-effort; each mode runs independently
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMobilityModes, districtBoundaries])

  // ── Automobile: fetch public car parking ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeMobilityModes.has('automobile')) return
    if (useAppStore.getState().autoParkingGeoJSON) return
    let cancelled = false
    const Q = `[out:json][timeout:30];(node["amenity"="parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93);way["amenity"="parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93););out center;`
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(Q)}` })
      .then(r => r.json())
      .then(raw => { if (!cancelled) setAutoParkingGeoJSON(parkingToGeoJSON(raw)) })
      .catch(e => console.error('Auto parking fetch error:', e))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMobilityModes])

  // ── Transit: fetch bus stops ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeMobilityModes.has('transport')) return
    if (useAppStore.getState().transitStopsGeoJSON) return
    let cancelled = false
    const Q = `[out:json][timeout:30];(node["highway"="bus_stop"](52.35,10.68,52.52,10.93);node["public_transport"="platform"]["bus"="yes"](52.35,10.68,52.52,10.93););out body;`
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(Q)}` })
      .then(r => r.json())
      .then(raw => { if (!cancelled) setTransitStopsGeoJSON(stopsToGeoJSON(raw)) })
      .catch(e => console.error('Stops fetch error:', e))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMobilityModes])

  // ── Cycling: fetch bike parking ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeMobilityModes.has('cycling')) return
    if (useAppStore.getState().cyclingParkingGeoJSON) return
    let cancelled = false
    const Q = `[out:json][timeout:30];(node["amenity"="bicycle_parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93);way["amenity"="bicycle_parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93););out center;`
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(Q)}` })
      .then(r => r.json())
      .then(raw => { if (!cancelled) setCyclingParkingGeoJSON(parkingToGeoJSON(raw)) })
      .catch(e => console.error('Cycling parking fetch error:', e))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMobilityModes])

  // ── Cycling: fetch leisure routes ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeMobilityModes.has('cycling')) return
    if (useAppStore.getState().cyclingRoutesGeoJSON) return
    let cancelled = false
    const Q = `[out:json][timeout:60];(relation["route"="bicycle"](52.30,10.60,52.55,11.00);relation["route"="mtb"](52.30,10.60,52.55,11.00););out body;>;out skel qt;`
    fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(Q)}` })
      .then(r => r.json())
      .then(raw => { if (!cancelled) setCyclingRoutesGeoJSON(overpassToGeoJSON(raw)) })
      .catch(e => console.error('Cycling routes fetch error:', e))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMobilityModes])

  // ── Automobile: render road overlay ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const geoJSON = mobilityOverlayPerMode.automobile
    const active  = activeMobilityModes.has('automobile')

    if (!geoJSON) {
      if (map.getLayer('auto-overlay')) map.setLayoutProperty('auto-overlay', 'visibility', 'none')
      return
    }

    const sourceData = tagAutoRoads(geoJSON)

    const lineColor = autoShowHeatmap
      ? ['match', ['get', 'highway'],
          'motorway', '#FF0000', 'trunk', '#FF2000', 'motorway_link', '#FF2000', 'trunk_link', '#FF2000',
          'primary', '#FF4400', 'primary_link', '#FF4400',
          'secondary', '#FF6600', 'secondary_link', '#FF6600',
          'tertiary', '#FF8800', 'tertiary_link', '#FFAA00',
          'unclassified', '#FFCC00', 'residential', '#FFDD66', 'living_street', '#FFEE88', '#AAAAAA']
      : '#B8C0CC'

    const lineWidth = autoShowHeatmap
      ? ['match', ['get', 'highway'], 'motorway', 9, 'trunk', 8, 'motorway_link', 5, 'trunk_link', 5, 'primary', 6, 'primary_link', 4.5, 'secondary', 4.5, 'secondary_link', 3.5, 'tertiary', 3.5, 'tertiary_link', 3, 'unclassified', 2.5, 'residential', 2, 'living_street', 1.5, 1.2]
      : ['match', ['get', 'highway'], 'motorway', 6, 'trunk', 5, 'motorway_link', 3.5, 'trunk_link', 3.5, 'primary', 3.5, 'primary_link', 3, 'secondary', 2.5, 'secondary_link', 2, 'tertiary', 2, 'tertiary_link', 1.5, 'unclassified', 1.2, 'residential', 1.0, 'living_street', 0.8, 0.8]

    const lineOpacity = autoShowHeatmap
      ? ['case', ['==', ['get', 'inCity'], 1], makeHeatmapOpacity(selectedDay, selectedTime), 0.18]
      : ['case', ['==', ['get', 'inCity'], 1],
          ['match', ['get', 'highway'], 'motorway', 0.70, 'trunk', 0.70, 'motorway_link', 0.62, 'trunk_link', 0.62, 'primary', 0.60, 'primary_link', 0.58, 'secondary', 0.55, 'secondary_link', 0.52, 'tertiary', 0.50, 'tertiary_link', 0.47, 'unclassified', 0.42, 'residential', 0.40, 'living_street', 0.35, 0.35],
          0.30]

    const getBeforeLayer = () => {
      const firstFill = DISTRICTS.map(d => `boundary-fill-${d.name}`).find(id => map.getLayer(id))
      return firstFill || 'venue-circles'
    }

    if (!map.getSource('auto-overlay')) {
      map.addSource('auto-overlay', { type: 'geojson', data: sourceData })
      map.addLayer({ id: 'auto-overlay', type: 'line', source: 'auto-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': lineColor, 'line-width': lineWidth, 'line-opacity': lineOpacity },
      }, getBeforeLayer())
    } else {
      map.getSource('auto-overlay').setData(sourceData)
      if (map.getLayer('auto-overlay')) {
        map.setPaintProperty('auto-overlay', 'line-color',   lineColor)
        map.setPaintProperty('auto-overlay', 'line-width',   lineWidth)
        map.setPaintProperty('auto-overlay', 'line-opacity', lineOpacity)
        map.setLayoutProperty('auto-overlay', 'visibility', active ? 'visible' : 'none')
        try { map.moveLayer('auto-overlay', getBeforeLayer()) } catch (_) {}
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, autoShowHeatmap, selectedDay, selectedTime])

  // ── Transport: render route overlay ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const geoJSON = mobilityOverlayPerMode.transport
    const active  = activeMobilityModes.has('transport')

    if (!geoJSON) {
      if (map.getLayer('transport-overlay')) map.setLayoutProperty('transport-overlay', 'visibility', 'none')
      return
    }

    const opacity = transitShowHeatmap ? getTransitActivity(selectedDay, selectedTime) : 0.55

    if (!map.getSource('transport-overlay')) {
      map.addSource('transport-overlay', { type: 'geojson', data: geoJSON })
      map.addLayer({ id: 'transport-overlay', type: 'line', source: 'transport-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': transitShowHeatmap ? '#FF6600' : '#E63946', 'line-width': 1.8, 'line-opacity': opacity },
      }, 'venue-circles')
    } else {
      map.getSource('transport-overlay').setData(geoJSON)
      if (map.getLayer('transport-overlay')) {
        map.setPaintProperty('transport-overlay', 'line-color',   transitShowHeatmap ? '#FF6600' : '#E63946')
        map.setPaintProperty('transport-overlay', 'line-width',   transitShowHeatmap ? 2.5 : 1.8)
        map.setPaintProperty('transport-overlay', 'line-opacity', opacity)
        map.setLayoutProperty('transport-overlay', 'visibility',  active ? 'visible' : 'none')
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, transitShowHeatmap, selectedDay, selectedTime])

  // ── Cycling: render cycling paths overlay ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const geoJSON = mobilityOverlayPerMode.cycling
    const active  = activeMobilityModes.has('cycling') && cyclingShowRoutes

    if (!geoJSON) {
      if (map.getLayer('cycling-overlay')) map.setLayoutProperty('cycling-overlay', 'visibility', 'none')
      return
    }

    if (!map.getSource('cycling-overlay')) {
      map.addSource('cycling-overlay', { type: 'geojson', data: geoJSON })
      map.addLayer({ id: 'cycling-overlay', type: 'line', source: 'cycling-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FF1744', 'line-width': 4.0, 'line-opacity': 0.88 },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-overlay').setData(geoJSON)
      if (map.getLayer('cycling-overlay'))
        map.setLayoutProperty('cycling-overlay', 'visibility', active ? 'visible' : 'none')
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, cyclingShowRoutes])

  // ── Highlight selected transport route ────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const geoJSON = mobilityOverlayPerMode.transport

    if (!mobilityHighlightRoute || !geoJSON) {
      if (map.getLayer('mobility-highlight')) map.setLayoutProperty('mobility-highlight', 'visibility', 'none')
      return
    }

    const feature = geoJSON.features.find(f => f.properties._id === mobilityHighlightRoute)
    if (!feature) return
    const hlGeoJSON = { type: 'FeatureCollection', features: [feature] }

    if (!map.getSource('mobility-highlight')) {
      map.addSource('mobility-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({ id: 'mobility-highlight', type: 'line', source: 'mobility-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FF6900', 'line-width': 4.5, 'line-opacity': 0.90 },
      })
    } else {
      map.getSource('mobility-highlight').setData(hlGeoJSON)
      map.setLayoutProperty('mobility-highlight', 'visibility', 'visible')
    }
  }, [mapReady, mobilityHighlightRoute, mobilityOverlayPerMode])

  // ── Transit stops: render / update ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !transitStopsGeoJSON) return
    const map = mapRef.current
    const active = activeMobilityModes.has('transport')

    // In heatmap mode, filter stops by activity level (dim at night, active in peak hours)
    const activity = getTransitActivity(selectedDay, selectedTime)
    const showStops = transitShowBusStops && active
    const vis = showStops ? 'visible' : 'none'

    const stopOpacity = transitShowHeatmap ? Math.max(0.10, activity) : 0.85
    // When heatmap+stops: hide stops with very low activity (night hours)
    const circleVis = (showStops && (!transitShowHeatmap || activity > 0.20)) ? 'visible' : 'none'

    if (!map.getSource('transit-stops')) {
      map.addSource('transit-stops', { type: 'geojson', data: transitStopsGeoJSON })
      map.addLayer({ id: 'transit-stops-circles', type: 'circle', source: 'transit-stops',
        layout: { visibility: circleVis },
        paint: { 'circle-radius': 5, 'circle-color': '#0077FF', 'circle-opacity': stopOpacity, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9 },
      }, 'venue-circles')
    } else {
      map.getSource('transit-stops').setData(transitStopsGeoJSON)
      if (map.getLayer('transit-stops-circles')) {
        map.setPaintProperty('transit-stops-circles', 'circle-opacity', stopOpacity)
        map.setLayoutProperty('transit-stops-circles', 'visibility', circleVis)
      }
    }
  }, [mapReady, transitStopsGeoJSON, transitShowBusStops, transitShowHeatmap, activeMobilityModes, selectedDay, selectedTime])

  // ── Auto parking: render / update ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !autoParkingGeoJSON) return
    const map = mapRef.current
    const vis = (activeMobilityModes.has('automobile') && autoShowParking) ? 'visible' : 'none'

    if (!map.getSource('auto-parking')) {
      map.addSource('auto-parking', { type: 'geojson', data: autoParkingGeoJSON })
      map.addLayer({ id: 'auto-parking-circles', type: 'circle', source: 'auto-parking',
        layout: { visibility: vis },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'capacity'], 1, 5, 20, 9, 100, 14], 'circle-color': '#1565C0', 'circle-opacity': 0.82, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9 },
      }, 'venue-circles')
    } else {
      map.getSource('auto-parking').setData(autoParkingGeoJSON)
      if (map.getLayer('auto-parking-circles'))
        map.setLayoutProperty('auto-parking-circles', 'visibility', vis)
    }
  }, [mapReady, autoParkingGeoJSON, autoShowParking, activeMobilityModes])

  // ── Cycling parking: render / update ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !cyclingParkingGeoJSON) return
    const map = mapRef.current
    const vis = (activeMobilityModes.has('cycling') && cyclingShowBikeParking) ? 'visible' : 'none'

    if (!map.getSource('cycling-parking')) {
      map.addSource('cycling-parking', { type: 'geojson', data: cyclingParkingGeoJSON })
      map.addLayer({ id: 'cycling-parking-circles', type: 'circle', source: 'cycling-parking',
        layout: { visibility: vis },
        paint: { 'circle-radius': 5, 'circle-color': '#00C853', 'circle-opacity': 0.88, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9 },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-parking').setData(cyclingParkingGeoJSON)
      if (map.getLayer('cycling-parking-circles'))
        map.setLayoutProperty('cycling-parking-circles', 'visibility', vis)
    }
  }, [mapReady, cyclingParkingGeoJSON, cyclingShowBikeParking, activeMobilityModes])

  // ── Cycling leisure routes: render / update ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !cyclingRoutesGeoJSON) return
    const map = mapRef.current
    const vis = (activeMobilityModes.has('cycling') && cyclingShowLeisureRoutes) ? 'visible' : 'none'

    if (!map.getSource('cycling-routes')) {
      map.addSource('cycling-routes', { type: 'geojson', data: cyclingRoutesGeoJSON })
      map.addLayer({ id: 'cycling-routes-line', type: 'line', source: 'cycling-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
        paint: { 'line-color': '#FF6900', 'line-width': 3.5, 'line-opacity': 0.80, 'line-dasharray': [4, 3] },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-routes').setData(cyclingRoutesGeoJSON)
      if (map.getLayer('cycling-routes-line'))
        map.setLayoutProperty('cycling-routes-line', 'visibility', vis)
    }
  }, [mapReady, cyclingRoutesGeoJSON, cyclingShowLeisureRoutes, activeMobilityModes])

  // ── Cycling highlight leisure route ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    if (!cyclingHighlightLeisureRoute || !cyclingRoutesGeoJSON) {
      if (map.getLayer('cycling-route-highlight')) map.setLayoutProperty('cycling-route-highlight', 'visibility', 'none')
      return
    }

    const feature = cyclingRoutesGeoJSON.features.find(f => f.properties._id === cyclingHighlightLeisureRoute)
    if (!feature) return
    const hlGeoJSON = { type: 'FeatureCollection', features: [feature] }

    if (!map.getSource('cycling-route-highlight')) {
      map.addSource('cycling-route-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({ id: 'cycling-route-highlight', type: 'line', source: 'cycling-route-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FF6900', 'line-width': 7, 'line-opacity': 0.92 },
      })
    } else {
      map.getSource('cycling-route-highlight').setData(hlGeoJSON)
      map.setLayoutProperty('cycling-route-highlight', 'visibility', 'visible')
    }
  }, [mapReady, cyclingHighlightLeisureRoute, cyclingRoutesGeoJSON])

  // ── District coloring by regional activity ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    // Determine the single active mode (if any) for regional activity display
    const modes = [...activeMobilityModes]
    const singleMode = modes.length === 1 ? modes[0] : null
    const scores = singleMode ? (mobilityScoresPerMode[singleMode] || {}) : {}
    const hasMobilityScores = Object.keys(scores).length > 0

    // Regional activity on/off per mode
    const showRegional = singleMode === 'automobile' ? autoShowRegional
      : singleMode === 'transport' ? transitShowRegional
      : singleMode === 'cycling' ? cyclingShowRegional
      : false

    DISTRICTS.forEach(({ name, color }) => {
      const fillId = `boundary-fill-${name}`
      const lineId = `boundary-line-${name}`
      if (!map.getLayer(fillId)) return

      if (hasMobilityScores && showRegional) {
        const normScore = scores[name] ?? 0
        map.setLayoutProperty(fillId, 'visibility', 'visible')
        map.setLayoutProperty(lineId, 'visibility', 'none')
        map.setPaintProperty(fillId, 'fill-color',   scoreToColor(normScore))
        map.setPaintProperty(fillId, 'fill-opacity', 0.40)
      } else if (activeMode === 'mobility') {
        // In mobility mode with no scoring: hide district fills/lines
        map.setLayoutProperty(fillId, 'visibility', 'none')
        map.setLayoutProperty(lineId, 'visibility', 'none')
      } else {
        const vis = selectedDistricts.has(name) ? 'visible' : 'none'
        map.setLayoutProperty(fillId, 'visibility', vis)
        map.setLayoutProperty(lineId, 'visibility', vis)
        map.setPaintProperty(fillId, 'fill-color',   color)
        map.setPaintProperty(fillId, 'fill-opacity', 0.12)
        map.setPaintProperty(lineId, 'line-color',   color)
        map.setPaintProperty(lineId, 'line-opacity', 0.85)
        map.setPaintProperty(lineId, 'line-width',   3)
      }
    })
  }, [mapReady, mobilityScoresPerMode, activeMobilityModes, selectedDistricts, activeMode,
      autoShowRegional, transitShowRegional, cyclingShowRegional])

  // ── Show All Borders: light gray district outlines (global) ───────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const allFeatures = Object.entries(districtBoundaries).flatMap(([name, gj]) =>
      (gj?.features || []).map(f => ({ ...f, properties: { ...f.properties, _name: name } }))
    )
    if (!allFeatures.length) return

    const allGeoJSON = { type: 'FeatureCollection', features: allFeatures }

    if (!map.getSource('all-borders')) {
      map.addSource('all-borders', { type: 'geojson', data: allGeoJSON })
      map.addLayer({ id: 'all-borders-line', type: 'line', source: 'all-borders',
        layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
        paint: { 'line-color': '#B8BCC8', 'line-width': 1.5, 'line-opacity': 0.65 },
      })
    } else {
      map.getSource('all-borders').setData(allGeoJSON)
    }

    if (map.getLayer('all-borders-line'))
      map.setLayoutProperty('all-borders-line', 'visibility', showAllBorders ? 'visible' : 'none')
  }, [mapReady, districtBoundaries, showAllBorders])

  // ── District name labels ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const labelsGeoJSON = buildDistrictLabelGeoJSON(districtBoundaries)
    if (!labelsGeoJSON.features.length) return

    if (!map.getSource('district-labels')) {
      map.addSource('district-labels', { type: 'geojson', data: labelsGeoJSON })
      map.addLayer({ id: 'district-labels-text', type: 'symbol', source: 'district-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 11, 12, 15, 16],
          'text-anchor': 'center', 'text-max-width': 8, 'symbol-z-order': 'source',
          visibility: 'none',
        },
        paint: { 'text-color': '#1D1D1F', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 2.5, 'text-opacity': 0.90 },
      })
    } else {
      map.getSource('district-labels').setData(labelsGeoJSON)
    }

    if (map.getLayer('district-labels-text'))
      map.setLayoutProperty('district-labels-text', 'visibility', showDistrictNames ? 'visible' : 'none')
  }, [mapReady, districtBoundaries, showDistrictNames])

  // ── Greenery — fetch OSM data when Greenery tab becomes active ────────────
  useEffect(() => {
    if (!mapReady || activeMode !== 'greenery') return
    // Skip if cache is fresh (same query version produced it)
    const state = useAppStore.getState()
    if (state.greeneryGeoJSON && state.greeneryQueryVersion === GREENERY_QUERY_VERSION) return
    // Stale cache (query changed) — clear it before re-fetching
    if (state.greeneryGeoJSON) setGreeneryGeoJSON(null, 0)

    let cancelled = false

    const fetchGreenery = async () => {
      setGreeneryDataLoading(true)
      setGreeneryDataError(null)
      try {
        const post = (query) => fetch('https://overpass-api.de/api/interpreter', {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(query)}`,
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })

        const [greeneryResult, networkResult] = await Promise.allSettled([
          post(GREENERY_FEATURES_QUERY),
          post(NETWORK_QUERY),
        ])
        if (cancelled) return

        if (greeneryResult.status === 'rejected' && networkResult.status === 'rejected') {
          throw new Error('Both Overpass queries failed')
        }

        const greeneryFeatures = greeneryResult.status === 'fulfilled'
          ? greeneryOsmToGeoJSON(greeneryResult.value.elements || []).features
          : []
        const networkFeatures = networkResult.status === 'fulfilled'
          ? networkOsmToGeoJSON(networkResult.value.elements || [])
          : []

        const gj = { type: 'FeatureCollection', features: [...greeneryFeatures, ...networkFeatures] }
        setGreeneryGeoJSON(gj, GREENERY_QUERY_VERSION)

        if (greeneryResult.status === 'rejected')
          setGreeneryDataError('Greenery features unavailable — showing network only.')
        else if (networkResult.status === 'rejected')
          setGreeneryDataError('Network data unavailable — showing greenery only.')
      } catch (err) {
        console.error('Greenery fetch error:', err)
        if (!cancelled) setGreeneryDataError('Failed to load greenery data. Check your connection and reload the page.')
      } finally {
        if (!cancelled) setGreeneryDataLoading(false)
      }
    }

    fetchGreenery()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeMode])

  // ── Greenery — hover tooltips (registered once after map ready) ────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const handleEnter = (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const props = e.features[0].properties
      tooltipRef.current?.remove()
      const name = props._name ? `<strong style="display:block;margin-bottom:3px">${props._name}</strong>` : ''
      tooltipRef.current = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, offset: 12, className: 'venue-tooltip',
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-size:12px;line-height:1.5;color:#1D1D1F">
            ${name}
            <span style="color:#2D6A4F;font-weight:500;display:block">${props._tagLabel || props._tagValue}</span>
            <span style="color:#AEAEB2;font-size:11px">${props._tagKey}=${props._tagValue}</span>
          </div>`)
        .addTo(map)
    }

    const handleLeave = () => {
      map.getCanvas().style.cursor = ''
      tooltipRef.current?.remove()
      tooltipRef.current = null
    }

    for (const layerId of ['greenery-fill', 'greenery-line', 'greenery-point']) {
      map.on('mouseenter', layerId, handleEnter)
      map.on('mouseleave', layerId, handleLeave)
    }

    return () => {
      for (const layerId of ['greenery-fill', 'greenery-line', 'greenery-point']) {
        map.off('mouseenter', layerId, handleEnter)
        map.off('mouseleave', layerId, handleLeave)
      }
    }
  }, [mapReady])

  // ── Greenery — render/update map layers when data or toggles change ────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const GREENERY_LAYERS = ['greenery-fill', 'greenery-outline', 'greenery-line', 'greenery-point']
    const isActive = activeMode === 'greenery'

    // Hide all greenery layers when not in greenery mode or no data yet
    if (!isActive || !greeneryGeoJSON) {
      for (const id of GREENERY_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
      }
      return
    }

    const visibleGeoJSON = computeVisibleGeoJSON(
      greeneryGeoJSON,
      greeneryCategoryToggles,
      greeneryTagToggles,
      greeneryOthersTagToggles,
    )

    if (!map.getSource('greenery-all')) {
      // First time: add source + all four layers
      map.addSource('greenery-all', { type: 'geojson', data: visibleGeoJSON })

      // Fill — polygons only, network category excluded (roads/paths are never areas)
      map.addLayer({
        id:     'greenery-fill',
        type:   'fill',
        source: 'greenery-all',
        filter: ['!=', ['get', '_categoryId'], 'network'],
        paint: {
          'fill-color':   CATEGORY_COLOR_EXPRESSION,
          'fill-opacity':  0.30,
        },
      }, 'venue-circles')

      // Outline — polygon outlines only, network category excluded
      map.addLayer({
        id:     'greenery-outline',
        type:   'line',
        source: 'greenery-all',
        filter: ['all',
          ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
          ['!=', ['get', '_categoryId'], 'network'],
        ],
        paint: {
          'line-color':   CATEGORY_COLOR_EXPRESSION,
          'line-width':    1.2,
          'line-opacity':  0.65,
        },
      }, 'venue-circles')

      // Lines — LineString / MultiLineString (hedges, tree rows, etc.)
      map.addLayer({
        id:     'greenery-line',
        type:   'line',
        source: 'greenery-all',
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   CATEGORY_COLOR_EXPRESSION,
          'line-width':    2,
          'line-opacity':  0.80,
        },
      }, 'venue-circles')

      // Points — only truly independent OSM node elements in the
      // individual_vegetation category (trees, hedges). Nodes that happen
      // to be tagged with area categories (grassland, park, etc.) are
      // excluded here; they are represented by polygon/line layers instead.
      map.addLayer({
        id:      'greenery-point',
        type:    'circle',
        source:  'greenery-all',
        minzoom:  14,
        filter: ['all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', '_osmType'], 'node'],
          ['==', ['get', '_categoryId'], 'individual_vegetation'],
        ],
        paint: {
          'circle-radius':         4,
          'circle-color':          CATEGORY_COLOR_EXPRESSION,
          'circle-opacity':        0.85,
          'circle-stroke-width':   1,
          'circle-stroke-color':   '#FFFFFF',
          'circle-stroke-opacity': 0.7,
        },
      }, 'venue-circles')

    } else {
      // Source already exists — update data and ensure layers are visible
      map.getSource('greenery-all').setData(visibleGeoJSON)
      for (const id of GREENERY_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
      }
    }
  }, [mapReady, activeMode, greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles])

  // ── Greenery — dashed district border overlay ─────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const vis = (activeMode === 'greenery' && showGreeneryDistrictBorders) ? 'visible' : 'none'

    const features = Object.entries(districtBoundaries).flatMap(([name, gj]) =>
      (gj?.features || []).map(f => ({
        ...f,
        properties: { ...(f.properties || {}), _districtName: name },
      }))
    )

    if (!map.getSource('greenery-district-borders')) {
      if (!features.length) return
      map.addSource('greenery-district-borders', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      })
      map.addLayer({
        id:     'greenery-district-borders-line',
        type:   'line',
        source: 'greenery-district-borders',
        layout: { visibility: vis },
        paint: {
          'line-color':     '#1D1D1F',
          'line-width':      1.5,
          'line-opacity':    0.50,
          'line-dasharray': [5, 4],
        },
      }, 'venue-circles')
    } else {
      map.getSource('greenery-district-borders').setData({ type: 'FeatureCollection', features })
      if (map.getLayer('greenery-district-borders-line'))
        map.setLayoutProperty('greenery-district-borders-line', 'visibility', vis)
    }
  }, [mapReady, districtBoundaries, activeMode, showGreeneryDistrictBorders])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
