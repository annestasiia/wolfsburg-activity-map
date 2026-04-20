import { useEffect } from 'react'
import { fetchAllBoundaries } from '../utils/osmBoundaries'
import { useAppStore } from '../store/appStore'

export function useDistricts() {
  const { setDistrictBoundaries, setBoundariesLoading, setBoundariesError } = useAppStore()

  useEffect(() => {
    setBoundariesLoading(true)
    fetchAllBoundaries()
      .then(boundaries => {
        setDistrictBoundaries(boundaries)
        setBoundariesLoading(false)
      })
      .catch(err => {
        console.error('District boundary fetch failed:', err)
        setBoundariesError(err.message)
        setBoundariesLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
