import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { DISTRICTS } from '../constants'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const WOLFSBURG  = { center: [10.7865, 52.4227], zoom: 12 }

function buildGeoJSON(venues) {
  return {
    type: 'FeatureCollection',
    features: venues.map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        id:           v.id,
        name:         v.name,
        type:         v.type,
        category:     v.category,
        district:     v.district,
        address:      `${v.street}, ${v.city}`,
        rating:       v.rating        || '',
        openingHours: v.openingHours  || '',
        peakTimes:    v.peakTimes     || '',
        notes:        v.notes         || '',
        ageGroups:    v.ageGroups     || '',
        street:       v.street        || '',
        city:         v.city          || '',
        activityLevel: v.activityLevel,
        openStatus:    v.openStatus,
        opacity:       v.opacity,
        radius:        v.radius,
        color:         v.color,
      },
    })),
  }
}


export default function MapView({ onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const { districtBoundaries, selectedDistricts, showNotes } = useAppStore()
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
      // Venue GeoJSON source (empty on load; filled below)
      map.addSource('venues', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Circle layer for venues with activity
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

      // Faint dot for venues with no activity (radius === 0)
      map.addLayer({
        id:     'venue-dots-inactive',
        type:   'circle',
        source: 'venues',
        filter: ['==', ['get', 'radius'], 0],
        paint: {
          'circle-radius':       3,
          'circle-color':        '#CCCCCC',
          'circle-opacity':      0.4,
          'circle-stroke-width': 0,
        },
      })

      // Hover tooltip
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
            <div style="font-size:12px;line-height:1.4">
              <strong style="display:block">${props.name}</strong>
              <span style="color:#888">${props.activityLevel} · ${props.category}</span>
            </div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'venue-circles', () => {
        map.getCanvas().style.cursor = ''
        tooltipRef.current?.remove()
        tooltipRef.current = null
      })

      // Click → open venue popup
      map.on('click', 'venue-circles', (e) => {
        if (!showNotes) return
        const props = e.features[0].properties
        onVenueClick?.(props)
      })

      // Inactive dots also clickable when notes on
      map.on('click', 'venue-dots-inactive', (e) => {
        if (!showNotes) return
        const props = e.features[0].properties
        onVenueClick?.(props)
      })

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

  // ── Re-wire click handler when showNotes changes ───────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const handleClick = (e) => {
      if (!showNotes) return
      onVenueClick?.(e.features[0].properties)
    }

    map.off('click', 'venue-circles',      handleClick)
    map.off('click', 'venue-dots-inactive', handleClick)
    map.on('click',  'venue-circles',       handleClick)
    map.on('click',  'venue-dots-inactive', handleClick)
  }, [mapReady, showNotes, onVenueClick])

  // ── Update venue GeoJSON when filters change ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('venues')
    if (src) src.setData(buildGeoJSON(filteredVenues))
  }, [filteredVenues, mapReady])

  // ── Add / toggle district boundary layers + update outside mask ───────────
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

        // Subtle colour wash inside each district
        map.addLayer({
          id: fillId, type: 'fill', source: srcId,
          paint: { 'fill-color': color, 'fill-opacity': 0.10 },
        }, 'venue-circles')

        // Bold district border
        map.addLayer({
          id: lineId, type: 'line', source: srcId,
          paint: { 'line-color': color, 'line-width': 2.5, 'line-opacity': 0.9 },
        }, 'venue-circles')
      }

      if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis)
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, 'visibility', vis)
    })

  }, [mapReady, districtBoundaries, selectedDistricts])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
