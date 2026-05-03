import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { DISTRICTS } from '../constants'
import { HIGHWAY_TYPES, ROAD_STYLE, getTrafficOpacity } from '../utils/trafficPatterns'
import { computeFootwayGeoJSON } from '../utils/footwayActivity'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const WOLFSBURG  = { center: [10.7865, 52.4227], zoom: 12 }

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

function computeBbox(geojson) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minLng) minLng = coords[0]
      if (coords[0] > maxLng) maxLng = coords[0]
      if (coords[1] < minLat) minLat = coords[1]
      if (coords[1] > maxLat) maxLat = coords[1]
    } else {
      coords.forEach(visit)
    }
  }
  geojson.features?.forEach(f => { if (f.geometry) visit(f.geometry.coordinates) })
  return { minLng, maxLng, minLat, maxLat }
}

function inBbox(lng, lat, bbox) {
  return lng >= bbox.minLng && lng <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat
}

function scoreToOpacity(count) {
  if (count === 0)  return 0.0
  if (count === 1)  return 0.12
  if (count <= 3)   return 0.28
  if (count <= 9)   return 0.45
  return 0.65
}

function getCoordList(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString')      return geometry.coordinates
  if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
  return []
}

function scoreDistricts(geoJSON, districtBoundaries) {
  if (!districtBoundaries?.Stadtmitte) return {}
  const stadtBbox = computeBbox(districtBoundaries.Stadtmitte)
  const scores = {}

  for (const { name } of DISTRICTS) {
    if (name === 'Stadtmitte') { scores[name] = 0; continue }
    const distGeoJSON = districtBoundaries[name]
    if (!distGeoJSON) { scores[name] = 0; continue }
    const distBbox = computeBbox(distGeoJSON)
    let count = 0

    for (const feature of geoJSON.features) {
      const coords = getCoordList(feature.geometry)
      let hitDist = false, hitStadt = false
      for (const [lng, lat] of coords) {
        if (!hitDist  && inBbox(lng, lat, distBbox))  hitDist  = true
        if (!hitStadt && inBbox(lng, lat, stadtBbox)) hitStadt = true
        if (hitDist && hitStadt) { count++; break }
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

// ── Component ──────────────────────────────────────────────────────────────

export default function MapView({ onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const {
    districtBoundaries, selectedDistricts,
    parks, water, forest, showParks, showWater, showForest,
    roads, footways,
    activeModes, activeMode,
    selectedDay, selectedTime,
    mobilitySubLayer, mobilityScores, mobilityOverlayGeoJSON, mobilityDataCache,
    setMobilityScores, setMobilityOverlayGeoJSON, setMobilityDataLoading, setMobilityDataCache,
  } = useAppStore()
  const { filteredVenues } = useFilters()

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
      const vis = visible ? 'visible' : 'none'
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data })
        map.addLayer({ id: `${id}-fill`,    type: 'fill', source: id, paint: fill }, 'venue-circles')
        map.addLayer({ id: `${id}-outline`, type: 'line', source: id, paint: line }, 'venue-circles')
      }
      if (map.getLayer(`${id}-fill`))    map.setLayoutProperty(`${id}-fill`,    'visibility', vis)
      if (map.getLayer(`${id}-outline`)) map.setLayoutProperty(`${id}-outline`, 'visibility', vis)
    }
  }, [mapReady, forest, water, parks, showForest, showWater, showParks])

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
    const vis = activeMode !== 'mobility' ? 'visible' : 'none'
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
          paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.85 },
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

    const fetchAndScore = async () => {
      setMobilityDataLoading(true)
      try {
        let geoJSON

        if (mobilitySubLayer === 'automobile') {
          if (!roads) return
          geoJSON = roads
        } else if (mobilitySubLayer === 'pedestrian') {
          if (!footways) return
          geoJSON = footways
        } else {
          const cached = useAppStore.getState().mobilityDataCache[mobilitySubLayer]
          let raw = cached

          if (!raw) {
            const query = mobilitySubLayer === 'cycling'
              ? `[out:json][timeout:30];(way["highway"="cycleway"](52.35,10.68,52.52,10.93);way["cycleway"~"lane|track|shared_lane"](52.35,10.68,52.52,10.93);way["bicycle"="designated"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`
              : `[out:json][timeout:60];(relation["route"~"bus|tram"](52.35,10.68,52.52,10.93););out body;>;out skel qt;`
            const res = await fetch('https://overpass-api.de/api/interpreter', {
              method:  'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body:    `data=${encodeURIComponent(query)}`,
            })
            raw = await res.json()
            if (!cancelled) setMobilityDataCache(mobilitySubLayer, raw)
          }

          geoJSON = overpassToGeoJSON(raw)
        }

        if (cancelled || !geoJSON || !districtBoundaries?.Stadtmitte) return

        setMobilityOverlayGeoJSON(geoJSON)
        const scores = scoreDistricts(geoJSON, districtBoundaries)
        setMobilityScores(scores)
      } catch (err) {
        console.error('Mobility fetch error:', err)
      } finally {
        if (!cancelled) setMobilityDataLoading(false)
      }
    }

    fetchAndScore()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mobilitySubLayer, roads, footways, districtBoundaries])

  // ── Mobility — render overlay lines ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    if (!mobilityOverlayGeoJSON) {
      if (map.getLayer('mobility-overlay'))
        map.setLayoutProperty('mobility-overlay', 'visibility', 'none')
      return
    }

    if (!map.getSource('mobility-overlay')) {
      map.addSource('mobility-overlay', { type: 'geojson', data: mobilityOverlayGeoJSON })
      map.addLayer({
        id:     'mobility-overlay',
        type:   'line',
        source: 'mobility-overlay',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   '#E63946',
          'line-width':   1.2,
          'line-opacity': 0.30,
        },
      }, 'venue-circles')
    } else {
      map.getSource('mobility-overlay').setData(mobilityOverlayGeoJSON)
      if (map.getLayer('mobility-overlay'))
        map.setLayoutProperty('mobility-overlay', 'visibility', 'visible')
    }
  }, [mapReady, mobilityOverlayGeoJSON])

  // ── Mobility — color districts by score (runs after boundary effect) ───────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const hasMobilityScores = Object.keys(mobilityScores).length > 0

    DISTRICTS.forEach(({ name, color }) => {
      const fillId = `boundary-fill-${name}`
      const lineId = `boundary-line-${name}`
      if (!map.getLayer(fillId)) return

      if (hasMobilityScores) {
        const count   = mobilityScores[name] ?? 0
        const opacity = scoreToOpacity(count)
        map.setLayoutProperty(fillId, 'visibility', 'visible')
        map.setLayoutProperty(lineId, 'visibility', 'visible')
        map.setPaintProperty(fillId, 'fill-color',   '#E63946')
        map.setPaintProperty(fillId, 'fill-opacity',  opacity)
        map.setPaintProperty(lineId, 'line-color',   '#E63946')
        map.setPaintProperty(lineId, 'line-opacity',  opacity > 0 ? 0.6 : 0)
      } else {
        const vis = selectedDistricts.has(name) ? 'visible' : 'none'
        map.setLayoutProperty(fillId, 'visibility', vis)
        map.setLayoutProperty(lineId, 'visibility', vis)
        map.setPaintProperty(fillId, 'fill-color',   color)
        map.setPaintProperty(fillId, 'fill-opacity',  0.12)
        map.setPaintProperty(lineId, 'line-color',   color)
        map.setPaintProperty(lineId, 'line-opacity',  0.85)
      }
    })
  }, [mapReady, mobilityScores, selectedDistricts])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
