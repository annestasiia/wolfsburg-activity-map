import { useEffect, useRef } from 'react'
import { DISTRICT_CONFIG } from '../utils/districtBoundaries'

const DISTRICT_NAMES = Object.keys(DISTRICT_CONFIG)

// Renders district boundary polygons as MapLibre GL layers.
// Placed inside MapView after the map style is loaded.
export function DistrictLayer({ map, activeBoundaries }) {
  const addedSources = useRef(new Set())

  useEffect(() => {
    if (!map) return

    // Layer to insert boundaries below (so venue markers stay on top)
    const beforeId = map.getLayer('venue-circles') ? 'venue-circles' : undefined

    DISTRICT_NAMES.forEach((name) => {
      const sourceId  = `district-${name}`
      const fillId    = `district-fill-${name}`
      const lineId    = `district-line-${name}`
      const config    = DISTRICT_CONFIG[name]
      const boundary  = activeBoundaries[name]

      // Remove stale layers + source before re-adding
      if (map.getLayer(lineId))   map.removeLayer(lineId)
      if (map.getLayer(fillId))   map.removeLayer(fillId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      addedSources.current.delete(name)

      if (!boundary) return // not selected or not yet loaded

      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [boundary] },
      })

      // Subtle fill
      map.addLayer(
        { id: fillId, type: 'fill', source: sourceId,
          paint: { 'fill-color': config.fillColor, 'fill-opacity': config.fillOpacity } },
        beforeId
      )

      // Visible outline
      map.addLayer(
        { id: lineId, type: 'line', source: sourceId,
          paint: { 'line-color': config.color, 'line-width': 2.5, 'line-opacity': 0.85 } },
        beforeId
      )

      addedSources.current.add(name)
    })

    return () => {
      DISTRICT_NAMES.forEach((name) => {
        const sourceId = `district-${name}`
        const fillId   = `district-fill-${name}`
        const lineId   = `district-line-${name}`
        if (map.getLayer(lineId))    map.removeLayer(lineId)
        if (map.getLayer(fillId))    map.removeLayer(fillId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      })
      addedSources.current.clear()
    }
  }, [map, activeBoundaries])

  return null
}
