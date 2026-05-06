import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { DISTRICTS } from '../constants'
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

// ── Helpers ────────────────────────────────────────────────────────────────

function buildGeoJSON(venues) {
  return {
    type: 'FeatureCollection',
    features: venues.map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        id:            v.id,
        name:          v.name,
        type:          v.type,
        category:      v.category,
        district:      v.district,
        address:       `${v.street}, ${v.city}`,
        rating:        v.rating        || '',
        openingHours:  v.openingHours  || '',
        peakTimes:     v.peakTimes     || '',
        notes:         v.notes         || '',
        ageGroups:     v.ageGroups     || '',
        street:        v.street        || '',
        city:          v.city          || '',
        activityLevel: v.activityLevel,
        openStatus:    v.openStatus,
        opacity:       v.opacity,
        radius:        v.radius,
        color:         v.color,
      },
    })),
  }
}

// 5-level gradient: score 0 = least connected (faintest pink)
function scoreToColorOpacity(score) {
  if (score <= 0) return { color: '#FFF0F3', fill: 0.50, line: 0.55 }
  if (score <= 2) return { color: '#FFCCD5', fill: 0.50, line: 0.60 }
  if (score <= 4) return { color: '#FF8FA3', fill: 0.50, line: 0.65 }
  if (score <= 6) return { color: '#FF4D6D', fill: 0.50, line: 0.72 }
  return          { color: '#FF1744',        fill: 0.50, line: 0.78 }
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
      properties: {
        _id:  el.id,
        name: el.tags?.name || el.tags?.['name:de'] || '',
        ref:  el.tags?.ref  || '',
      },
    }))
  return { type: 'FeatureCollection', features }
}

