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
import { scoreToGSAColor } from '../utils/greenSocialAnalysis'
import { generateCircleGeoJSON } from '../utils/intermodalAlgorithm'
import { nodesGeoJSON, edgesGeoJSON, gapsGeoJSON } from '../utils/radAlgorithm'
import { makePieSVG } from './IntermodalSidebar'

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

const MAP_PIXEL_RATIO = 3  // 3× resolution for export quality

// ── Component ──────────────────────────────────────────────────────────────

export default function MapView({ onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const activeMobilityModesRef = useRef(new Set())
  const activeModeRef          = useRef('mobility')
  const positronLayerIdsRef    = useRef([])

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
    autoShowRegional, autoShowRoutes, autoShowHeatmap, autoShowParking,
    autoParkingGeoJSON, setAutoParkingGeoJSON,
    // Transit
    transitShowRegional, transitShowRoutes, transitShowHeatmap, transitShowBusStops,
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
    showAllBorders, showDistrictNames, showGrid, mapResetViewTrigger,
    // Green Social Analysis
    greenSocialActiveAnalysis, greenSocialScores, showGreenSocialMap,
    socialAmenitiesGeoJSON,    showSocialAmenities,
    // Intermodal Hub
    intermodalHubs, intermodalRawBusStops, intermodalRawCarParkings, intermodalRawBikeParkings,
    intermodalRawOsmFacilities,
    intermodalShowBusStops, intermodalShowCarParkings, intermodalShowBikeParkings,
    intermodalHubTypes, intermodalStatusFilter,
    intermodalShowFacilitiesRadius, intermodalShowGreeneryRadius,
    intermodalShowFacilitiesPoints, intermodalShowParksOverlay,
    intermodalShowFacilities, intermodalFacilityCategories, intermodalShowParksBase,
    intermodalObjectScale, intermodalRawForests,
    setIntermodalSelectedHub,
    // Rad Network
    radNodes, radEdges, radGaps,
    radShowBusStops, radShowCarParkings, radShowBikeParkings,
    radShowFacilities, radShowHistoric, radShowParks,
    radHubTypes, radHubObjectScale,
    radShowAutoRoads, radShowPedestrianRoads, radShowCycling,
    radShowAutoHeatmap, radShowPedHeatmap,
    radStatusFilter, radShowGaps,
    setRadSelectedNode, setRadSelectedEdge,
    radRawHistoric,
    // Local GeoJSON library
    localBusStops, localCarParkings, localBikeParkings, localFacilities, localHistoric, localParksForests, localCycling,
    // Hub L/M
    hubLMResults,
    hubLMShowL, hubLMShowM,
    hubLMShowCoverageL, hubLMShowCoverageM,
    hubLMShowCandidatesL, hubLMShowCandidatesM,
    // Export trigger
    exportPNGTrigger,
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
      preserveDrawingBuffer: true,
      pixelRatio: MAP_PIXEL_RATIO,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

    map.on('load', () => {
      // Capture positron built-in layer IDs before adding any custom layers
      positronLayerIdsRef.current = map.getStyle().layers.map(l => l.id)

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

      // Grid layer (data + visibility updated by showGrid effect)
      map.addSource('grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#707070', 'line-width': 1.0, 'line-opacity': 0.65, 'line-dasharray': [4, 4] },
      })

      // Satellite raster for Earth mode — inserted after background so it covers the white fill
      // but positron roads/labels render on top (hybrid view)
      map.addSource('satellite', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      })
      const styleLayers = map.getStyle().layers
      const firstNonBg = styleLayers.length > 1 ? styleLayers[1].id : undefined
      map.addLayer({
        id: 'satellite-raster',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 1.0, 'raster-brightness-max': 0.62 },
      }, firstNonBg)

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

    const facilityMode = activeMode === 'facilities'
    const lineColor = autoShowHeatmap
      ? ['match', ['get', 'highway'],
          'motorway',       facilityMode ? '#0D47A1' : '#FF0000',
          'trunk',          facilityMode ? '#1565C0' : '#FF2000',
          'motorway_link',  facilityMode ? '#1565C0' : '#FF2000',
          'trunk_link',     facilityMode ? '#1565C0' : '#FF2000',
          'primary',        facilityMode ? '#1976D2' : '#FF4400',
          'primary_link',   facilityMode ? '#1976D2' : '#FF4400',
          'secondary',      facilityMode ? '#1E88E5' : '#FF6600',
          'secondary_link', facilityMode ? '#1E88E5' : '#FF6600',
          'tertiary',       facilityMode ? '#42A5F5' : '#FF8800',
          'tertiary_link',  facilityMode ? '#64B5F6' : '#FFAA00',
          'unclassified',   facilityMode ? '#90CAF9' : '#FFCC00',
          'residential',    facilityMode ? '#BBDEFB' : '#FFDD66',
          'living_street',  facilityMode ? '#E3F2FD' : '#FFEE88',
          facilityMode ? '#B0BEC5' : '#AAAAAA']
      : facilityMode ? '#7BB3D9' : '#B8C0CC'

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
        layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': active && autoShowRoutes ? 'visible' : 'none' },
        paint: { 'line-color': lineColor, 'line-width': lineWidth, 'line-opacity': lineOpacity },
      }, getBeforeLayer())
    } else {
      map.getSource('auto-overlay').setData(sourceData)
      if (map.getLayer('auto-overlay')) {
        map.setPaintProperty('auto-overlay', 'line-color',   lineColor)
        map.setPaintProperty('auto-overlay', 'line-width',   lineWidth)
        map.setPaintProperty('auto-overlay', 'line-opacity', lineOpacity)
        map.setLayoutProperty('auto-overlay', 'visibility', active && autoShowRoutes ? 'visible' : 'none')
        try { map.moveLayer('auto-overlay', getBeforeLayer()) } catch (_) {}
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, autoShowRoutes, autoShowHeatmap, selectedDay, selectedTime, activeMode])

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

    const fMode = activeMode === 'facilities'
    const tColor = transitShowHeatmap
      ? (fMode ? '#0288D1' : '#FF6600')
      : (fMode ? '#1565C0' : '#E63946')

    if (!map.getSource('transport-overlay')) {
      map.addSource('transport-overlay', { type: 'geojson', data: geoJSON })
      map.addLayer({ id: 'transport-overlay', type: 'line', source: 'transport-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': active && transitShowRoutes ? 'visible' : 'none' },
        paint: { 'line-color': tColor, 'line-width': 1.8, 'line-opacity': opacity },
      }, 'venue-circles')
    } else {
      map.getSource('transport-overlay').setData(geoJSON)
      if (map.getLayer('transport-overlay')) {
        map.setPaintProperty('transport-overlay', 'line-color',   tColor)
        map.setPaintProperty('transport-overlay', 'line-width',   transitShowHeatmap ? 2.5 : 1.8)
        map.setPaintProperty('transport-overlay', 'line-opacity', opacity)
        map.setLayoutProperty('transport-overlay', 'visibility',  active && transitShowRoutes ? 'visible' : 'none')
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, transitShowRoutes, transitShowHeatmap, selectedDay, selectedTime, activeMode])

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

    const cColor = activeMode === 'facilities' ? '#29B6F6' : '#FF1744'

    if (!map.getSource('cycling-overlay')) {
      map.addSource('cycling-overlay', { type: 'geojson', data: geoJSON })
      map.addLayer({ id: 'cycling-overlay', type: 'line', source: 'cycling-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': cColor, 'line-width': 4.0, 'line-opacity': 0.88 },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-overlay').setData(geoJSON)
      if (map.getLayer('cycling-overlay')) {
        map.setPaintProperty('cycling-overlay', 'line-color', cColor)
        map.setLayoutProperty('cycling-overlay', 'visibility', active ? 'visible' : 'none')
      }
    }
  }, [mapReady, mobilityOverlayPerMode, activeMobilityModes, cyclingShowRoutes, activeMode])

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

    const hlColor = activeMode === 'facilities' ? '#0288D1' : '#FF6900'

    if (!map.getSource('mobility-highlight')) {
      map.addSource('mobility-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({ id: 'mobility-highlight', type: 'line', source: 'mobility-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': hlColor, 'line-width': 4.5, 'line-opacity': 0.90 },
      })
    } else {
      map.getSource('mobility-highlight').setData(hlGeoJSON)
      if (map.getLayer('mobility-highlight'))
        map.setPaintProperty('mobility-highlight', 'line-color', hlColor)
      map.setLayoutProperty('mobility-highlight', 'visibility', 'visible')
    }
  }, [mapReady, mobilityHighlightRoute, mobilityOverlayPerMode, activeMode])

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

    const cpColor = activeMode === 'facilities' ? '#0097A7' : '#00C853'

    if (!map.getSource('cycling-parking')) {
      map.addSource('cycling-parking', { type: 'geojson', data: cyclingParkingGeoJSON })
      map.addLayer({ id: 'cycling-parking-circles', type: 'circle', source: 'cycling-parking',
        layout: { visibility: vis },
        paint: { 'circle-radius': 5, 'circle-color': cpColor, 'circle-opacity': 0.88, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.9 },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-parking').setData(cyclingParkingGeoJSON)
      if (map.getLayer('cycling-parking-circles')) {
        map.setPaintProperty('cycling-parking-circles', 'circle-color', cpColor)
        map.setLayoutProperty('cycling-parking-circles', 'visibility', vis)
      }
    }
  }, [mapReady, cyclingParkingGeoJSON, cyclingShowBikeParking, activeMobilityModes, activeMode])

  // ── Cycling leisure routes: render / update ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !cyclingRoutesGeoJSON) return
    const map = mapRef.current
    const vis = (activeMobilityModes.has('cycling') && cyclingShowLeisureRoutes) ? 'visible' : 'none'

    const lrColor = activeMode === 'facilities' ? '#0277BD' : '#FF6900'

    if (!map.getSource('cycling-routes')) {
      map.addSource('cycling-routes', { type: 'geojson', data: cyclingRoutesGeoJSON })
      map.addLayer({ id: 'cycling-routes-line', type: 'line', source: 'cycling-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
        paint: { 'line-color': lrColor, 'line-width': 3.5, 'line-opacity': 0.80, 'line-dasharray': [4, 3] },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-routes').setData(cyclingRoutesGeoJSON)
      if (map.getLayer('cycling-routes-line')) {
        map.setPaintProperty('cycling-routes-line', 'line-color', lrColor)
        map.setLayoutProperty('cycling-routes-line', 'visibility', vis)
      }
    }
  }, [mapReady, cyclingRoutesGeoJSON, cyclingShowLeisureRoutes, activeMobilityModes, activeMode])

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

    const crhlColor = activeMode === 'facilities' ? '#01579B' : '#FF6900'

    if (!map.getSource('cycling-route-highlight')) {
      map.addSource('cycling-route-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({ id: 'cycling-route-highlight', type: 'line', source: 'cycling-route-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': crhlColor, 'line-width': 7, 'line-opacity': 0.92 },
      })
    } else {
      map.getSource('cycling-route-highlight').setData(hlGeoJSON)
      if (map.getLayer('cycling-route-highlight'))
        map.setPaintProperty('cycling-route-highlight', 'line-color', crhlColor)
      map.setLayoutProperty('cycling-route-highlight', 'visibility', 'visible')
    }
  }, [mapReady, cyclingHighlightLeisureRoute, cyclingRoutesGeoJSON, activeMode])

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

      if (hasMobilityScores && showRegional && activeMode === 'mobility') {
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
        paint: { 'line-color': '#4A4A52', 'line-width': 1.5, 'line-opacity': 0.75 },
      })
    } else {
      map.getSource('all-borders').setData(allGeoJSON)
    }

    if (map.getLayer('all-borders-line') && activeMode !== 'earth')
      map.setLayoutProperty('all-borders-line', 'visibility', showAllBorders ? 'visible' : 'none')
  }, [mapReady, districtBoundaries, showAllBorders, activeMode])

  // ── Grid overlay (1 km dashed lines, zoom-adaptive spacing) ─────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const generateGrid = (spacingKm) => {
      const latStep = spacingKm / 111.32
      const lngStep = spacingKm / (111.32 * Math.cos(52.42 * Math.PI / 180))
      const minLat = 52.28, maxLat = 52.62, minLng = 10.53, maxLng = 11.00
      const features = []
      for (let lat = Math.ceil(minLat / latStep) * latStep; lat <= maxLat + 1e-9; lat += latStep)
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[minLng, lat], [maxLng, lat]] }, properties: {} })
      for (let lng = Math.ceil(minLng / lngStep) * lngStep; lng <= maxLng + 1e-9; lng += lngStep)
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, minLat], [lng, maxLat]] }, properties: {} })
      return { type: 'FeatureCollection', features }
    }

    const updateGrid = () => {
      if (!map.getSource('grid')) return
      const z = map.getZoom()
      const spacing = z < 11 ? 2 : z < 12 ? 1 : z < 13 ? 0.5 : 0.25
      map.getSource('grid').setData(generateGrid(spacing))
      if (map.getLayer('grid-line'))
        map.setLayoutProperty('grid-line', 'visibility', showGrid ? 'visible' : 'none')
    }

    updateGrid()
    map.on('zoom', updateGrid)
    return () => map.off('zoom', updateGrid)
  }, [mapReady, showGrid])

  // ── Map view reset (fly back to Wolfsburg home) ────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapResetViewTrigger === 0) return
    mapRef.current.flyTo({ center: WOLFSBURG.center, zoom: WOLFSBURG.zoom })
  }, [mapReady, mapResetViewTrigger])

  // ── Satellite layer + Earth mode: hide positron, show sat, bright borders ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isEarth = activeMode === 'earth'

    // Toggle satellite raster
    if (map.getLayer('satellite-raster'))
      map.setLayoutProperty('satellite-raster', 'visibility', isEarth ? 'visible' : 'none')

    // Hide/restore all positron built-in layers
    for (const id of positronLayerIdsRef.current) {
      if (map.getLayer(id))
        map.setLayoutProperty(id, 'visibility', isEarth ? 'none' : 'visible')
    }

    // District borders: force visible + bright white in Earth mode
    if (map.getLayer('all-borders-line')) {
      if (isEarth) {
        map.setLayoutProperty('all-borders-line', 'visibility', 'visible')
        map.setPaintProperty('all-borders-line', 'line-color', 'rgba(255,255,255,0.90)')
        map.setPaintProperty('all-borders-line', 'line-width', 2.0)
        map.setPaintProperty('all-borders-line', 'line-opacity', 1.0)
      } else {
        map.setPaintProperty('all-borders-line', 'line-color', '#4A4A52')
        map.setPaintProperty('all-borders-line', 'line-width', 1.5)
        map.setPaintProperty('all-borders-line', 'line-opacity', 0.75)
        map.setLayoutProperty('all-borders-line', 'visibility', showAllBorders ? 'visible' : 'none')
      }
    }
  }, [mapReady, activeMode, districtBoundaries, showAllBorders])

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

  // ── Green Social Analysis — district heatmap ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const hasScores = Object.keys(greenSocialScores).length > 0
    const isActive  = activeMode === 'greenery' && showGreenSocialMap &&
                      greenSocialActiveAnalysis && hasScores

    if (!isActive) {
      if (map.getLayer('gsa-district-fill')) map.setLayoutProperty('gsa-district-fill', 'visibility', 'none')
      if (map.getLayer('gsa-district-line')) map.setLayoutProperty('gsa-district-line', 'visibility', 'none')
      return
    }

    const features = Object.entries(districtBoundaries).flatMap(([name, gj]) =>
      (gj?.features || []).map(f => ({
        ...f,
        properties: {
          ...(f.properties || {}),
          _districtName: name,
          _fillColor:    scoreToGSAColor(greenSocialScores[name] ?? 0, greenSocialActiveAnalysis),
          _score:        greenSocialScores[name] ?? 0,
        },
      }))
    )
    const data = { type: 'FeatureCollection', features }

    if (!map.getSource('gsa-districts')) {
      map.addSource('gsa-districts', { type: 'geojson', data })
      map.addLayer({
        id:     'gsa-district-fill',
        type:   'fill',
        source: 'gsa-districts',
        paint: {
          'fill-color':   ['get', '_fillColor'],
          'fill-opacity':  0.55,
        },
      }, 'venue-circles')
      map.addLayer({
        id:     'gsa-district-line',
        type:   'line',
        source: 'gsa-districts',
        paint: {
          'line-color':   ['get', '_fillColor'],
          'line-width':    1.5,
          'line-opacity':  0.80,
        },
      }, 'venue-circles')

      // Hover tooltip (cursor label only)
      map.on('mouseenter', 'gsa-district-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const props = e.features[0].properties
        tooltipRef.current?.remove()
        tooltipRef.current = new maplibregl.Popup({
          closeButton: false, closeOnClick: false, offset: 8, className: 'venue-tooltip',
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:12px;line-height:1.4;color:#1D1D1F">
              <strong style="display:block;margin-bottom:3px">${props._districtName}</strong>
              <span style="color:#6E6E73">Score: ${Number(props._score).toFixed(1)} / 10</span>
            </div>`)
          .addTo(map)
      })
      map.on('mouseleave', 'gsa-district-fill', () => {
        map.getCanvas().style.cursor = ''
        tooltipRef.current?.remove()
        tooltipRef.current = null
      })

      // Click → open bottom stats popup
      map.on('click', 'gsa-district-fill', (e) => {
        const props = e.features[0].properties
        const scores = useAppStore.getState().greenSocialScores
        const sorted = Object.entries(scores).sort(([,a],[,b]) => b - a)
        const rank   = sorted.findIndex(([n]) => n === props._districtName) + 1
        useAppStore.getState().setHoveredGSADistrict({
          name:  props._districtName,
          score: Number(props._score),
          rank,
          total: sorted.length,
        })
      })

      // Click on empty map area → dismiss stats popup
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['gsa-district-fill'] })
        if (!hits.length) useAppStore.getState().setHoveredGSADistrict(null)
      })
    } else {
      map.getSource('gsa-districts').setData(data)
      map.setLayoutProperty('gsa-district-fill', 'visibility', 'visible')
      map.setLayoutProperty('gsa-district-line', 'visibility', 'visible')
    }
  }, [mapReady, activeMode, greenSocialActiveAnalysis, greenSocialScores, showGreenSocialMap, districtBoundaries])

  // ── Green Social Analysis — social amenity POI points ────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const vis = (activeMode === 'greenery' && showSocialAmenities && socialAmenitiesGeoJSON)
      ? 'visible' : 'none'

    if (!socialAmenitiesGeoJSON) return

    if (!map.getSource('gsa-social-pois')) {
      map.addSource('gsa-social-pois', { type: 'geojson', data: socialAmenitiesGeoJSON })
      map.addLayer({
        id:     'gsa-social-pois-circles',
        type:   'circle',
        source: 'gsa-social-pois',
        layout: { visibility: vis },
        paint: {
          'circle-radius': ['match', ['get', '_category'],
            'active',  6,
            'social',  5,
            'passive', 4,
            'comfort', 3,
            4,
          ],
          'circle-color':          ['get', '_color'],
          'circle-opacity':        0.85,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   '#FFFFFF',
          'circle-stroke-opacity': 0.9,
        },
      }, 'venue-circles')

      map.on('mouseenter', 'gsa-social-pois-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const props = e.features[0].properties
        tooltipRef.current?.remove()
        tooltipRef.current = new maplibregl.Popup({
          closeButton: false, closeOnClick: false, offset: 10, className: 'venue-tooltip',
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:12px;line-height:1.5;color:#1D1D1F">
              ${props.name ? `<strong style="display:block;margin-bottom:2px">${props.name}</strong>` : ''}
              <span style="display:block;font-weight:500">${props._icon || ''} ${props._label}</span>
              <span style="color:#AEAEB2;font-size:11px">social weight: ${props._weight}</span>
            </div>`)
          .addTo(map)
      })
      map.on('mouseleave', 'gsa-social-pois-circles', () => {
        map.getCanvas().style.cursor = ''
        tooltipRef.current?.remove()
        tooltipRef.current = null
      })
    } else {
      map.getSource('gsa-social-pois').setData(socialAmenitiesGeoJSON)
      if (map.getLayer('gsa-social-pois-circles'))
        map.setLayoutProperty('gsa-social-pois-circles', 'visibility', vis)
    }
  }, [mapReady, socialAmenitiesGeoJSON, showSocialAmenities, activeMode])

  // ── Intermodal Hub — custom pie-chart markers ─────────────────────────────
  const intermodalMarkersRef = useRef([])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    // Remove old markers
    intermodalMarkersRef.current.forEach(m => m.remove())
    intermodalMarkersRef.current = []

    if (activeMode !== 'intermodal' || !intermodalHubs.length) return

    const visibleHubs = intermodalHubs.filter(hub => {
      if (!intermodalHubTypes.has(hub.hubType)) return false
      if (intermodalStatusFilter === 'existing' && hub.status !== 'existing') return false
      if (intermodalStatusFilter === 'proposed' && hub.status !== 'proposed') return false
      return true
    })

    const markers = visibleHubs.map(hub => {
      const baseSize = hub.priority === 'priority' ? 40 : 30
      const size = Math.round(baseSize * (intermodalObjectScale ?? 1))
      const el = document.createElement('div')
      el.innerHTML = makePieSVG(hub.hubType, hub.priority, size)
      el.style.cssText = `cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.25));width:${size}px;height:${size}px`
      el.title = `${hub.hubType.replace(/_/g,' ')} · score ${hub.score}`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setIntermodalSelectedHub(hub)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([hub.lng, hub.lat])
        .addTo(map)
      return marker
    })

    intermodalMarkersRef.current = markers
    return () => {
      markers.forEach(m => m.remove())
      intermodalMarkersRef.current = []
    }
  }, [mapReady, activeMode, intermodalHubs, intermodalHubTypes, intermodalStatusFilter, intermodalObjectScale, setIntermodalSelectedHub])

  // ── Intermodal — base point layers (bus stops, car parkings, bike parkings) ─
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isActive = activeMode === 'intermodal'

    // Bus stops
    if (intermodalRawBusStops) {
      if (!map.getSource('imd-bus-stops')) {
        map.addSource('imd-bus-stops', { type: 'geojson', data: intermodalRawBusStops })
        map.addLayer({ id: 'imd-bus-stops-circle', type: 'circle', source: 'imd-bus-stops',
          layout: { visibility: 'none' },
          paint: { 'circle-radius': 5, 'circle-color': '#EF4444', 'circle-opacity': 0.85,
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
        })
      } else {
        map.getSource('imd-bus-stops').setData(intermodalRawBusStops)
      }
      if (map.getLayer('imd-bus-stops-circle'))
        map.setLayoutProperty('imd-bus-stops-circle', 'visibility', isActive && intermodalShowBusStops ? 'visible' : 'none')
    }

    // Car parkings
    if (intermodalRawCarParkings) {
      if (!map.getSource('imd-car-parkings')) {
        map.addSource('imd-car-parkings', { type: 'geojson', data: intermodalRawCarParkings })
        map.addLayer({ id: 'imd-car-parkings-circle', type: 'circle', source: 'imd-car-parkings',
          layout: { visibility: 'none' },
          paint: { 'circle-radius': 5, 'circle-color': '#6B7280', 'circle-opacity': 0.85,
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
        })
      } else {
        map.getSource('imd-car-parkings').setData(intermodalRawCarParkings)
      }
      if (map.getLayer('imd-car-parkings-circle'))
        map.setLayoutProperty('imd-car-parkings-circle', 'visibility', isActive && intermodalShowCarParkings ? 'visible' : 'none')
    }

    // Bike parkings
    if (intermodalRawBikeParkings) {
      if (!map.getSource('imd-bike-parkings')) {
        map.addSource('imd-bike-parkings', { type: 'geojson', data: intermodalRawBikeParkings })
        map.addLayer({ id: 'imd-bike-parkings-circle', type: 'circle', source: 'imd-bike-parkings',
          layout: { visibility: 'none' },
          paint: { 'circle-radius': 4, 'circle-color': '#22C55E', 'circle-opacity': 0.85,
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
        })
      } else {
        map.getSource('imd-bike-parkings').setData(intermodalRawBikeParkings)
      }
      if (map.getLayer('imd-bike-parkings-circle'))
        map.setLayoutProperty('imd-bike-parkings-circle', 'visibility', isActive && intermodalShowBikeParkings ? 'visible' : 'none')
    }

    // OSM facility points (when facilities radius is on)
    if (intermodalRawOsmFacilities) {
      const osmGJ = {
        type: 'FeatureCollection',
        features: intermodalRawOsmFacilities.map(f => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          properties: { name: f.name },
        })),
      }
      if (!map.getSource('imd-osm-facilities')) {
        map.addSource('imd-osm-facilities', { type: 'geojson', data: osmGJ })
        map.addLayer({ id: 'imd-osm-facilities-circle', type: 'circle', source: 'imd-osm-facilities',
          layout: { visibility: 'none' },
          paint: { 'circle-radius': 4, 'circle-color': '#F59E0B', 'circle-opacity': 0.80,
            'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
        })
      } else {
        map.getSource('imd-osm-facilities').setData(osmGJ)
      }
      if (map.getLayer('imd-osm-facilities-circle'))
        map.setLayoutProperty('imd-osm-facilities-circle', 'visibility',
          isActive && intermodalShowFacilitiesRadius && intermodalShowFacilitiesPoints ? 'visible' : 'none')
    }
  }, [mapReady, activeMode,
    intermodalRawBusStops, intermodalShowBusStops,
    intermodalRawCarParkings, intermodalShowCarParkings,
    intermodalRawBikeParkings, intermodalShowBikeParkings,
    intermodalRawOsmFacilities, intermodalShowFacilitiesRadius, intermodalShowFacilitiesPoints])

  // ── Intermodal — radius circle layers ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isActive = activeMode === 'intermodal' && intermodalHubs.length > 0

    // Facilities radius (1500 m) circles
    const facGJ = isActive ? generateCircleGeoJSON(intermodalHubs, 1500) : { type: 'FeatureCollection', features: [] }
    if (!map.getSource('imd-facilities-radius')) {
      map.addSource('imd-facilities-radius', { type: 'geojson', data: facGJ })
      map.addLayer({ id: 'imd-facilities-radius-fill', type: 'fill', source: 'imd-facilities-radius',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.06 },
      }, 'venue-circles')
      map.addLayer({ id: 'imd-facilities-radius-line', type: 'line', source: 'imd-facilities-radius',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#F59E0B', 'line-width': 1, 'line-opacity': 0.45, 'line-dasharray': [4, 3] },
      }, 'venue-circles')
    } else {
      map.getSource('imd-facilities-radius').setData(facGJ)
    }
    const facVis = isActive && intermodalShowFacilitiesRadius ? 'visible' : 'none'
    if (map.getLayer('imd-facilities-radius-fill')) map.setLayoutProperty('imd-facilities-radius-fill', 'visibility', facVis)
    if (map.getLayer('imd-facilities-radius-line')) map.setLayoutProperty('imd-facilities-radius-line', 'visibility', facVis)

    // Greenery radius (500 m) circles
    const greenGJ = isActive ? generateCircleGeoJSON(intermodalHubs, 500) : { type: 'FeatureCollection', features: [] }
    if (!map.getSource('imd-greenery-radius')) {
      map.addSource('imd-greenery-radius', { type: 'geojson', data: greenGJ })
      map.addLayer({ id: 'imd-greenery-radius-fill', type: 'fill', source: 'imd-greenery-radius',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#22C55E', 'fill-opacity': 0.08 },
      }, 'venue-circles')
      map.addLayer({ id: 'imd-greenery-radius-line', type: 'line', source: 'imd-greenery-radius',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#22C55E', 'line-width': 1, 'line-opacity': 0.50, 'line-dasharray': [3, 3] },
      }, 'venue-circles')
    } else {
      map.getSource('imd-greenery-radius').setData(greenGJ)
    }
    const greenVis = isActive && intermodalShowGreeneryRadius ? 'visible' : 'none'
    if (map.getLayer('imd-greenery-radius-fill')) map.setLayoutProperty('imd-greenery-radius-fill', 'visibility', greenVis)
    if (map.getLayer('imd-greenery-radius-line')) map.setLayoutProperty('imd-greenery-radius-line', 'visibility', greenVis)

    // Parks overlay (reuse parks data)
  }, [mapReady, activeMode, intermodalHubs, intermodalShowFacilitiesRadius, intermodalShowGreeneryRadius])

  // ── Intermodal — parks overlay (parks + forests, Radius Layers section) ──────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !parks) return
    const map = mapRef.current
    const vis = activeMode === 'intermodal' && intermodalShowGreeneryRadius && intermodalShowParksOverlay ? 'visible' : 'none'
    const combinedGJ = {
      type: 'FeatureCollection',
      features: [...(parks.features || []), ...(intermodalRawForests?.features || [])],
    }
    if (!map.getSource('imd-parks')) {
      map.addSource('imd-parks', { type: 'geojson', data: combinedGJ })
      map.addLayer({ id: 'imd-parks-fill', type: 'fill', source: 'imd-parks',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#22C55E', 'fill-opacity': 0.18 },
      }, 'venue-circles')
      map.addLayer({ id: 'imd-parks-line', type: 'line', source: 'imd-parks',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#16A34A', 'line-width': 1, 'line-opacity': 0.60 },
      }, 'venue-circles')
    } else {
      map.getSource('imd-parks').setData(combinedGJ)
    }
    if (map.getLayer('imd-parks-fill')) map.setLayoutProperty('imd-parks-fill', 'visibility', vis)
    if (map.getLayer('imd-parks-line')) map.setLayoutProperty('imd-parks-line', 'visibility', vis)
  }, [mapReady, activeMode, parks, intermodalShowGreeneryRadius, intermodalShowParksOverlay, intermodalRawForests])

  // ── Intermodal — parks base layer (parks + forests, Data Layers section) ────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !parks) return
    const map = mapRef.current
    const vis = activeMode === 'intermodal' && intermodalShowParksBase ? 'visible' : 'none'
    const combinedGJ = {
      type: 'FeatureCollection',
      features: [...(parks.features || []), ...(intermodalRawForests?.features || [])],
    }
    if (!map.getSource('imd-parks-base')) {
      map.addSource('imd-parks-base', { type: 'geojson', data: combinedGJ })
      map.addLayer({ id: 'imd-parks-base-fill', type: 'fill', source: 'imd-parks-base',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#22C55E', 'fill-opacity': 0.22 },
      }, 'venue-circles')
      map.addLayer({ id: 'imd-parks-base-line', type: 'line', source: 'imd-parks-base',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#16A34A', 'line-width': 1, 'line-opacity': 0.65 },
      }, 'venue-circles')
    } else {
      map.getSource('imd-parks-base').setData(combinedGJ)
    }
    if (map.getLayer('imd-parks-base-fill')) map.setLayoutProperty('imd-parks-base-fill', 'visibility', vis)
    if (map.getLayer('imd-parks-base-line')) map.setLayoutProperty('imd-parks-base-line', 'visibility', vis)
  }, [mapReady, activeMode, parks, intermodalShowParksBase, intermodalRawForests])

  // ── Intermodal — facilities base layer (category-colored points) ───────────
  const CAT_MAP = { Culture: 'culture', Commercial: 'commercial', Schools: 'educational', Leisure: 'leisure', Healthcare: 'healthcare' }
  const CAT_COLOR = { culture: '#534AB7', commercial: '#BA7517', educational: '#185FA5', leisure: '#1D9E75', healthcare: '#D62828', other: '#6B7280' }

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isActive = activeMode === 'intermodal' && intermodalShowFacilities

    const allFeatures = []
    if (isActive) {
      for (const v of filteredVenues) {
        const cat = CAT_MAP[v.category] || 'other'
        if (!cat || !intermodalFacilityCategories.has(cat)) continue
        allFeatures.push({ type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
          properties: { _cat: cat, _color: CAT_COLOR[cat] || '#AEAEB2', name: v.name },
        })
      }
      const osmFacs = useAppStore.getState().intermodalRawOsmFacilities || []
      for (const f of osmFacs) {
        const cat = f._category || f.category?.toLowerCase() || null
        if (!cat || !intermodalFacilityCategories.has(cat)) continue
        allFeatures.push({ type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          properties: { _cat: cat, _color: CAT_COLOR[cat] || '#AEAEB2', name: f.name },
        })
      }
    }
    const gj = { type: 'FeatureCollection', features: allFeatures }

    if (!map.getSource('imd-facilities-base')) {
      map.addSource('imd-facilities-base', { type: 'geojson', data: gj })
      map.addLayer({ id: 'imd-facilities-base-circle', type: 'circle', source: 'imd-facilities-base',
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 5, 'circle-color': ['get', '_color'],
          'circle-opacity': 0.85, 'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.9 },
      }, 'venue-circles')
    } else {
      map.getSource('imd-facilities-base').setData(gj)
    }
    if (map.getLayer('imd-facilities-base-circle'))
      map.setLayoutProperty('imd-facilities-base-circle', 'visibility', isActive ? 'visible' : 'none')
  }, [mapReady, activeMode, intermodalShowFacilities, intermodalFacilityCategories, filteredVenues])

  // ── Intermodal — object scale: update circle layer radii ──────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const s = intermodalObjectScale ?? 1
    const layers = [
      { id: 'imd-bus-stops-circle',     base: 5 },
      { id: 'imd-car-parkings-circle',  base: 5 },
      { id: 'imd-bike-parkings-circle', base: 4 },
      { id: 'imd-osm-facilities-circle', base: 4 },
    ]
    for (const { id, base } of layers) {
      if (map.getLayer(id))
        map.setPaintProperty(id, 'circle-radius', Math.round(base * s))
    }
  }, [mapReady, intermodalObjectScale])

  // ── Rad Network — initialize layers on map load ───────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const sources = ['rad-nodes', 'rad-edges', 'rad-edges-dashed', 'rad-gaps']
    const empty = { type: 'FeatureCollection', features: [] }
    for (const id of sources) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty })
    }

    if (!map.getLayer('rad-edges-solid')) {
      map.addLayer({ id: 'rad-edges-solid', type: 'line', source: 'rad-edges',
        filter: ['!', ['get', 'needs_infrastructure']],
        paint: {
          'line-color': ['match', ['get', 'route_type'], 'A', '#064E3B', 'B', '#15803D', 'C', '#4ADE80', '#86EFAC'],
          'line-width': ['match', ['get', 'route_type'], 'A', 4, 'B', 3, 2],
          'line-opacity': 0.85,
        },
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      })
    }
    if (!map.getLayer('rad-edges-dashed')) {
      map.addLayer({ id: 'rad-edges-dashed', type: 'line', source: 'rad-edges',
        filter: ['get', 'needs_infrastructure'],
        paint: {
          'line-color': ['match', ['get', 'route_type'], 'A', '#064E3B', 'B', '#15803D', 'C', '#4ADE80', '#86EFAC'],
          'line-width': ['match', ['get', 'route_type'], 'A', 4, 'B', 3, 2],
          'line-opacity': 0.7, 'line-dasharray': [4, 3],
        },
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      })
    }
    if (!map.getLayer('rad-gaps-line')) {
      map.addLayer({ id: 'rad-gaps-line', type: 'line', source: 'rad-gaps',
        paint: { 'line-color': '#FF453A', 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [4, 3] },
        layout: { visibility: 'none', 'line-cap': 'round' },
      })
    }
    if (!map.getLayer('rad-nodes-circle')) {
      map.addLayer({ id: 'rad-nodes-circle', type: 'circle', source: 'rad-nodes',
        paint: {
          'circle-radius': ['match', ['get', 'node_type'],
            'hub', 10, 'city_center', 12, 'village_center', 9,
            'facility', 7, 'historic', 7, 'bike_parking', 5, 'bus_stop', 5, 6],
          'circle-color': ['match', ['get', 'node_type'],
            'hub', '#1D1D1F', 'city_center', '#0071E3', 'village_center', '#5856D6',
            'facility', '#FF9F0A', 'historic', '#BF5AF2',
            'bike_parking', '#32ADE6', 'bus_stop', '#FF453A', '#6B7280'],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9,
        },
        layout: { visibility: 'none' },
      })
    }
    if (!map.getLayer('rad-historic-circle')) {
      map.addSource('rad-historic', { type: 'geojson', data: empty })
      map.addLayer({ id: 'rad-historic-circle', type: 'circle', source: 'rad-historic',
        paint: { 'circle-radius': 6, 'circle-color': '#BF5AF2', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
        layout: { visibility: 'none' },
      })
    }

    // Click: rad nodes
    map.on('click', 'rad-nodes-circle', e => {
      if (!e.features?.length) return
      const id = e.features[0].properties.id
      const node = useAppStore.getState().radNodes.find(n => n.id === id)
      if (node) { useAppStore.getState().setRadSelectedNode(node); useAppStore.getState().setRadSelectedEdge(null) }
    })
    // Click: rad edges
    for (const layerId of ['rad-edges-solid', 'rad-edges-dashed']) {
      map.on('click', layerId, e => {
        if (!e.features?.length) return
        const edgeId = e.features[0].properties.id
        const edge = useAppStore.getState().radEdges.find(ed => ed.id === edgeId)
        if (edge) { useAppStore.getState().setRadSelectedEdge(edge); useAppStore.getState().setRadSelectedNode(null) }
      })
    }
    map.on('mouseenter', 'rad-nodes-circle', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'rad-nodes-circle', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'rad-edges-solid',  () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'rad-edges-solid',  () => { map.getCanvas().style.cursor = '' })
  }, [mapReady])

  // ── Rad Network — update data and visibility ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isRad = activeMode === 'rad'

    // Filter edges by status
    const state = useAppStore.getState()
    const filter = state.radStatusFilter
    const visEdges = isRad ? (state.radEdges || []).filter(e => {
      if (filter === 'existing') return e.has_cycleway && !e.needs_infrastructure
      if (filter === 'proposed') return e.needs_infrastructure
      return true
    }) : []
    const visGaps = isRad && state.radShowGaps ? (state.radGaps || []) : []
    const visNodes = isRad ? (state.radNodes || []) : []

    if (map.getSource('rad-edges'))   map.getSource('rad-edges').setData(edgesGeoJSON(visEdges))
    if (map.getSource('rad-gaps'))    map.getSource('rad-gaps').setData(gapsGeoJSON(visGaps))
    if (map.getSource('rad-nodes'))   map.getSource('rad-nodes').setData(nodesGeoJSON(visNodes))

    const vis = isRad && visNodes.length > 0 ? 'visible' : 'none'
    const edgeVis = isRad && visEdges.length > 0 ? 'visible' : 'none'
    const gapVis  = isRad && visGaps.length > 0  ? 'visible' : 'none'
    if (map.getLayer('rad-nodes-circle'))  map.setLayoutProperty('rad-nodes-circle',  'visibility', vis)
    if (map.getLayer('rad-edges-solid'))   map.setLayoutProperty('rad-edges-solid',   'visibility', edgeVis)
    if (map.getLayer('rad-edges-dashed'))  map.setLayoutProperty('rad-edges-dashed',  'visibility', edgeVis)
    if (map.getLayer('rad-gaps-line'))     map.setLayoutProperty('rad-gaps-line',      'visibility', gapVis)
  }, [mapReady, activeMode, radNodes, radEdges, radGaps, radStatusFilter, radShowGaps])

  // ── Rad Network — historic overlay ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isActive = activeMode === 'rad' && radShowHistoric
    const features = isActive ? (radRawHistoric || []).map(el => {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      if (!lat || !lng) return null
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { name: el.tags?.name || el.tags?.historic || 'Historic' } }
    }).filter(Boolean) : []
    if (map.getSource('rad-historic')) map.getSource('rad-historic').setData({ type: 'FeatureCollection', features })
    if (map.getLayer('rad-historic-circle'))
      map.setLayoutProperty('rad-historic-circle', 'visibility', isActive ? 'visible' : 'none')
  }, [mapReady, activeMode, radShowHistoric, radRawHistoric])

  // ── Rad Network — local data layers (bus stops, car parkings, bike parkings, facilities, parks) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isRad = activeMode === 'rad'
    const empty = { type: 'FeatureCollection', features: [] }

    const ensureCircleLayer = (id, color, radius = 5) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty })
      if (!map.getLayer(`${id}-circle`)) {
        map.addLayer({ id: `${id}-circle`, type: 'circle', source: id,
          paint: { 'circle-radius': radius, 'circle-color': color, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-opacity': 0.85 },
          layout: { visibility: 'none' },
        })
      }
    }
    const ensurePolygonLayer = (id, fillColor, lineColor) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty })
      if (!map.getLayer(`${id}-fill`)) {
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id,
          paint: { 'fill-color': fillColor, 'fill-opacity': 0.25 },
          layout: { visibility: 'none' },
        })
      }
      if (!map.getLayer(`${id}-line`)) {
        map.addLayer({ id: `${id}-line`, type: 'line', source: id,
          paint: { 'line-color': lineColor, 'line-width': 1, 'line-opacity': 0.5 },
          layout: { visibility: 'none' },
        })
      }
    }

    ensureCircleLayer('rad-l-bus',  '#FF453A', 5)
    ensureCircleLayer('rad-l-car',  '#6B7280', 5)
    ensureCircleLayer('rad-l-bike', '#22C55E', 5)
    ensureCircleLayer('rad-l-fac',  '#FF9F0A', 6)
    ensureCircleLayer('rad-l-hist', '#BF5AF2', 6)
    ensurePolygonLayer('rad-l-parks', '#16A34A', '#15803D')

    // Cycling: line layer
    if (!map.getSource('rad-l-cycling')) map.addSource('rad-l-cycling', { type: 'geojson', data: empty })
    if (!map.getLayer('rad-l-cycling-line')) {
      map.addLayer({ id: 'rad-l-cycling-line', type: 'line', source: 'rad-l-cycling',
        paint: { 'line-color': '#10B981', 'line-width': 1.5, 'line-opacity': 0.75 },
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    const setData = (srcId, gj) => { if (map.getSource(srcId)) map.getSource(srcId).setData(gj || empty) }
    setData('rad-l-bus',     localBusStops)
    setData('rad-l-car',     localCarParkings)
    setData('rad-l-bike',    localBikeParkings)
    setData('rad-l-fac',     localFacilities)
    setData('rad-l-hist',    localHistoric)
    setData('rad-l-parks',   localParksForests)
    setData('rad-l-cycling', localCycling)

    const setVis = (layerId, show) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none')
    }
    setVis('rad-l-bus-circle',    isRad && radShowBusStops)
    setVis('rad-l-car-circle',    isRad && radShowCarParkings)
    setVis('rad-l-bike-circle',   isRad && radShowBikeParkings)
    setVis('rad-l-fac-circle',    isRad && radShowFacilities)
    setVis('rad-l-hist-circle',   isRad && radShowHistoric)
    setVis('rad-l-parks-fill',    isRad && radShowParks)
    setVis('rad-l-parks-line',    isRad && radShowParks)
    setVis('rad-l-cycling-line',  isRad && radShowCycling)
  }, [mapReady, activeMode,
      localBusStops, localCarParkings, localBikeParkings, localFacilities, localHistoric, localParksForests, localCycling,
      radShowBusStops, radShowCarParkings, radShowBikeParkings, radShowFacilities, radShowHistoric, radShowParks, radShowCycling])

  // ── Rad Network — road layers (auto roads + pedestrian paths + heatmaps) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const isRad = activeMode === 'rad'
    const empty = { type: 'FeatureCollection', features: [] }

    const setVis = (layerId, show) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none')
    }

    // Auto roads — dedicated source from local wolfsburg_roads.geojson
    if (!map.getSource('rad-auto-roads')) {
      map.addSource('rad-auto-roads', { type: 'geojson', data: roads || empty })
    } else if (roads) {
      map.getSource('rad-auto-roads').setData(roads)
    }
    if (!map.getLayer('rad-auto-roads-line')) {
      map.addLayer({ id: 'rad-auto-roads-line', type: 'line', source: 'rad-auto-roads',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': '#AEAEB2', 'line-width': 1, 'line-opacity': 0.7 },
      })
    }
    if (!map.getLayer('rad-auto-roads-heat')) {
      map.addLayer({ id: 'rad-auto-roads-heat', type: 'line', source: 'rad-auto-roads',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: {
          'line-color': ['match', ['get', 'highway'],
            'motorway', '#EF4444', 'motorway_link', '#EF4444',
            'trunk', '#F97316', 'trunk_link', '#F97316',
            'primary', '#F59E0B', 'primary_link', '#F59E0B',
            'secondary', '#84CC16', 'secondary_link', '#84CC16',
            'tertiary', '#22D3EE', 'tertiary_link', '#22D3EE',
            'residential', '#60A5FA',
            'living_street', '#A78BFA',
            '#9CA3AF',
          ],
          'line-width': ['match', ['get', 'highway'],
            'motorway', 3, 'motorway_link', 2,
            'trunk', 2.5, 'trunk_link', 2,
            'primary', 2, 'primary_link', 1.5,
            'secondary', 1.5, 'tertiary', 1.2,
            1,
          ],
          'line-opacity': 0.85,
        },
      })
    }
    setVis('rad-auto-roads-line', isRad && radShowAutoRoads && !radShowAutoHeatmap)
    setVis('rad-auto-roads-heat', isRad && radShowAutoRoads && radShowAutoHeatmap)

    // Pedestrian paths — dedicated source from local wolfsburg_footways.geojson
    if (!map.getSource('rad-footways')) {
      map.addSource('rad-footways', { type: 'geojson', data: footways || empty })
    } else if (footways) {
      map.getSource('rad-footways').setData(footways)
    }
    if (!map.getLayer('rad-ped-roads-line')) {
      map.addLayer({ id: 'rad-ped-roads-line', type: 'line', source: 'rad-footways',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': '#32ADE6', 'line-width': 1, 'line-opacity': 0.7 },
      })
    }
    if (!map.getLayer('rad-ped-roads-heat')) {
      map.addLayer({ id: 'rad-ped-roads-heat', type: 'line', source: 'rad-footways',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: {
          'line-color': '#F59E0B',
          'line-width': ['match', ['get', 'highway'], 'steps', 1.5, 'path', 1.2, 1],
          'line-opacity': 0.8,
        },
      })
    }
    setVis('rad-ped-roads-line', isRad && radShowPedestrianRoads && !radShowPedHeatmap)
    setVis('rad-ped-roads-heat', isRad && radShowPedestrianRoads && radShowPedHeatmap)
  }, [mapReady, activeMode, roads, footways,
      radShowAutoRoads, radShowPedestrianRoads, radShowAutoHeatmap, radShowPedHeatmap])

  // ── Rad Network — intermodal hub markers ─────────────────────────────────
  const radHubMarkersRef = useRef([])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    radHubMarkersRef.current.forEach(m => m.remove())
    radHubMarkersRef.current = []

    if (activeMode !== 'rad' || !intermodalHubs.length) return

    const scale = radHubObjectScale ?? 1
    const markers = intermodalHubs
      .filter(hub => radHubTypes.has(hub.hubType))
      .map(hub => {
        const size = Math.round((hub.priority === 'priority' ? 36 : 26) * scale)
        const el = document.createElement('div')
        el.innerHTML = makePieSVG(hub.hubType, hub.priority, size)
        el.style.cssText = `cursor:default;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));width:${size}px;height:${size}px`
        el.title = `${hub.hubType.replace(/_/g, ' ')} hub`
        return new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([hub.lng, hub.lat])
          .addTo(map)
      })

    radHubMarkersRef.current = markers
    return () => {
      markers.forEach(m => m.remove())
      radHubMarkersRef.current = []
    }
  }, [mapReady, activeMode, intermodalHubs, radHubTypes, radHubObjectScale])

  // ── Hub L/M — markers ────────────────────────────────────────────────────
  const hubLMMarkersRef = useRef([])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    hubLMMarkersRef.current.forEach(m => m.remove())
    hubLMMarkersRef.current = []

    if (activeMode !== 'hub-network' || !hubLMResults) return

    const markers = []

    if (hubLMShowL && hubLMResults.hubL?.hubs?.length) {
      for (const hub of hubLMResults.hubL.hubs) {
        const el = document.createElement('div')
        el.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="#1D1D1F" stroke="white" stroke-width="2.5"/>
          <text x="16" y="20.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="white">L</text>
        </svg>`
        el.style.cssText = 'cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));width:32px;height:32px'
        el.title = `Hub L — ${hub.name} · ${Math.round(hub.area)} m²`
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([hub.lon, hub.lat])
          .addTo(map)
        markers.push(marker)
      }
    }

    if (hubLMShowM && hubLMResults.hubM?.hubs?.length) {
      for (const hub of hubLMResults.hubM.hubs) {
        const el = document.createElement('div')
        el.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
          <circle cx="13" cy="13" r="11" fill="#1D7A3A" stroke="white" stroke-width="2.5"/>
          <text x="13" y="17" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="white">M</text>
        </svg>`
        el.style.cssText = 'cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));width:26px;height:26px'
        el.title = `Hub M — ${hub.name} · ${Math.round(hub.area)} m²`
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([hub.lon, hub.lat])
          .addTo(map)
        markers.push(marker)
      }
    }

    hubLMMarkersRef.current = markers
    return () => {
      markers.forEach(m => m.remove())
      hubLMMarkersRef.current = []
    }
  }, [mapReady, activeMode, hubLMResults, hubLMShowL, hubLMShowM])

  // ── Hub L/M — coverage circles + candidate points ────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const LAYERS = ['hub-lm-cov-l-fill', 'hub-lm-cov-l-stroke', 'hub-lm-cov-m-fill', 'hub-lm-cov-m-stroke', 'hub-lm-cand-l', 'hub-lm-cand-m']
    const SOURCES = ['hub-lm-cov-l', 'hub-lm-cov-m', 'hub-lm-cand-l', 'hub-lm-cand-m']
    LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
    SOURCES.forEach(id => { if (map.getSource(id)) map.removeSource(id) })

    if (activeMode !== 'hub-network' || !hubLMResults) return

    const makeCircles = (hubs, radiusM) => {
      const features = (hubs || []).map(hub => {
        const steps = 48
        const coords = []
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * 2 * Math.PI
          const dLat = (radiusM / 111320) * Math.sin(angle)
          const dLon = (radiusM / (111320 * Math.cos(hub.lat * Math.PI / 180))) * Math.cos(angle)
          coords.push([hub.lon + dLon, hub.lat + dLat])
        }
        coords.push(coords[0])
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
      })
      return { type: 'FeatureCollection', features }
    }

    const makePoints = (candidates) => ({
      type: 'FeatureCollection',
      features: (candidates || []).map(c => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: c.name },
      }))
    })

    // Hub L coverage circles
    map.addSource('hub-lm-cov-l', { type: 'geojson', data: makeCircles(hubLMResults.hubL?.hubs, 800) })
    map.addLayer({ id: 'hub-lm-cov-l-fill', type: 'fill', source: 'hub-lm-cov-l', layout: { visibility: hubLMShowCoverageL ? 'visible' : 'none' }, paint: { 'fill-color': '#1D1D1F', 'fill-opacity': 0.07 } })
    map.addLayer({ id: 'hub-lm-cov-l-stroke', type: 'line', source: 'hub-lm-cov-l', layout: { visibility: hubLMShowCoverageL ? 'visible' : 'none' }, paint: { 'line-color': '#1D1D1F', 'line-width': 1.5, 'line-dasharray': [4, 3] } })

    // Hub M coverage circles
    map.addSource('hub-lm-cov-m', { type: 'geojson', data: makeCircles(hubLMResults.hubM?.hubs, 400) })
    map.addLayer({ id: 'hub-lm-cov-m-fill', type: 'fill', source: 'hub-lm-cov-m', layout: { visibility: hubLMShowCoverageM ? 'visible' : 'none' }, paint: { 'fill-color': '#1D7A3A', 'fill-opacity': 0.08 } })
    map.addLayer({ id: 'hub-lm-cov-m-stroke', type: 'line', source: 'hub-lm-cov-m', layout: { visibility: hubLMShowCoverageM ? 'visible' : 'none' }, paint: { 'line-color': '#1D7A3A', 'line-width': 1.5, 'line-dasharray': [4, 3] } })

    // Hub L candidates
    map.addSource('hub-lm-cand-l', { type: 'geojson', data: makePoints(hubLMResults.candidatesL) })
    map.addLayer({ id: 'hub-lm-cand-l', type: 'circle', source: 'hub-lm-cand-l', layout: { visibility: hubLMShowCandidatesL ? 'visible' : 'none' }, paint: { 'circle-radius': 4, 'circle-color': '#1D1D1F', 'circle-opacity': 0.45, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })

    // Hub M candidates
    map.addSource('hub-lm-cand-m', { type: 'geojson', data: makePoints(hubLMResults.candidatesM) })
    map.addLayer({ id: 'hub-lm-cand-m', type: 'circle', source: 'hub-lm-cand-m', layout: { visibility: hubLMShowCandidatesM ? 'visible' : 'none' }, paint: { 'circle-radius': 4, 'circle-color': '#1D7A3A', 'circle-opacity': 0.45, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })

    return () => {
      LAYERS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
      SOURCES.forEach(id => { if (map.getSource(id)) map.removeSource(id) })
    }
  }, [mapReady, activeMode, hubLMResults])

  // ── Hub L/M — sync layer visibility on toggle ─────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const vis = (v) => v ? 'visible' : 'none'
    if (map.getLayer('hub-lm-cov-l-fill'))   map.setLayoutProperty('hub-lm-cov-l-fill',   'visibility', vis(hubLMShowCoverageL))
    if (map.getLayer('hub-lm-cov-l-stroke'))  map.setLayoutProperty('hub-lm-cov-l-stroke',  'visibility', vis(hubLMShowCoverageL))
    if (map.getLayer('hub-lm-cov-m-fill'))    map.setLayoutProperty('hub-lm-cov-m-fill',    'visibility', vis(hubLMShowCoverageM))
    if (map.getLayer('hub-lm-cov-m-stroke'))  map.setLayoutProperty('hub-lm-cov-m-stroke',  'visibility', vis(hubLMShowCoverageM))
    if (map.getLayer('hub-lm-cand-l'))        map.setLayoutProperty('hub-lm-cand-l',        'visibility', vis(hubLMShowCandidatesL))
    if (map.getLayer('hub-lm-cand-m'))        map.setLayoutProperty('hub-lm-cand-m',        'visibility', vis(hubLMShowCandidatesM))
  }, [mapReady, hubLMShowCoverageL, hubLMShowCoverageM, hubLMShowCandidatesL, hubLMShowCandidatesM])

  // ── Export trigger from TopBar ────────────────────────────────────────────
  useEffect(() => {
    if (exportPNGTrigger > 0) handleDownloadPNG()
  }, [exportPNGTrigger])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownloadPNG() {
    if (!mapRef.current) return
    const map = mapRef.current
    const mapCanvas = map.getCanvas()
    const container = map.getContainer()
    // Compute actual device pixel ratio dynamically — avoids mismatch with MAP_PIXEL_RATIO constant
    const pr = mapCanvas.width / container.offsetWidth

    const offscreen = document.createElement('canvas')
    offscreen.width  = mapCanvas.width
    offscreen.height = mapCanvas.height
    const ctx = offscreen.getContext('2d')
    // Explicit dimensions required — WebGL canvas may otherwise be drawn at CSS size (1×)
    ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height)

    // Composite pie-chart markers (DOM elements not captured by toDataURL)
    const state = useAppStore.getState()
    const drawHubMarkers = async (hubs, scale) => {
      const hubItems = hubs.map(hub => {
        const baseSize = hub.priority === 'priority' ? 40 : 30
        const size = Math.round(baseSize * scale)
        const pt = map.project([hub.lng, hub.lat])
        return { hub, size, pt }
      })
      await Promise.all(hubItems.map(({ hub, size, pt }) => new Promise(resolve => {
        const svg  = makePieSVG(hub.hubType, hub.priority, size)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const blobUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, (pt.x - size / 2) * pr, (pt.y - size / 2) * pr, size * pr, size * pr)
          URL.revokeObjectURL(blobUrl)
          resolve()
        }
        img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve() }
        img.src = blobUrl
      })))
    }

    if (state.activeMode === 'intermodal' && state.intermodalHubs.length) {
      const visibleHubs = state.intermodalHubs.filter(hub => {
        if (!state.intermodalHubTypes.has(hub.hubType)) return false
        if (state.intermodalStatusFilter === 'existing' && hub.status !== 'existing') return false
        if (state.intermodalStatusFilter === 'proposed' && hub.status !== 'proposed') return false
        return true
      })
      await drawHubMarkers(visibleHubs, state.intermodalObjectScale ?? 1.0)
    } else if (state.activeMode === 'rad' && state.intermodalHubs.length) {
      const visibleHubs = state.intermodalHubs.filter(hub => state.radHubTypes.has(hub.hubType))
      await drawHubMarkers(visibleHubs, state.radHubObjectScale ?? 1.0)
    }

    // Draw scale bar (bottom-center)
    const center = map.getCenter()
    const zoom   = map.getZoom()
    const mPerCssPx = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom)
    const mPerCanvasPx = mPerCssPx / pr
    const niceDists = [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
    const targetM = 90 * mPerCssPx
    const barM = niceDists.find(d => d >= targetM * 0.5) ?? 1000
    const barW = barM / mPerCanvasPx
    const bx = (offscreen.width - barW) / 2
    const by = offscreen.height - 38 * pr, bh = 3 * pr, fs = 10 * pr
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillRect(bx - 5 * pr, by - fs - 8 * pr, barW + 10 * pr, fs + bh + 14 * pr)
    ctx.fillStyle = '#1D1D1F'
    ctx.fillRect(bx, by, barW, bh)
    ctx.fillRect(bx, by - 3 * pr, 1.5 * pr, bh + 3 * pr)
    ctx.fillRect(bx + barW - 1.5 * pr, by - 3 * pr, 1.5 * pr, bh + 3 * pr)
    ctx.font = `bold ${fs}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(barM >= 1000 ? `${barM / 1000} km` : `${barM} m`, bx + barW / 2, by - 7 * pr)

    const url = offscreen.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'wolfsburg-map.png'
    a.click()
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} className="w-full h-full" />
      {mapReady && <ScaleBarOverlay mapRef={mapRef} />}
    </div>
  )
}

// ── Custom scale bar overlay (bottom-center, also drawn in export) ────────────
function ScaleBarOverlay({ mapRef }) {
  const [bar, setBar] = React.useState({ px: 80, label: '1 km' })

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const c = map.getCenter()
      const mPerPx = (156543.03392 * Math.cos(c.lat * Math.PI / 180)) / Math.pow(2, map.getZoom())
      const nice = [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000].find(d => d >= mPerPx * 45) ?? 1000
      setBar({ px: Math.round(nice / mPerPx), label: nice >= 1000 ? `${nice / 1000} km` : `${nice} m` })
    }
    map.on('zoom', update)
    map.on('move', update)
    update()
    return () => { map.off('zoom', update); map.off('move', update) }
  }, [mapRef])

  return (
    <div style={{
      position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F',
        textShadow: '0 0 3px white, 0 0 6px white, 0 0 3px white' }}>
        {bar.label}
      </div>
      <div style={{
        width: bar.px, height: 4, background: '#1D1D1F', borderRadius: 2,
        boxShadow: '0 0 0 1.5px white, 0 2px 4px rgba(0,0,0,0.25)',
      }} />
    </div>
  )
}
