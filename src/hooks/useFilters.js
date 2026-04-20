import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { parseOpeningHours } from '../utils/parseHours'
import { CATEGORY_COLORS } from '../constants'

const ACTIVITY_RADIUS = { High: 12, Med: 8, Low: 5, '—': 0 }

export function useFilters() {
  const {
    venues,
    selectedDistricts,
    selectedCategories,
    selectedDay,
    selectedTime,
  } = useAppStore()

  const filteredVenues = useMemo(() => {
    return venues
      .filter(v => {
        if (selectedDistricts.size > 0 && !selectedDistricts.has(v.district)) return false
        if (selectedCategories.size > 0 && !selectedCategories.has(v.category)) return false
        return true
      })
      .map(v => {
        const activityLevel = v.days[selectedDay] ?? '—'
        const openStatus    = parseOpeningHours(v.openingHours, selectedDay, selectedTime)
        const opacity       = openStatus === 'closed' ? 0.2 : 1.0
        const radius        = ACTIVITY_RADIUS[activityLevel] ?? 3
        const color         = CATEGORY_COLORS[v.category] ?? '#888888'
        return { ...v, activityLevel, openStatus, opacity, radius, color }
      })
  }, [venues, selectedDistricts, selectedCategories, selectedDay, selectedTime])

  const openCount = filteredVenues.filter(v => v.openStatus !== 'closed' && v.radius > 0).length

  return { filteredVenues, openCount }
}