// Bike parking: nodes + ways with center coords (use `out center` in Overpass)
function parkingToGeoJSON(data) {
  const features = data.elements
    .filter(el => {
      if (el.type === 'node') return el.lat != null
      if (el.type === 'way')  return el.center?.lat != null
      return false
    })
    .map(el => {
      const coords = el.type === 'node'
        ? [el.lon, el.lat]
        : [el.center.lon, el.center.lat]
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          _id:      el.id,
          capacity: el.tags?.capacity ? (parseInt(el.tags.capacity, 10) || 1) : 1,
          covered:  el.tags?.covered === 'yes',
          name:     el.tags?.name || '',
        },
      }
    })
  return { type: 'FeatureCollection', features }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MapView({ onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  // Refs to avoid stale closures in persistent event handlers
  const mobilitySubLayerRef = useRef(null)
  const activeModeRef       = useRef('mobility')

  const {
    districtBoundaries, selectedDistricts,
    parks, water, forest, showParks, showWater, showForest,
    roads, footways,
    activeModes, activeMode,
    selectedDay, selectedTime,
    mobilitySubLayer, mobilityScores, mobilityOverlayGeoJSON,
    mobilityHighlightRoute, mobilityDataCache,
    setMobilityScores, setMobilityOverlayGeoJSON, setMobilityDataLoading, setMobilityDataCache,
    transitStopsGeoJSON, showTransitStops,
    setTransitStopsGeoJSON,
    cyclingParkingGeoJSON, showCyclingParking,
    setCyclingParkingGeoJSON,
    cyclingRoutesGeoJSON, showCyclingRoutes,
    setCyclingRoutesGeoJSON,
    cyclingHighlightLeisureRoute,
    selectedMobilityDistrict, setSelectedMobilityDistrict,
    // Greenery
    greeneryGeoJSON, greeneryCategoryToggles, greeneryTagToggles, greeneryOthersTagToggles,
    showGreeneryDistrictBorders,
    setGreeneryGeoJSON, setGreeneryDataLoading, setGreeneryDataError,
  } = useAppStore()
  const { filteredVenues } = useFilters()

  // Keep refs in sync
  useEffect(() => { mobilitySubLayerRef.current = mobilitySubLayer }, [mobilitySubLayer])
  useEffect(() => { activeModeRef.current = activeMode }, [activeMode])

  // ── Initialise map (once) ──────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container:  containerRef.current,
      style:      MAP_STYLE,
      center:     WOLFSBURG.center,
      zoom:       WOLFSBURG.zoom,
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('venues', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id:     'venue-circles',
        type:   'circle',
        source: 'venues',
        filter: ['>', ['get', 'radius'], 0],
        paint: {
          'circle-radius':         ['get', 'radius'],
          'circle-color':          ['get', 'color'],
          'circle-opacity':        ['get', 'opacity'],
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   '#FFFFFF',
          'circle-stroke-opacity': ['get', 'opacity'],
        },
      })

      map.addLayer({
        id:     'venue-dots-inactive',
        type:   'circle',
        source: 'venues',
        filter: ['==', ['get', 'radius'], 0],
        paint: {
          'circle-radius':       3,
          'circle-color':        '#8E8E93',
          'circle-opacity':      0.35,
          'circle-stroke-width': 0,
        },
      })

      map.on('mouseenter', 'venue-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const feat  = e.features[0]
        const props = feat.properties
        tooltipRef.current?.remove()
        tooltipRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'venue-tooltip',
        })
          .setLngLat(feat.geometry.coordinates)
          .setHTML(`
            <div style="font-size:12px;line-height:1.4;color:#1D1D1F">
              <strong style="display:block;margin-bottom:2px">${props.name}</strong>
              <span style="color:#8E8E93">${props.activityLevel} · ${props.category}</span>
            </div>`)
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

  // ── Re-wire click handler when onVenueClick changes ───────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const handler = (e) => onVenueClick?.(e.features[0].properties)
    map.off('click', 'venue-circles',       handler)
    map.off('click', 'venue-dots-inactive', handler)
    map.on('click',  'venue-circles',       handler)
    map.on('click',  'venue-dots-inactive', handler)
  }, [mapReady, onVenueClick])

  // ── District click + cursor in mobility mode (registered once) ────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const CLICKABLE_SUBLAYERS = ['transport', 'cycling']

    const handleClick = (e) => {
      const sub = mobilitySubLayerRef.current
      if (activeModeRef.current !== 'mobility' || !CLICKABLE_SUBLAYERS.includes(sub)) return
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
      const sub = mobilitySubLayerRef.current
      if (activeModeRef.current !== 'mobility' || !CLICKABLE_SUBLAYERS.includes(sub)) {
        map.getCanvas().style.cursor = ''
        return
      }
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
      {
        id: 'forest', data: forest,
        fill: { 'fill-color': '#228B22', 'fill-opacity': 0.22 },
        line: { 'line-color': '#228B22', 'line-width': 0.8, 'line-opacity': 0.45 },
        visible: showForest,
      },
      {
        id: 'water', data: water,
        fill: { 'fill-color': '#4A90E2', 'fill-opacity': 0.28 },
        line: { 'line-color': '#2E75CC', 'line-width': 1, 'line-opacity': 0.55 },
        visible: showWater,
      },
      {
        id: 'parks', data: parks,
        fill: { 'fill-color': '#90EE90', 'fill-opacity': 0.28 },
        line: { 'line-color': '#32CD32', 'line-width': 1, 'line-opacity': 0.5 },
        visible: showParks,
      },
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

  // ── Update venue GeoJSON when filters change ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('venues')
    if (src) src.setData(buildGeoJSON(filteredVenues))
  }, [filteredVenues, mapReady])

  // ── Venue layer visibility (hide in Mobility mode) ─────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const vis = activeMode === 'facilities' ? 'visible' : 'none'
    if (map.getLayer('venue-circles'))       map.setLayoutProperty('venue-circles',       'visibility', vis)
    if (map.getLayer('venue-dots-inactive')) map.setLayoutProperty('venue-dots-inactive', 'visibility', vis)
  }, [mapReady, activeMode])

  // ── Traffic — initialise road layers once ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !roads) return
    const map = mapRef.current
    if (map.getSource('roads')) return

    map.addSource('roads', { type: 'geojson', data: roads })
    HIGHWAY_TYPES.forEach(type => {
      map.addLayer({
        id:     `roads-${type}`,
        type:   'line',
        source: 'roads',
        filter: ['==', ['get', 'highway'], type],
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: {
          'line-color':   ROAD_STYLE[type].color,
          'line-width':   ROAD_STYLE[type].width,
          'line-opacity': 0,
        },
      }, 'venue-circles')
    })
  }, [mapReady, roads])

  // ── Traffic — update opacity + visibility (legacy transport mode) ──────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const showTransport = activeModes.has('transport')
    HIGHWAY_TYPES.forEach(type => {
      const layerId = `roads-${type}`
      if (!map.getLayer(layerId)) return
      map.setLayoutProperty(layerId, 'visibility', showTransport ? 'visible' : 'none')
      if (showTransport) {
        map.setPaintProperty(layerId, 'line-opacity',
          getTrafficOpacity(type, selectedDay, selectedTime))
      }
    })
  }, [mapReady, activeModes, selectedDay, selectedTime])

  // ── Footway — initialise layer once ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !footways) return
    const map = mapRef.current
    if (map.getSource('footways')) return

    const initial = computeFootwayGeoJSON(footways, [], 'Mon', '12:00')
    map.addSource('footways', { type: 'geojson', data: initial })
    map.addLayer({
      id:     'footways-line',
      type:   'line',
      source: 'footways',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color':   '#007AFF',
        'line-width':   1.8,
        'line-opacity': ['get', 'opacity'],
      },
    }, 'venue-circles')
  }, [mapReady, footways])

  // ── Footway — recompute brightness on time/day/venue change ───────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !footways) return
    const map = mapRef.current
    if (!map.getSource('footways')) return
    const updated = computeFootwayGeoJSON(footways, filteredVenues, selectedDay, selectedTime)
    map.getSource('footways').setData(updated)
  }, [mapReady, footways, filteredVenues, selectedDay, selectedTime])

  // ── Footway — toggle visibility (legacy pedestrian mode) ──────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer('footways-line')) return
    map.setLayoutProperty('footways-line', 'visibility',
      activeModes.has('pedestrian') ? 'visible' : 'none')
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

      if (data && data.features?.length && !map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data })
        map.addLayer({
          id: fillId, type: 'fill', source: srcId,
          paint: { 'fill-color': color, 'fill-opacity': 0.12 },
        }, 'venue-circles')
        map.addLayer({
          id: lineId, type: 'line', source: srcId,
          // line-width 3 for a clearly visible boundary
          paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85 },
        }, 'venue-circles')
      }

      if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis)
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis)
    })
  }, [mapReady, districtBoundaries, selectedDistricts])

  // ── Mobility — fetch data + compute district scores ────────────────────────
  useEffect(() => {
    if (!mapReady) return

    if (!mobilitySubLayer) {
      setMobilityScores({})
      setMobilityOverlayGeoJSON(null)
      return
    }

    let cancelled = false

    // Extended bbox for automobile covers surrounding towns (Gifhorn S, Weyhausen N, etc.)
    const OVERPASS_QUERIES = {
      automobile: `[out:json][timeout:90];(way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street"](52.22,10.55,52.62,11.08););out body;>;out skel qt;`,
      cycling:    `[out:json][timeout:30];(way["highway"="cycleway"](52.35,10.68,52.52,10.93);way["cycleway"~"lane|track|shared_lane|opposite_lane|opposite_track"](52.35,10.68,52.52,10.93);way["cycleway:right"~"lane|track"](52.35,10.68,52.52,10.93);way["cycleway:left"~"lane|track"](52.35,10.68,52.52,10.93);way["cycleway:both"~"lane|track"](52.35,10.68,52.52,10.93);way["bicycle"="designated"]["highway"~"path|track|footway"](52.35,10.68,52.52,10.93);way["bicycle"="yes"]["highway"~"path|track"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
      pedestrian: `[out:json][timeout:30];(way["highway"~"footway|path|pedestrian|steps|living_street"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
      transport:  `[out:json][timeout:60];(relation["route"~"bus|tram|subway|light_rail|trolleybus|share_taxi"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`,
    }

    const CENTRAL_PADDING = {
      transport:  0,
      automobile: 0.025,
      cycling:    0.020,
      pedestrian: 0.020,
    }

    const fetchAndScore = async () => {
      setMobilityDataLoading(true)
      try {
        let raw = useAppStore.getState().mobilityDataCache[mobilitySubLayer]

        if (!raw) {
          const res = await fetch('https://overpass-api.de/api/interpreter', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    `data=${encodeURIComponent(OVERPASS_QUERIES[mobilitySubLayer])}`,
          })
          raw = await res.json()
          if (!cancelled) setMobilityDataCache(mobilitySubLayer, raw)
        }

        const geoJSON = overpassToGeoJSON(raw)
        if (cancelled || !geoJSON || !Object.keys(districtBoundaries).length) return

        const rawScores = scoreDistrictsToCenter(
          geoJSON, districtBoundaries, CENTRAL_PADDING[mobilitySubLayer] ?? 0
        )
        setMobilityOverlayGeoJSON(geoJSON)
        setMobilityScores(normalizeScores(rawScores))
      } catch (err) {
        console.error('Mobility fetch error:', err)
      } finally {
        if (!cancelled) setMobilityDataLoading(false)
      }
    }

    fetchAndScore()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mobilitySubLayer, districtBoundaries])

  // ── Mobility — fetch transit stops when transport sublayer is selected ─────
  useEffect(() => {
    if (!mapReady || mobilitySubLayer !== 'transport') return

    // Already fetched
    if (useAppStore.getState().transitStopsGeoJSON) return

    let cancelled = false
    const STOPS_QUERY = `[out:json][timeout:30];(node["highway"="bus_stop"](52.35,10.68,52.52,10.93);node["public_transport"="platform"]["bus"="yes"](52.35,10.68,52.52,10.93););out body;`

    const fetchStops = async () => {
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(STOPS_QUERY)}`,
        })
        const raw = await res.json()
        if (!cancelled) setTransitStopsGeoJSON(stopsToGeoJSON(raw))
      } catch (err) {
        console.error('Stops fetch error:', err)
      }
    }

    fetchStops()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mobilitySubLayer])

  // ── Cycling — fetch bike parking when cycling sublayer is selected ─────────
  useEffect(() => {
    if (!mapReady || mobilitySubLayer !== 'cycling') return
    if (useAppStore.getState().cyclingParkingGeoJSON) return

    let cancelled = false
    // Only public parking: exclude access=private/customers/no
    // Untagged access defaults to public in OSM convention
    const PARKING_QUERY = `[out:json][timeout:30];(node["amenity"="bicycle_parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93);way["amenity"="bicycle_parking"]["access"!="private"]["access"!="customers"]["access"!="no"](52.35,10.68,52.52,10.93););out center;`

    const fetchParking = async () => {
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(PARKING_QUERY)}`,
        })
        const raw = await res.json()
        if (!cancelled) setCyclingParkingGeoJSON(parkingToGeoJSON(raw))
      } catch (err) {
        console.error('Cycling parking fetch error:', err)
      }
    }

    fetchParking()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mobilitySubLayer])

  // ── Cycling — fetch leisure route relations when cycling sublayer selected ─
  useEffect(() => {
    if (!mapReady || mobilitySubLayer !== 'cycling') return
    if (useAppStore.getState().cyclingRoutesGeoJSON) return

    let cancelled = false
    // Named cycling route relations (leisure routes, regional/local bike routes)
    const ROUTES_QUERY = `[out:json][timeout:60];(relation["route"="bicycle"](52.30,10.60,52.55,11.00);relation["route"="mtb"](52.30,10.60,52.55,11.00););out body;>;out skel qt;`

    const fetchRoutes = async () => {
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(ROUTES_QUERY)}`,
        })
        const raw = await res.json()
        if (!cancelled) setCyclingRoutesGeoJSON(overpassToGeoJSON(raw))
      } catch (err) {
        console.error('Cycling routes fetch error:', err)
      }
    }

    fetchRoutes()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mobilitySubLayer])

  // ── Mobility — render overlay lines ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    if (!mobilityOverlayGeoJSON) {
      if (map.getLayer('mobility-overlay'))
        map.setLayoutProperty('mobility-overlay', 'visibility', 'none')
      return
    }

    const isAuto    = mobilitySubLayer === 'automobile'
    const isCycling = mobilitySubLayer === 'cycling'

    // Red shades for automobile roads by hierarchy (dark → light = major → minor)
    const lineColor = isAuto
      ? ['match', ['get', 'highway'],
          'motorway',       '#8B0000',
          'trunk',          '#B71C1C',
          'motorway_link',  '#B71C1C',
          'trunk_link',     '#B71C1C',
          'primary',        '#C62828',
          'primary_link',   '#C62828',
          'secondary',      '#D32F2F',
          'secondary_link', '#D32F2F',
          'tertiary',       '#E53935',
          'tertiary_link',  '#EF5350',
          'unclassified',   '#EF5350',
          'residential',    '#EF9A9A',
          '#FFCDD2']
      : isCycling ? '#FF1744' : '#E63946'

    const lineWidth = isAuto
      ? ['match', ['get', 'highway'],
          'motorway', 7,   'trunk', 6,
          'primary',  4.5, 'motorway_link', 4,   'trunk_link',     3.5,
          'secondary', 3.5,'primary_link',  3,   'secondary_link', 2.5,
          'tertiary',  2.5,'tertiary_link', 2,
          'unclassified', 1.8, 'residential', 1.2,
          1.0]
      : isCycling ? 4.0 : 1.2

    // Automobile roads are placed UNDER district fills → keep high opacity so
    // they stay visible through the 50% transparent fills.
    const lineOpacity = isAuto
      ? ['match', ['get', 'highway'],
          'motorway', 1.0,  'trunk', 1.0,
          'primary', 0.95,  'motorway_link', 0.95, 'trunk_link', 0.95,
          'secondary', 0.90,'primary_link',  0.90, 'secondary_link', 0.88,
          'tertiary',  0.82,'tertiary_link', 0.80,
          'unclassified', 0.75, 'residential', 0.70,
          0.60]
      : isCycling ? 0.88 : 0.30

    // Insert automobile overlay BELOW district fills so they show through
    // the 50%-transparent region colours.  Other modes stay above fills.
    const getBeforeLayer = () => {
      if (!isAuto) return 'venue-circles'
      const firstFill = DISTRICTS.map(d => `boundary-fill-${d.name}`).find(id => map.getLayer(id))
      return firstFill || 'venue-circles'
    }

    if (!map.getSource('mobility-overlay')) {
      map.addSource('mobility-overlay', { type: 'geojson', data: mobilityOverlayGeoJSON })
      map.addLayer({
        id:     'mobility-overlay',
        type:   'line',
        source: 'mobility-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': lineColor, 'line-width': lineWidth, 'line-opacity': lineOpacity },
      }, getBeforeLayer())
    } else {
      map.getSource('mobility-overlay').setData(mobilityOverlayGeoJSON)
      if (map.getLayer('mobility-overlay')) {
        map.setPaintProperty('mobility-overlay', 'line-color',   lineColor)
        map.setPaintProperty('mobility-overlay', 'line-width',   lineWidth)
        map.setPaintProperty('mobility-overlay', 'line-opacity', lineOpacity)
        map.setLayoutProperty('mobility-overlay', 'visibility',  'visible')

        // Re-order the layer when switching between auto (under fills) and others (above)
        const target = getBeforeLayer()
        try { map.moveLayer('mobility-overlay', target) } catch (_) {}
      }
    }
  }, [mapReady, mobilityOverlayGeoJSON, mobilitySubLayer])

  // ── Mobility — highlight a single selected transport route ───────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    if (!mobilityHighlightRoute || !mobilityOverlayGeoJSON) {
      if (map.getLayer('mobility-highlight'))
        map.setLayoutProperty('mobility-highlight', 'visibility', 'none')
      return
    }

    const feature = mobilityOverlayGeoJSON.features.find(
      f => f.properties._id === mobilityHighlightRoute
    )
    if (!feature) return

    const hlGeoJSON = { type: 'FeatureCollection', features: [feature] }

    if (!map.getSource('mobility-highlight')) {
      map.addSource('mobility-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({
        id:     'mobility-highlight',
        type:   'line',
        source: 'mobility-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   '#FF6900',
          'line-width':   4.5,
          'line-opacity': 0.90,
        },
      })
    } else {
      map.getSource('mobility-highlight').setData(hlGeoJSON)
      map.setLayoutProperty('mobility-highlight', 'visibility', 'visible')
    }
  }, [mapReady, mobilityHighlightRoute, mobilityOverlayGeoJSON])

  // ── Transit stops — render / update ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const vis = (mobilitySubLayer === 'transport' && showTransitStops && transitStopsGeoJSON)
      ? 'visible' : 'none'

    if (!transitStopsGeoJSON) return

    if (!map.getSource('transit-stops')) {
      map.addSource('transit-stops', { type: 'geojson', data: transitStopsGeoJSON })
      map.addLayer({
        id:     'transit-stops-circles',
        type:   'circle',
        source: 'transit-stops',
        layout: { visibility: vis },
        paint: {
          'circle-radius':         5,
          'circle-color':          '#0077FF',
          'circle-opacity':        0.85,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   '#FFFFFF',
          'circle-stroke-opacity': 0.9,
        },
      }, 'venue-circles')
    } else {
      map.getSource('transit-stops').setData(transitStopsGeoJSON)
      if (map.getLayer('transit-stops-circles'))
        map.setLayoutProperty('transit-stops-circles', 'visibility', vis)
    }
  }, [mapReady, transitStopsGeoJSON, showTransitStops, mobilitySubLayer])

  // ── Cycling parking — render / update ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const vis = (mobilitySubLayer === 'cycling' && showCyclingParking && cyclingParkingGeoJSON)
      ? 'visible' : 'none'

    if (!cyclingParkingGeoJSON) return

    if (!map.getSource('cycling-parking')) {
      map.addSource('cycling-parking', { type: 'geojson', data: cyclingParkingGeoJSON })
      map.addLayer({
        id:     'cycling-parking-circles',
        type:   'circle',
        source: 'cycling-parking',
        layout: { visibility: vis },
        paint: {
          'circle-radius':         5,
          'circle-color':          '#00C853',
          'circle-opacity':        0.88,
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   '#FFFFFF',
          'circle-stroke-opacity': 0.9,
        },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-parking').setData(cyclingParkingGeoJSON)
      if (map.getLayer('cycling-parking-circles'))
        map.setLayoutProperty('cycling-parking-circles', 'visibility', vis)
    }
  }, [mapReady, cyclingParkingGeoJSON, showCyclingParking, mobilitySubLayer])

  // ── Cycling leisure routes — render / update ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const vis = (mobilitySubLayer === 'cycling' && showCyclingRoutes && cyclingRoutesGeoJSON)
      ? 'visible' : 'none'

    if (!cyclingRoutesGeoJSON) return

    if (!map.getSource('cycling-routes')) {
      map.addSource('cycling-routes', { type: 'geojson', data: cyclingRoutesGeoJSON })
      map.addLayer({
        id:     'cycling-routes-line',
        type:   'line',
        source: 'cycling-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
        paint: {
          'line-color':   '#FF6900',
          'line-width':   3.5,
          'line-opacity': 0.80,
          'line-dasharray': [4, 3],
        },
      }, 'venue-circles')
    } else {
      map.getSource('cycling-routes').setData(cyclingRoutesGeoJSON)
      if (map.getLayer('cycling-routes-line'))
        map.setLayoutProperty('cycling-routes-line', 'visibility', vis)
    }
  }, [mapReady, cyclingRoutesGeoJSON, showCyclingRoutes, mobilitySubLayer])

  // ── Cycling leisure routes — highlight selected route ─────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    if (!cyclingHighlightLeisureRoute || !cyclingRoutesGeoJSON) {
      if (map.getLayer('cycling-route-highlight'))
        map.setLayoutProperty('cycling-route-highlight', 'visibility', 'none')
      return
    }

    const feature = cyclingRoutesGeoJSON.features.find(
      f => f.properties._id === cyclingHighlightLeisureRoute
    )
    if (!feature) return

    const hlGeoJSON = { type: 'FeatureCollection', features: [feature] }

    if (!map.getSource('cycling-route-highlight')) {
      map.addSource('cycling-route-highlight', { type: 'geojson', data: hlGeoJSON })
      map.addLayer({
        id:     'cycling-route-highlight',
        type:   'line',
        source: 'cycling-route-highlight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   '#FF6900',
          'line-width':   7,
          'line-opacity': 0.92,
        },
      })
    } else {
      map.getSource('cycling-route-highlight').setData(hlGeoJSON)
      map.setLayoutProperty('cycling-route-highlight', 'visibility', 'visible')
    }
  }, [mapReady, cyclingHighlightLeisureRoute, cyclingRoutesGeoJSON])

  // ── Mobility — color districts by score ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const hasMobilityScores = Object.keys(mobilityScores).length > 0

    DISTRICTS.forEach(({ name, color }) => {
      const fillId = `boundary-fill-${name}`
      const lineId = `boundary-line-${name}`
      if (!map.getLayer(fillId)) return

      if (hasMobilityScores) {
        const normScore = mobilityScores[name] ?? 0
        const { color: dc, fill, line } = scoreToColorOpacity(normScore)
        map.setLayoutProperty(fillId, 'visibility', 'visible')
        map.setLayoutProperty(lineId, 'visibility', 'visible')
        map.setPaintProperty(fillId, 'fill-color',   dc)
        map.setPaintProperty(fillId, 'fill-opacity',  fill)
        // Cycling mode: neutral pink border so red cycle paths are clearly visible
        const borderColor   = mobilitySubLayer === 'cycling' ? '#E8B4C0' : dc
        const borderOpacity = mobilitySubLayer === 'cycling' ? 0.45      : line
        const borderWidth   = mobilitySubLayer === 'cycling' ? 1.5       : 3
        map.setPaintProperty(lineId, 'line-color',   borderColor)
        map.setPaintProperty(lineId, 'line-opacity',  borderOpacity)
        map.setPaintProperty(lineId, 'line-width',    borderWidth)
      } else {
        const vis = selectedDistricts.has(name) ? 'visible' : 'none'
        map.setLayoutProperty(fillId, 'visibility', vis)
        map.setLayoutProperty(lineId, 'visibility', vis)
        map.setPaintProperty(fillId, 'fill-color',   color)
        map.setPaintProperty(fillId, 'fill-opacity',  0.12)
        map.setPaintProperty(lineId, 'line-color',   color)
        map.setPaintProperty(lineId, 'line-opacity',  0.85)
        map.setPaintProperty(lineId, 'line-width',    3)
      }
    })
  }, [mapReady, mobilityScores, selectedDistricts, mobilitySubLayer])

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
