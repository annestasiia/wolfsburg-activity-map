import { create } from 'zustand'
import { DISTRICTS, CATEGORIES, getCurrentDayAbbr, getCurrentTimeStr } from '../constants'

export const useAppStore = create((set) => ({
  fileUploaded: false,
  venues: [],
  geocodingProgress: { current: 0, total: 0 },
  geocodingSkipped: 0,

  districtBoundaries: {},
  boundariesLoading: false,
  boundariesError: null,
  parks: null,
  water: null,
  forest: null,

  selectedDistricts: new Set(DISTRICTS.map(d => d.name)),
  selectedCategories: new Set(CATEGORIES.map(c => c.name)),
  selectedDay: getCurrentDayAbbr(),
  selectedTime: getCurrentTimeStr(),
  showNotes: false,

  setVenues: (venues) => set({ venues }),
  setGeocodingProgress: (progress) => set({ geocodingProgress: progress }),
  setGeocodingSkipped: (n) => set({ geocodingSkipped: n }),
  setFileUploaded: (val) => set({ fileUploaded: val }),

  setDistrictBoundaries: (boundaries) => set({ districtBoundaries: boundaries }),
  setBoundariesLoading: (val) => set({ boundariesLoading: val }),
  setBoundariesError: (msg) => set({ boundariesError: msg }),
  setParks: (parks) => set({ parks }),
  setWater: (water) => set({ water }),
  setForest: (forest) => set({ forest }),

  toggleDistrict: (name) => set((s) => {
    const next = new Set(s.selectedDistricts)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedDistricts: next }
  }),
  selectAllDistricts: () => set({ selectedDistricts: new Set(DISTRICTS.map(d => d.name)) }),
  clearAllDistricts: () => set({ selectedDistricts: new Set() }),

  toggleCategory: (name) => set((s) => {
    const next = new Set(s.selectedCategories)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedCategories: next }
  }),

  setSelectedDay: (day) => set({ selectedDay: day }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setShowNotes: (val) => set({ showNotes: val }),
}))
