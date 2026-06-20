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

  // ── Landing page ─────────────────────────────────────────────────────────
  showLanding: true,
  setShowLanding: (v) => set({ showLanding: v }),
  // Lightweight mode setter for landing scroll — no state resets
  setLandingSectionMode: (section, mode) => set({ activeSection: section, activeMode: mode }),

  // ── Navigation sidebar ───────────────────────────────────────────────────
  navOpen: true,
  setNavOpen: (v) => set({ navOpen: v }),

  // ── Top-level section ────────────────────────────────────────────────────
  activeSection: null,  // null | 'strategy' | 'geo' | 'capacity' | 'hub' | 'urban' | 'simulation'

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
  autoShowRoutes: true,
  autoShowHeatmap: false,
  autoShowParking: false,
  autoParkingGeoJSON: null,

  // ── Transit (Public Transport) options ────────────────────────────────────
  transitShowRegional: true,
  transitShowRoutes: true,
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
  showGrid: false,

  // ── Map view reset trigger (incremented → MapView flies home) ─────────────
  mapResetViewTrigger: 0,

  // ── Facilities: selected venue for left sidebar detail ───────────────────
  selectedFacilityVenueId: null,

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
  setSelectedFacilityVenueId: (id) => set({ selectedFacilityVenueId: id }),

  setActiveSection: (section) => set((state) => ({
    activeSection: section,
    activeMode: section === 'geo' ? 'mobility' : section === 'hub' ? 'intermodal' : state.activeMode,
  })),

  // ── Mode switch: overlay/score data is preserved as cache across mode changes ─
  setActiveMode: (mode) => set({
    activeMode: mode,
    selectedFacilityVenueId: null,
    activeMobilityModes: new Set(),
    mobilityHighlightRoute: null,
    autoShowRegional: true, autoShowRoutes: true, autoShowHeatmap: false, autoShowParking: false,
    transitShowRegional: true, transitShowRoutes: true, transitShowHeatmap: false, transitShowBusStops: false,
    cyclingShowRegional: true, cyclingShowRoutes: true,
    cyclingShowLeisureRoutes: true, cyclingShowBikeParking: false,
    cyclingHighlightLeisureRoute: null,
    selectedMobilityDistrict: null,
    showFacilitiesInMobility: false,
    intermodalSelectedHub: null,
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
  toggleAutoShowRoutes:   () => set(s => ({ autoShowRoutes:   !s.autoShowRoutes   })),
  toggleAutoShowHeatmap:  () => set(s => ({ autoShowHeatmap:  !s.autoShowHeatmap  })),
  toggleAutoShowParking:  () => set(s => ({ autoShowParking:  !s.autoShowParking  })),
  setAutoParkingGeoJSON:  (gj) => set({ autoParkingGeoJSON: gj }),

  // ── Transit setters ───────────────────────────────────────────────────────
  toggleTransitShowRegional: () => set(s => ({ transitShowRegional: !s.transitShowRegional })),
  toggleTransitShowRoutes:   () => set(s => ({ transitShowRoutes:   !s.transitShowRoutes   })),
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

  // ── Local GeoJSON library (loaded once from public/ on app start) ────────────
  localBusStops: null,
  localCarParkings: null,
  localBikeParkings: null,
  localFacilities: null,
  localHistoric: null,
  localParksForests: null,
  localCycling: null,

  setLocalBusStops:    (v) => set({ localBusStops: v }),
  setLocalCarParkings:  (v) => set({ localCarParkings: v }),
  setLocalBikeParkings: (v) => set({ localBikeParkings: v }),
  setLocalFacilities:   (v) => set({ localFacilities: v }),
  setLocalHistoric:     (v) => set({ localHistoric: v }),
  setLocalParksForests: (v) => set({ localParksForests: v }),
  setLocalCycling:      (v) => set({ localCycling: v }),

  // ── Intermodal density config ─────────────────────────────────────────────────
  densityConfig: { high: 400, medium: 700, low: 1000 },
  setDensityConfig: (key, val) => set(s => ({ densityConfig: { ...s.densityConfig, [key]: Math.max(50, Math.min(3000, val)) } })),

  // ── Intermodal Hub ────────────────────────────────────────────────────────
  intermodalLoading: false,
  intermodalError: null,
  intermodalHubs: [],
  intermodalRawBusStops: null,
  intermodalRawCarParkings: null,
  intermodalRawBikeParkings: null,
  intermodalRawOsmFacilities: null,
  intermodalRawForests: null,
  intermodalRawResidential: null,
  intermodalLoadProgress: '',

  // base layer toggles (data layers section)
  intermodalShowBusStops: false,
  intermodalShowCarParkings: false,
  intermodalShowBikeParkings: false,
  intermodalShowFacilities: false,
  intermodalFacilityCategories: new Set(['culture', 'commercial', 'educational', 'leisure', 'healthcare', 'other']),
  intermodalShowParksBase: false,

  // hub type filter (which pie-chart types to show)
  intermodalHubTypes: new Set(['bus_bike', 'auto_bike', 'auto_bus_bike']),

  // status filter: 'all' | 'existing' | 'proposed'
  intermodalStatusFilter: 'all',

  // radius layers
  intermodalShowFacilitiesRadius: false,
  intermodalShowGreeneryRadius: false,
  intermodalShowFacilitiesPoints: false,
  intermodalShowParksOverlay: false,

  // object size scale (intermodal only)
  intermodalObjectScale: 1.0,

  // currently open hub popup
  intermodalSelectedHub: null,

  setIntermodalLoading: (val) => set({ intermodalLoading: val }),
  setIntermodalError:   (msg) => set({ intermodalError: msg }),
  setIntermodalHubs:    (hubs) => set({ intermodalHubs: hubs }),
  setIntermodalLoadProgress: (msg) => set({ intermodalLoadProgress: msg }),
  setIntermodalRawData: (busStops, carParkings, bikeParkings, osmFacilities, forests, residential) => set({
    intermodalRawBusStops: busStops,
    intermodalRawCarParkings: carParkings,
    intermodalRawBikeParkings: bikeParkings,
    intermodalRawOsmFacilities: osmFacilities,
    intermodalRawForests: forests ?? null,
    intermodalRawResidential: residential ?? null,
  }),

  toggleIntermodalShowBusStops:     () => set(s => ({ intermodalShowBusStops:     !s.intermodalShowBusStops     })),
  toggleIntermodalShowCarParkings:  () => set(s => ({ intermodalShowCarParkings:  !s.intermodalShowCarParkings  })),
  toggleIntermodalShowBikeParkings: () => set(s => ({ intermodalShowBikeParkings: !s.intermodalShowBikeParkings })),
  toggleIntermodalShowFacilities:   () => set(s => ({ intermodalShowFacilities:   !s.intermodalShowFacilities   })),
  toggleIntermodalShowParksBase:    () => set(s => ({ intermodalShowParksBase:    !s.intermodalShowParksBase    })),

  toggleIntermodalFacilityCategory: (cat) => set(s => {
    const next = new Set(s.intermodalFacilityCategories)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    return { intermodalFacilityCategories: next }
  }),

  toggleIntermodalHubType: (type) => set(s => {
    const next = new Set(s.intermodalHubTypes)
    next.has(type) ? next.delete(type) : next.add(type)
    return { intermodalHubTypes: next }
  }),

  setIntermodalStatusFilter: (f) => set({ intermodalStatusFilter: f }),

  toggleIntermodalFacilitiesRadius: () => set(s => ({ intermodalShowFacilitiesRadius: !s.intermodalShowFacilitiesRadius })),
  toggleIntermodalGreeneryRadius:   () => set(s => ({ intermodalShowGreeneryRadius:   !s.intermodalShowGreeneryRadius   })),
  toggleIntermodalFacilitiesPoints: () => set(s => ({ intermodalShowFacilitiesPoints: !s.intermodalShowFacilitiesPoints })),
  toggleIntermodalParksOverlay:     () => set(s => ({ intermodalShowParksOverlay:     !s.intermodalShowParksOverlay     })),

  setIntermodalObjectScale: (v) => set({ intermodalObjectScale: Math.max(0.5, Math.min(2.0, v)) }),
  setIntermodalSelectedHub: (hub) => set({ intermodalSelectedHub: hub }),

  // ── Rad Network ──────────────────────────────────────────────────────────
  radNodes: [], radEdges: [], radGaps: [],
  radLoading: false, radError: null, radLoadProgress: '',
  radRawHistoric: null, radRawVillages: null,

  radShowBusStops: false, radShowCarParkings: false, radShowBikeParkings: false,
  radShowFacilities: false, radShowHistoric: false, radShowParks: false,
  radHubTypes: new Set(['bus_bike', 'auto_bike', 'auto_bus_bike']),
  radHubObjectScale: 1.0,
  radShowAutoRoads: false, radShowPedestrianRoads: false, radShowCycling: false,
  radShowAutoHeatmap: false, radShowPedHeatmap: false,
  radStatusFilter: 'all', radShowGaps: false,
  radSelectedNode: null, radSelectedEdge: null,

  setRadNodes:         (v) => set({ radNodes: v }),
  setRadEdges:         (v) => set({ radEdges: v }),
  setRadGaps:          (v) => set({ radGaps: v }),
  setRadLoading:       (v) => set({ radLoading: v }),
  setRadError:         (v) => set({ radError: v }),
  setRadLoadProgress:  (v) => set({ radLoadProgress: v }),
  setRadRawData:       (historic, villages) => set({ radRawHistoric: historic, radRawVillages: villages }),
  setRadStatusFilter:  (v) => set({ radStatusFilter: v }),
  setRadSelectedNode:  (v) => set({ radSelectedNode: v }),
  setRadSelectedEdge:  (v) => set({ radSelectedEdge: v }),

  toggleRadShowBusStops:       () => set(s => ({ radShowBusStops:       !s.radShowBusStops       })),
  toggleRadShowCarParkings:    () => set(s => ({ radShowCarParkings:    !s.radShowCarParkings    })),
  toggleRadShowBikeParkings:   () => set(s => ({ radShowBikeParkings:   !s.radShowBikeParkings   })),
  toggleRadShowFacilities:     () => set(s => ({ radShowFacilities:     !s.radShowFacilities     })),
  toggleRadShowHistoric:       () => set(s => ({ radShowHistoric:       !s.radShowHistoric       })),
  toggleRadShowParks:          () => set(s => ({ radShowParks:          !s.radShowParks          })),
  toggleRadShowAutoRoads:      () => set(s => ({ radShowAutoRoads:      !s.radShowAutoRoads      })),
  toggleRadShowPedestrianRoads:() => set(s => ({ radShowPedestrianRoads:!s.radShowPedestrianRoads})),
  toggleRadShowCycling:        () => set(s => ({ radShowCycling:        !s.radShowCycling        })),
  toggleRadShowAutoHeatmap:    () => set(s => ({ radShowAutoHeatmap:    !s.radShowAutoHeatmap    })),
  toggleRadShowPedHeatmap:     () => set(s => ({ radShowPedHeatmap:     !s.radShowPedHeatmap     })),
  toggleRadShowGaps:           () => set(s => ({ radShowGaps:           !s.radShowGaps           })),
  toggleRadHubType: (type) => set(s => {
    const next = new Set(s.radHubTypes)
    next.has(type) ? next.delete(type) : next.add(type)
    return { radHubTypes: next }
  }),
  setRadHubObjectScale: (v) => set({ radHubObjectScale: Math.max(0.5, Math.min(2.0, v)) }),

  // ── Hub Network: city population (drives capacity → hub area computation) ──
  hubPopulation: 130000,
  setHubPopulation: (v) => set({ hubPopulation: Math.max(130000, Math.min(250000, v)) }),

  // ── Hub L/M analysis ─────────────────────────────────────────────────────
  hubLMConfig: {
    requiredAreaL: 15233,
    requiredAreaM: 7002,
    minDistL: 800,
    minDistM: 500,
    hubSCoverageRadius: 1000,
  },
  hubLMResults: null,
  hubLMRunning: false,
  hubLMStatus: '',

  // Hub S bus_bike results (computed within hub-network mode)
  hubSBusOnly: [],
  setHubSBusOnly: (hubs) => set({ hubSBusOnly: hubs }),

  // layer visibility
  hubLMShowL: true,
  hubLMShowM: true,
  hubLMShowS: true,
  hubLMShowCoverageL: false,
  hubLMShowCoverageM: false,
  hubLMShowCoverageS: false,
  hubLMShowCandidatesL: false,
  hubLMShowCandidatesM: false,
  hubLMSStatusFilter: 'all',

  // selected hub for popup
  hubLMSelectedHub: null,

  setHubLMConfig: (key, val) => set(s => ({ hubLMConfig: { ...s.hubLMConfig, [key]: val } })),
  setHubLMResults: (results) => set({ hubLMResults: results }),
  setHubLMRunning: (val, status = '') => set({ hubLMRunning: val, hubLMStatus: status }),
  toggleHubLMShowL:           () => set(s => ({ hubLMShowL:           !s.hubLMShowL           })),
  toggleHubLMShowM:           () => set(s => ({ hubLMShowM:           !s.hubLMShowM           })),
  toggleHubLMShowS:           () => set(s => ({ hubLMShowS:           !s.hubLMShowS           })),
  toggleHubLMShowCoverageL:   () => set(s => ({ hubLMShowCoverageL:   !s.hubLMShowCoverageL   })),
  toggleHubLMShowCoverageM:   () => set(s => ({ hubLMShowCoverageM:   !s.hubLMShowCoverageM   })),
  toggleHubLMShowCoverageS:   () => set(s => ({ hubLMShowCoverageS:   !s.hubLMShowCoverageS   })),
  toggleHubLMShowCandidatesL: () => set(s => ({ hubLMShowCandidatesL: !s.hubLMShowCandidatesL })),
  toggleHubLMShowCandidatesM: () => set(s => ({ hubLMShowCandidatesM: !s.hubLMShowCandidatesM })),
  setHubLMSStatusFilter:      (f) => set({ hubLMSStatusFilter: f }),
  setHubLMSelectedHub:        (h) => set({ hubLMSelectedHub: h }),

  // ── Export trigger (TopBar → MapView) ────────────────────────────────────
  exportPNGTrigger: 0,
  incrementExportTrigger: () => set(s => ({ exportPNGTrigger: s.exportPNGTrigger + 1 })),

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
  toggleShowGrid:       () => set(s => ({ showGrid: !s.showGrid })),

  // ── Reset all settings (does not clear loaded data caches) ────────────────
  resetAll: () => set(s => ({
    selectedDistricts: new Set(),
    selectedCategories: new Set(CATEGORIES.map(c => c.name)),
    selectedDay: getCurrentDayAbbr(),
    selectedTime: getCurrentTimeStr(),
    showNotes: true,
    activeMobilityModes: new Set(),
    autoShowRegional: true, autoShowHeatmap: false, autoShowParking: false,
    transitShowRegional: true, transitShowHeatmap: false, transitShowBusStops: false,
    cyclingShowRegional: true, cyclingShowRoutes: true,
    cyclingShowLeisureRoutes: true, cyclingShowBikeParking: false,
    cyclingHighlightLeisureRoute: null,
    mobilityHighlightRoute: null,
    selectedMobilityDistrict: null,
    showFacilitiesInMobility: false,
    showAllBorders: false,
    showDistrictNames: false,
    showGrid: false,
    showParks: false, showWater: false, showForest: false, showBuildingPlots: false,
    intermodalShowBusStops: false,
    intermodalShowCarParkings: false,
    intermodalShowBikeParkings: false,
    intermodalShowFacilities: false,
    intermodalFacilityCategories: new Set(['culture', 'commercial', 'educational', 'leisure', 'healthcare', 'other']),
    intermodalShowParksBase: false,
    intermodalHubTypes: new Set(['bus_bike', 'auto_bike', 'auto_bus_bike']),
    intermodalStatusFilter: 'all',
    intermodalShowFacilitiesRadius: false,
    intermodalShowGreeneryRadius: false,
    intermodalShowFacilitiesPoints: false,
    intermodalShowParksOverlay: false,
    intermodalObjectScale: 1.0,
    intermodalSelectedHub: null,
    intermodalLoadProgress: '',
    intermodalRawResidential: null,
    radNodes: [], radEdges: [], radGaps: [],
    radShowBusStops: false, radShowCarParkings: false, radShowBikeParkings: false,
    radShowFacilities: false, radShowHistoric: false, radShowParks: false,
    radHubTypes: new Set(['bus_bike', 'auto_bike', 'auto_bus_bike']),
    radHubObjectScale: 1.0,
    radShowAutoRoads: false, radShowPedestrianRoads: false, radShowCycling: false,
    radShowAutoHeatmap: false, radShowPedHeatmap: false,
    radStatusFilter: 'all', radShowGaps: false,
    radSelectedNode: null, radSelectedEdge: null,
    radLoadProgress: '',
    greenSocialActiveAnalysis: null,
    showSocialAmenities: false,
    showGreenSocialMap: true,
    showGreeneryDistrictBorders: false,
    greeneryCategoryToggles: {},
    greeneryTagToggles: {},
    greeneryOthersTagToggles: {},
    activeBottomPanel: null,
    mapResetViewTrigger: s.mapResetViewTrigger + 1,
  })),
}))
