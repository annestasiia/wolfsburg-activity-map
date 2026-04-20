import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { DistrictLayer } from './DistrictLayer'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const WOLFSBURG  = { center: [10.7865, 52.4227], zoom: 12 }

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

export default function MapView({ activeBoundaries = {}, onVenueClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const tooltipRef   = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const { showNotes } = useAppStore()
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
      // ── Venue GeoJSON source ──
      map.addSource('venues', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Active venues with activity data
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

      // Faint grey dot for venues with no activity on selected day
      map.addLayer({
        id:     'venue-dots-inactive',
        type:   'circle',
        source: 'venues',
        filter: ['==', ['get', 'radius'], 0],
        paint: {
          'circle-radius':       3,
          'circle-color':        '#CCCCCC',
          'circle-opacity':      0.35,
          'circle-stroke-width': 0,
        },
      })

      // ── Hover tooltip ──
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
            <div style="font-size:12px;line-height:1.5">
              <strong>${props.name}</strong><br>
              <span style="color:#888">${props.activityLevel} · ${props.category}</span>
            </div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'venue-circles', () => {
        map.getCanvas().style.cursor = ''
        tooltipRef.current?.remove()
        tooltipRef.current = null
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

  // ── Click handler (re-bound when showNotes changes) ───────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const handler = (e) => {
      if (!showNotes) return
      onVenueClick?.(e.features[0].properties)
    }

    map.on('click', 'venue-circles',       handler)
    map.on('click', 'venue-dots-inactive', handler)
    return () => {
      map.off('click', 'venue-circles',       handler)
      map.off('click', 'venue-dots-inactive', handler)
    }
  }, [mapReady, showNotes, onVenueClick])

  // ── Update venue GeoJSON when filters change ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('venues')
    if (src) src.setData(buildGeoJSON(filteredVenues))
  }, [filteredVenues, mapReady])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* District boundary polygons — rendered after map style loads */}
      {mapReady && (
        <DistrictLayer map={mapRef.current} activeBoundaries={activeBoundaries} />
      )}
    </div>
  )
}
