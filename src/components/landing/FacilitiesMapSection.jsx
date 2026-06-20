import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/appStore'
import { useFilters } from '../../hooks/useFilters'
import LeftSidebar from '../LeftSidebar'
import TransportPoolPanel from '../TransportPoolPanel'
import VenuePopup from '../VenuePopup'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CENTER = [10.7865, 52.4227]
const ZOOM = 13

function buildVenueGeoJSON(venues) {
  return {
    type: 'FeatureCollection',
    features: venues
      .filter(v => v.lat && v.lng)
      .map(v => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
        properties: {
          id: v.id, name: v.name, type: v.type, category: v.category,
          color: v.color || '#888888',
          opacity: v.opacity ?? 0.9,
          radius: v.radius ?? 6,
          openStatus: v.openStatus,
          activityLevel: v.activityLevel,
        },
      })),
  }
}

export default function FacilitiesMapSection() {
  const mapDivRef = useRef(null)
  const mapRef    = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [selectedVenueLocal, setSelectedVenueLocal] = useState(null)

  const { setSelectedFacilityVenueId } = useAppStore()
  const { filteredVenues } = useFilters()

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
      map.addSource('venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'venue-circles', type: 'circle', source: 'venues',
        paint: {
          'circle-radius': ['coalesce', ['get', 'radius'], 6],
          'circle-color':  ['coalesce', ['get', 'color'],  '#888888'],
          'circle-opacity': ['coalesce', ['get', 'opacity'], 0.9],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'venue-dots-inactive', type: 'circle', source: 'venues',
        filter: ['==', ['get', 'opacity'], 0.25],
        paint: {
          'circle-radius': 4,
          'circle-color': ['coalesce', ['get', 'color'], '#888888'],
          'circle-opacity': 0.25,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.on('click', 'venue-circles', e => {
        if (!e.features?.length) return
        const props = e.features[0].properties
        setSelectedFacilityVenueId(props.id)
      })
      map.on('mouseenter', 'venue-circles', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'venue-circles', () => { map.getCanvas().style.cursor = '' })

      setMapReady(true)
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Update venue source when filters change ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('venues')
    if (src) src.setData(buildVenueGeoJSON(filteredVenues))
  }, [mapReady, filteredVenues])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />
      {mapReady && <LeftSidebar />}
      {mapReady && <TransportPoolPanel />}
    </div>
  )
}
