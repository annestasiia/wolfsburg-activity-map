import { useState, useEffect } from 'react'
import { DISTRICT_CONFIG } from '../utils/districtBoundaries'
import { fetchAllDistrictBoundaries } from '../utils/fetchDistrict'
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

    fetchAllDistrictBoundaries(DISTRICT_CONFIG, (p) => {
      if (!cancelled) setProgress(p)
    })
      .then((result) => {
        if (!cancelled) {
          setBoundaries(result)
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

  // Only the boundaries for currently selected districts
  const activeBoundaries = Object.fromEntries(
    Object.entries(boundaries).filter(([name]) => selectedDistricts.has(name))
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
