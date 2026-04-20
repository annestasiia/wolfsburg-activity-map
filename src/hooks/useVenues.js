import { useState, useCallback } from 'react'
import { parseExcelFile } from '../utils/parseExcel'
import { geocodeVenues } from '../utils/geocode'
import { useAppStore } from '../store/appStore'

export function useVenues() {
  const { setVenues, setFileUploaded, setGeocodingProgress, setGeocodingSkipped } = useAppStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError]               = useState(null)

  const processFile = useCallback(async (file) => {
    setIsProcessing(true)
    setError(null)
    setGeocodingProgress({ current: 0, total: 0 })

    try {
      const rawVenues = await parseExcelFile(file)

      const geocoded = await geocodeVenues(rawVenues, (progress) => {
        setGeocodingProgress(progress)
      })

      const valid   = geocoded.filter(v => v.lat !== null && v.lng !== null)
      const skipped = geocoded.length - valid.length

      if (skipped > 0) console.warn(`Skipped ${skipped} venues with no geocoded address`)
      setGeocodingSkipped(skipped)
      setVenues(valid)
      setFileUploaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }, [setVenues, setFileUploaded, setGeocodingProgress, setGeocodingSkipped])

  return { processFile, isProcessing, error }
}
