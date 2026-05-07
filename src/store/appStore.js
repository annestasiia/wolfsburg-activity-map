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
  showParks: false,
  showWater: false,
  showForest: false,
  buildings: null,
  showBuildingPlots: false,

  // ── Legacy multi-mode (kept for internal use) ─────────────────────────────
  activeModes: new Set(['infrastructure']),
  activeBottomPanel: null,

  // ── Top-level analysis mode ───────────────────────────────────────────────
  activeMode: 'mobility',  // 'mobility' | 'facilities' | 'greenery'

  // ── Mobility: multi-select transport modes ────────────────────────────────
  activeMobilityModes: new Set(),  // 'automobile' | 'transport' | 'cycling'

  // ── Mobility data (shared cache, per-mode results) ────────────────────────
  mobilityDataCache: {},        // { modeKey: raw OSM elements }
  mobilityDataLoading: false,
  mobilityScoresPerMode: {},    // { modeKey: { districtName: score 0-10 } }
  mobilityOverlayPerMode: {},   // { modeKey: GeoJSON FeatureCollection }
  mobilityHighlightRoute: null, // transport route relation ID

  // ── Automobile options ────────────────────────────────────────────────────
  autoShowRegional: true,
  autoShowHeatmap: false,
  autoShowParking: false,
  autoParkingGeoJSON: null,

  // ── Transit (Public Transport) options ────────────────────────────────────
  transitShowRegional: true,
  transitShowHeatmap: false,
  transitShowBusStops: false,
  transitStopsGeoJSON: null,

  // ── Cycling options ───────────────────────────────────────────────────────
  cyclingShowRegional: true,
  cyclingShowRoutes: true,           // cycling infrastructure paths
  cyclingShowLeisureRoutes: true,    // named leisure route relations
  cyclingShowBikeParking: false,
  cyclingParkingGeoJSON: null,
  cyclingRoutesGeoJSON: null,
  cyclingHighlightLeisureRoute: null,

  // ── District selection (mobility map click) ───────────────────────────────
  selectedMobilityDistrict: null,

  // ── Facilities overlay in Mobility mode ──────────────────────────────────
  showFacilitiesInMobility: false,

  // ── Global map overlays ───────────────────────────────────────────────────
  showAllBorders: false,
  showDistrictNames: false,

  // ── Non-mobility filters ──────────────────────────────────────────────────
  selectedDistricts: new Set(),
  selectedCategories: new Set(CATEGORIES.map(c => c.name)),
  selectedDay: getCurrentDayAbbr(),
  selectedTime: getCurrentTimeStr(),
  showNotes: true,

  // ── Base setters ──────────────────────────────────────────────────────────
  setVenues:            (venues)   => set({ venues }),
  setGeocodingProgress: (progress) => set({ geocodingProgress: progress }),
  setGeocodingSkipped:  (n)        => set({ geocodingSkipped: n }),
  setFileUploaded:      (val)      => set({ fileUploaded: val }),

  setDistrictBoundaries: (b)   => set({ districtBoundaries: b }),
  setBoundariesLoading:  (val) => set({ boundariesLoading: val }),
  setBoundariesError:    (msg) => set({ boundariesError: msg }),
  setParks:      (parks)      => set({ parks }),
  setWater:      (water)      => set({ water }),
  setForest:     (forest)     => set({ forest }),
  setBuildings:  (buildings)  => set({ buildings }),
  setRoads:      (roads)      => set({ roads }),
  setFootways:   (footways)   => set({ footways }),

  toggleMode: (mode) => set(s => {
    const next = new Set(s.activeModes)
    next.has(mode) ? next.delete(mode) : next.add(mode)
    return { activeModes: next }
  }),

  setActiveBottomPanel: (panel) => set(s => ({
    activeBottomPanel: s.activeBottomPanel === panel ? null : panel,
  })),

  toggleParks:         () => set(s => ({ showParks:         !s.showParks         })),
  toggleWater:         () => set(s => ({ showWater:         !s.showWater         })),
  toggleForest:        () => set(s => ({ showForest:        !s.showForest        })),
  toggleBuildingPlots: () => set(s => ({ showBuildingPlots: !s.showBuildingPlots })),

  toggleDistrict: (name) => set(s => {
    const next = new Set(s.selectedDistricts)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedDistricts: next }
  }),
  selectAllDistricts: () => set({ selectedDistricts: new Set(DISTRICTS.map(d => d.name)) }),
  clearAllDistricts:  () => set({ selectedDistricts: new Set() }),

  toggleCategory: (name) => set(s => {
    const next = new Set(s.selectedCategories)
    next.has(name) ? next.delete(name) : next.add(name)
    return { selectedCategories: next }
  }),

  setSelectedDay:  (day)  => set({ selectedDay: day }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  setShowNotes:    (val)  => set({ showNotes: val }),

  // ── Mode switch: reset all mobility state ─────────────────────────────────
  setActiveMode: (mode) => set({
    activeMode: mode,
    activeMobilityModes: new Set(),
    mobilityScoresPerMode: {},
    mobilityOverlayPerMode: {},
    mobilityHighlightRoute: null,
    autoShowRegional: true, autoShowHeatmap: false, autoShowParking: false,
    transitShowRegional: true, transitShowHeatmap: false, transitShowBusStops: false,
    cyclingShowRegional: true, cyclingShowRoutes: true,
    cyclingShowLeisureRoutes: true, cyclingShowBikeParking: false,
    cyclingHighlightLeisureRoute: null,
    selectedMobilityDistrict: null,
    showFacilitiesInMobility: false,
  }),

  // ── Mobility multi-mode toggle ────────────────────────────────────────────
  toggleMobilityMode: (mode) => set(s => {
    const next = new Set(s.activeMobilityModes)
    next.has(mode) ? next.delete(mode) : next.add(mode)
    return { activeMobilityModes: next, selectedMobilityDistrict: null }
  }),

  // ── Mobility data setters ─────────────────────────────────────────────────
  setMobilityDataLoading: (val) => set({ mobilityDataLoading: val }),
  setMobilityDataCache: (key, data) => set(s => ({
    mobilityDataCache: { ...s.mobilityDataCache, [key]: data },
  })),
  setMobilityScoresForMode: (mode, scores) => set(s => ({
    mobilityScoresPerMode: { ...s.mobilityScoresPerMode, [mode]: scores },
  })),
  setMobilityOverlayForMode: (mode, gj) => set(s => ({
    mobilityOverlayPerMode: { ...s.mobilityOverlayPerMode, [mode]: gj },
  })),
  setMobilityHighlightRoute: (id) => set({ mobilityHighlightRoute: id }),

  // ── Automobile setters ────────────────────────────────────────────────────
  toggleAutoShowRegional: () => set(s => ({ autoShowRegional: !s.autoShowRegional })),
  toggleAutoShowHeatmap:  () => set(s => ({ autoShowHeatmap:  !s.autoShowHeatmap  })),
  toggleAutoShowParking:  () => set(s => ({ autoShowParking:  !s.autoShowParking  })),
  setAutoParkingGeoJSON:  (gj) => set({ autoParkingGeoJSON: gj }),

  // ── Transit setters ───────────────────────────────────────────────────────
  toggleTransitShowRegional: () => set(s => ({ transitShowRegional: !s.transitShowRegional })),
  toggleTransitShowHeatmap:  () => set(s => ({ transitShowHeatmap:  !s.transitShowHeatmap  })),
  toggleTransitShowBusStops: () => set(s => ({ transitShowBusStops: !s.transitShowBusStops })),
  setTransitStopsGeoJSON:    (gj) => set({ transitStopsGeoJSON: gj }),

  // ── Cycling setters ───────────────────────────────────────────────────────
  toggleCyclingShowRegional:      () => set(s => ({ cyclingShowRegional:      !s.cyclingShowRegional      })),
  toggleCyclingShowRoutes:        () => set(s => ({ cyclingShowRoutes:        !s.cyclingShowRoutes        })),
  toggleCyclingShowLeisureRoutes: () => set(s => ({ cyclingShowLeisureRoutes: !s.cyclingShowLeisureRoutes })),
  toggleCyclingShowBikeParking:   () => set(s => ({ cyclingShowBikeParking:   !s.cyclingShowBikeParking   })),
  setCyclingParkingGeoJSON:       (gj) => set({ cyclingParkingGeoJSON: gj }),
  setCyclingRoutesGeoJSON:        (gj) => set({ cyclingRoutesGeoJSON: gj }),
  setCyclingHighlightLeisureRoute:(id) => set({ cyclingHighlightLeisureRoute: id }),

  // ── District selection ────────────────────────────────────────────────────
  setSelectedMobilityDistrict: (name) => set(s => ({
    selectedMobilityDistrict: s.selectedMobilityDistrict === name ? null : name,
  })),

  // ── GSA district hover popup ──────────────────────────────────────────────
  hoveredGSADistrict: null,   // { name, score, rank, total } | null
  setHoveredGSADistrict: (d) => set({ hoveredGSADistrict: d }),

  // ── GSA configurable weights ──────────────────────────────────────────────
  coverageWeights: {
    parks_recreation: 3.0, forests_woods: 3.0,
    protected_conservation: 2.5, natural_vegetation: 2.5,
    grass_open_green: 2.0, agriculture_planted: 1.0,
    individual_vegetation: 0.5, others: 0.5,
  },
  encounterWeights: { green: 35, social: 30, transit: 20, paths: 15 },

  setCoverageWeight: (key, val) => set(s => ({
    coverageWeights: { ...s.coverageWeights, [key]: val },
  })),
  setEncounterWeight: (key, val) => set(s => ({
    encounterWeights: { ...s.encounterWeights, [key]: val },
  })),
  resetCoverageWeights: () => set({
    coverageWeights: {
      parks_recreation: 3.0, forests_woods: 3.0,
      protected_conservation: 2.5, natural_vegetation: 2.5,
      grass_open_green: 2.0, agriculture_planted: 1.0,
      individual_vegetation: 0.5, others: 0.5,
    },
  }),
  resetEncounterWeights: () => set({
    encounterWeights: { green: 35, social: 30, transit: 20, paths: 15 },
  }),

  // ── GSA info modal ────────────────────────────────────────────────────────
  gssInfoModal: null,   // null | 'coverage' | 'social' | 'accessibility' | 'encounter'
  setGSSInfoModal: (id) => set({ gssInfoModal: id }),

  // ── Green Social Infrastructure Analysis state ────────────────────────────
  greenSocialActiveAnalysis: null,  // 'coverage' | 'social' | 'encounter' | 'accessibility'
  greenSocialScores:         {},
  greenSocialError:          null,
  socialAmenitiesGeoJSON:    null,
  socialAmenitiesLoading:    false,
  showSocialAmenities:       false,
  showGreenSocialMap:        true,

  setGreenSocialActiveAnalysis: (type) => set({
    greenSocialActiveAnalysis: type,
    greenSocialScores: {},
    greenSocialError: null,
  }),
  setGreenSocialScores:      (scores) => set({ greenSocialScores: scores }),
  setGreenSocialError:       (msg)    => set({ greenSocialError: msg }),
  setSocialAmenitiesGeoJSON: (gj)     => set({ socialAmenitiesGeoJSON: gj }),
  setSocialAmenitiesLoading: (val)    => set({ socialAmenitiesLoading: val }),
  toggleShowSocialAmenities: ()       => set(s => ({ showSocialAmenities: !s.showSocialAmenities })),
  toggleShowGreenSocialMap:  ()       => set(s => ({ showGreenSocialMap:  !s.showGreenSocialMap  })),

  // ── Greenery state ────────────────────────────────────────────────────────
  greeneryGeoJSON:              null,
  greeneryQueryVersion:         0,
  greeneryDataLoading:          false,
  greeneryDataError:            null,
  showGreeneryDistrictBorders:  false,
  greeneryCategoryToggles:      {},
  greeneryTagToggles:           {},
  greeneryOthersTagToggles:     {},

  setGreeneryGeoJSON:            (gj, version) => set({ greeneryGeoJSON: gj, greeneryQueryVersion: version }),
  setGreeneryDataLoading:        (val) => set({ greeneryDataLoading: val }),
  setGreeneryDataError:          (msg) => set({ greeneryDataError: msg }),
  toggleGreeneryDistrictBorders: ()    => set(s => ({ showGreeneryDistrictBorders: !s.showGreeneryDistrictBorders })),

  toggleGreeneryCategory: (id) => set(s => ({
    greeneryCategoryToggles: {
      ...s.greeneryCategoryToggles,
      [id]: s.greeneryCategoryToggles[id] === false ? true : false,
    },
  })),

  toggleGreeneryTag: (catId, key, value) => set(s => {
    const k = `${catId}__${key}__${value}`
    return {
      greeneryTagToggles: {
        ...s.greeneryTagToggles,
        [k]: s.greeneryTagToggles[k] === false ? true : false,
      },
    }
  }),

  toggleGreeneryOthersTag: (key, value) => set(s => {
    const k = `${key}__${value}`
    return {
      greeneryOthersTagToggles: {
        ...s.greeneryOthersTagToggles,
        [k]: s.greeneryOthersTagToggles[k] === false ? true : false,
      },
    }
  }),

  toggleFacilitiesInMobility: () => set(s => ({ showFacilitiesInMobility: !s.showFacilitiesInMobility })),

  // ── Global overlays ───────────────────────────────────────────────────────
  toggleShowAllBorders: () => set(s => ({ showAllBorders: !s.showAllBorders })),
  toggleDistrictNames:  () => set(s => ({ showDistrictNames: !s.showDistrictNames })),
}))
