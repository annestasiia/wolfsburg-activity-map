import { useEffect, useRef } from 'react'
import { DISTRICT_CONFIG } from '../utils/districtBoundaries'

const DISTRICT_NAMES = Object.keys(DISTRICT_CONFIG)

function removeLayers(map, name) {
  const sourceId = `district-${name}`
  const fillId   = `district-fill-${name}`
  const lineId   = `district-line-${name}`
  try { if (map.getLayer(lineId))    map.removeLayer(lineId)   } catch {}
  try { if (map.getLayer(fillId))    map.removeLayer(fillId)   } catch {}
  try { if (map.getSource(sourceId)) map.removeSource(sourceId)} catch {}
}

// Renders district boundary polygons as MapLibre GL layers.
// activeBoundaries is memoized in useDistricts so this effect only
// fires when boundary data or district selection genuinely changes.
export function DistrictLayer({ map, activeBoundaries }) {
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!map) return

    // Insert boundaries below venue markers so circles stay on top
    const beforeId = map.getLayer('venue-circles') ? 'venue-circles' : undefined

    DISTRICT_NAMES.forEach((name) => {
      const sourceId = `district-${name}`
      const fillId   = `district-fill-${name}`
      const lineId   = `district-line-${name}`
      const cfg      = DISTRICT_CONFIG[name]
      const boundary = activeBoundaries[name]

      // Always remove stale layers/source before potentially re-adding
      removeLayers(map, name)

      if (!boundary) return // not selected or fetch returned null

      try {
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [boundary] },
        })

        map.addLayer(
          { id: fillId, type: 'fill', source: sourceId,
            paint: { 'fill-color': cfg.fillColor, 'fill-opacity': cfg.fillOpacity } },
          beforeId
        )

        map.addLayer(
          { id: lineId, type: 'line', source: sourceId,
            paint: { 'line-color': cfg.color, 'line-width': 2.5, 'line-opacity': 0.85 } },
          beforeId
        )
      } catch (err) {
        // One district failing must not abort the rest
        console.error(`[DistrictLayer] Failed to add layers for "${name}":`, err)
        removeLayers(map, name)
      }
    })

    return () => {
      DISTRICT_NAMES.forEach((name) => removeLayers(map, name))
    }
  }, [map, activeBoundaries])

  return null
}
