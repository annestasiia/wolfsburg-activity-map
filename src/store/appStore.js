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
  roads: null,
  footways: null,
  showParks: true,
  showWater: true,
  showForest: true,

  // ── Legacy multi-mode (kept for internal use) ─────────────────────────────
  activeModes: new Set(['infrastructure']),
  activeBottomPanel: null,

  // ── New top-level analysis mode ───────────────────────────────────────────
  activeMode: 'mobility',           // 'mobility' | 'facilities' | 'greenery'

  // ── Mobility sub-layer ────────────────────────────────────────────────────
  mobilitySubLayer: null,           // null | 'transport' | 'automobile' | 'cycling' | 'pedestrian'
  mobilityScores: {},               // { districtName: number 0-10 }
  mobilityOverlayGeoJSON: null,     // GeoJSON FeatureCollection for the line overlay
  mobilityDataCache: {},            // { layerKey: raw OSM elements array }
  mobilityDataLoading: false,
  mobilityHighlightRoute: null,     // relation ID of the currently highlighted transport route

  // ── Transit stops ─────────────────────────────────────────────────────────
  transitStopsGeoJSON: null,        // GeoJSON FeatureCollection of bus stop nodes
  showTransitStops: false,          // toggle visibility of stop markers

  // ── Cycling parking ───────────────────────────────────────────────────────
  cyclingParkingGeoJSON: null,      // GeoJSON FeatureCollection of bicycle_parking nodes
  showCyclingParking: false,        // toggle visibility of parking markers

  // ── District selection in mobility mode ───────────────────────────────────
  selectedMobilityDistrict: null,   // district name clicked on the map

  selectedDistricts: new Set(),
  selectedCategories: new Set(CATEGORIES.map(c => c.name)),
  selectedDay: getCurrentDayAbbr(),
  selectedTime: getCurrentTimeStr(),
  showNotes: true,

  // ── Setters (existing) ────────────────────────────────────────────────────
  setVenues: (venues) => set({ venues }),
  setGeocodingProgress: (progress) => set({ geocodingProgress: progress }),
  setGeocodingSkipped: (n) => set({ geocodingSkipped: n }),
  setFileUploaded: (val) => set({ fileUploaded: val }),

  setDistrictBoundaries: (boundaries) => set({ districtBoundaries: boundaries }),
  setBoundariesLoading: (val) => set({ boundariesLoading: val }),
  setBoundariesError: (msg) => set({ boundariesError: msg }),
  setParks:    (parks)    => set({ parks }),
  setWater:    (water)    => set({ water }),
  setForest:   (forest)   => set({ forest }),
  setRoads:    (roads)    => set({ roads }),
  setFootways: (footways) => set({ footways }),

  toggleMode: (mode) => set(s => {
    const next = new Set(s.activeModes)
    next.has(mode) ? next.delete(mode) : next.add(mode)
    return { activeModes: next }
  }),

  setActiveBottomPanel: (panel) => set(s => ({
    activeBottomPanel: s.activeBottomPanel === panel ? null : panel,
  })),

  toggleParks:  () => set(s => ({ showParks:  !s.showParks  })),
  toggleWater:  () => set(s => ({ showWater:  !s.showWater  })),
  toggleForest: () => set(s => ({ showForest: !s.showForest })),

  toggleDistrict: (name) => set((s) => {
    const next = new Set(s.selectedDistricts)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedDistricts: next }
  }),
  selectAllDistricts: () => set({ selectedDistricts: new Set(DISTRICTS.map(d => d.name)) }),
  clearAllDistricts:  () => set({ selectedDistricts: new Set() }),

  toggleCategory: (name) => set((s) => {
    const next = new Set(s.selectedCategories)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedCategories: next }
  }),

  setSelectedDay:  (day)  => set({ selectedDay: day }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setShowNotes:    (val)  => set({ showNotes: val }),

  // ── New mode setters ──────────────────────────────────────────────────────
  setActiveMode: (mode) => set({
    activeMode: mode,
    mobilitySubLayer: null,
    mobilityScores: {},
    mobilityOverlayGeoJSON: null,
    mobilityHighlightRoute: null,
    showTransitStops: false,
    showCyclingParking: false,
    selectedMobilityDistrict: null,
  }),

  setMobilitySubLayer: (layer) => set(s => ({
    mobilitySubLayer: s.mobilitySubLayer === layer ? null : layer,
    mobilityScores: {},
    mobilityOverlayGeoJSON: null,
    mobilityHighlightRoute: null,
    showCyclingParking: false,
    selectedMobilityDistrict: null,
  })),

  setMobilityScores:         (scores) => set({ mobilityScores: scores }),
  setMobilityOverlayGeoJSON: (gj)     => set({ mobilityOverlayGeoJSON: gj }),
  setMobilityDataLoading:    (val)    => set({ mobilityDataLoading: val }),
  setMobilityDataCache: (key, data)   => set(s => ({
    mobilityDataCache: { ...s.mobilityDataCache, [key]: data },
  })),
  setMobilityHighlightRoute: (id) => set({ mobilityHighlightRoute: id }),

  // ── Transit stops setters ─────────────────────────────────────────────────
  setTransitStopsGeoJSON: (gj)  => set({ transitStopsGeoJSON: gj }),
  toggleTransitStops:     ()    => set(s => ({ showTransitStops: !s.showTransitStops })),

  // ── Cycling parking setters ───────────────────────────────────────────────
  setCyclingParkingGeoJSON: (gj) => set({ cyclingParkingGeoJSON: gj }),
  toggleCyclingParking:     ()   => set(s => ({ showCyclingParking: !s.showCyclingParking })),

  // ── District selection setter ─────────────────────────────────────────────
  setSelectedMobilityDistrict: (name) => set(s => ({
    selectedMobilityDistrict: s.selectedMobilityDistrict === name ? null : name,
  })),
}))
