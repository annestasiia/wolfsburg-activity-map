import { useState, useEffect, useMemo } from 'react'
import { DISTRICT_CONFIG } from '../utils/districtBoundaries'
import { fetchAllDistrictBoundaries, loadMissingDistricts } from '../utils/fetchDistrict'
import { useAppStore } from '../store/appStore'

export function useDistricts() {
  // Boundary data and loading state are local — not stored in Zustand
  const [boundaries, setBoundaries] = useState({})
  const [loading, setLoading]       = useState(true)
  const [progress, setProgress]     = useState({ current: 0, total: 6, name: '' })
  const [error, setError]           = useState(null)

  // District selection stays in Zustand so useFilters can read it unchanged
  const { selectedDistricts, toggleDistrict, selectAllDistricts, clearAllDistricts } = useAppStore()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      fetchAllDistrictBoundaries(DISTRICT_CONFIG, (p) => {
        if (!cancelled) setProgress(p)
      }),
      loadMissingDistricts(DISTRICT_CONFIG).catch(() => []),
    ])
      .then(([primary, supplementary]) => {
        if (!cancelled) {
          const merged = { ...primary }
          for (const feature of supplementary) {
            const name = feature.properties?.name
            if (name && !merged[name]) {
              merged[name] = feature
              console.log(`[boundary] "${name}" filled from supplementary named query`)
            }
          }
          setBoundaries(merged)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  // Stable reference — only recomputes when boundaries or selection actually changes
  const activeBoundaries = useMemo(
    () => Object.fromEntries(
      Object.entries(boundaries).filter(([name]) => selectedDistricts.has(name))
    ),
    [boundaries, selectedDistricts]
  )

  return {
    boundaries,
    activeBoundaries,
    selected: selectedDistricts,
    loading,
    progress,
    error,
    toggleDistrict,
    selectAll: selectAllDistricts,
    clearAll: clearAllDistricts,
    config: DISTRICT_CONFIG,
  }
}
