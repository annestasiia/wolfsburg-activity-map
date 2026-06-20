import React, { useState, useCallback, useEffect } from 'react'
import { useAppStore } from './store/appStore'
import TopBar from './components/TopBar'
import BottomBar from './components/BottomBar'
import MapView from './components/MapView'
import VenuePopup from './components/VenuePopup'
import GreenerySidebar from './components/GreenerySidebar'
import MobilityToolbar from './components/MobilityToolbar'
import MobilityLeftBar from './components/MobilityLeftBar'
import LeftSidebar from './components/LeftSidebar'
import DistrictStatsPopup from './components/DistrictStatsPopup'
import AnalysisInfoModal from './components/panels/AnalysisInfoModal'
import IntermodalSidebar, { IntermodalDataPanel } from './components/IntermodalSidebar'
import IntermodalHubPopup from './components/IntermodalHubPopup'
import RadSidebar, { RadDataPanel, RadNodePopup, RadEdgePopup } from './components/RadSidebar'
import CapacitySidebar from './components/CapacitySidebar'
import HubLMDataPanel from './components/HubLMDataPanel'
import HubLMHubPopup from './components/HubLMHubPopup'
import TransportPoolPanel from './components/TransportPoolPanel'
import DataPanel from './components/DataPanel'
import RightNav from './components/RightNav'
import StrategyPanel from './components/StrategyPanel'
import UrbanDesignPanel from './components/UrbanDesignPanel'
import HubAlgoPanel from './components/HubAlgoPanel'
import LandingPage from './components/LandingPage'
import venuesData from './data/venues.json'
import districtBoundariesData from './data/districtBoundaries.json'
import parksData from './data/parks.json'
import waterData from './data/water.json'
import forestData from './data/forest.json'
import buildingsData from './data/buildings.json'

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function SimulationPlaceholder() {
  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'var(--nav-w)', right: 0, zIndex: 10, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'left', borderLeft: '2px solid #E8E8E8', paddingLeft: 24 }}>
        <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: '#ccc', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>05 — In Development</div>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: '#ddd', letterSpacing: '-0.02em' }}>Operational Simulation</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: '#ccc', marginTop: 8 }}>Coming soon</div>
      </div>
    </div>
  )
}

export default function App() {
  const {
    setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways,
    activeSection, activeMode, setSelectedFacilityVenueId,
    setLocalBusStops, setLocalCarParkings, setLocalBikeParkings,
    setLocalFacilities, setLocalHistoric, setLocalParksForests, setLocalCycling, setLocalCyclingOfficial, setLocalBusRoutes, setLocalLandUse, setLocalCentrality,
    showLanding,
  } = useAppStore()
  const [selectedVenue, setSelectedVenue] = useState(null)

  useEffect(() => {
    setVenues(venuesData.filter(v => v.lat !== null && v.lng !== null))
    setDistrictBoundaries(districtBoundariesData)
    setParks(parksData)
    setWater(waterData)
    setForest(forestData)
    setBuildings(buildingsData)
    fetch(`${import.meta.env.BASE_URL}wolfsburg_roads.geojson`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRoads(data) })
      .catch(() => {})
    fetch(`${import.meta.env.BASE_URL}wolfsburg_footways.geojson`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFootways(data) })
      .catch(() => {})
    const localFiles = [
      ['wolfsburg_bus_stops.geojson',    setLocalBusStops],
      ['wolfsburg_car_parking.geojson',  setLocalCarParkings],
      ['wolfsburg_bike_parking.geojson', setLocalBikeParkings],
      ['wolfsburg_facilities.geojson',   setLocalFacilities],
      ['wolfsburg_historic.geojson',     setLocalHistoric],
      ['wolfsburg_parks_forests.geojson',setLocalParksForests],
      ['wolfsburg_cycling.geojson',          setLocalCycling],
      ['wolfsburg_cycling_official.geojson', setLocalCyclingOfficial],
      ['wolfsburg_bus_routes.geojson',       setLocalBusRoutes],
      ['wolfsburg_landuse.geojson',          setLocalLandUse],
      ['wolfsburg_centrality.geojson',       setLocalCentrality],
    ]
    for (const [filename, setter] of localFiles) {
      fetch(`${import.meta.env.BASE_URL}${filename}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setter(data) })
        .catch(() => {})
    }
  }, [setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways,
      setLocalBusStops, setLocalCarParkings, setLocalBikeParkings, setLocalFacilities, setLocalHistoric, setLocalParksForests, setLocalCycling, setLocalCyclingOfficial, setLocalBusRoutes, setLocalLandUse, setLocalCentrality])

  const handleVenueClick = useCallback((props) => {
    if (activeSection !== 'geo') return
    if (activeMode === 'facilities') {
      setSelectedFacilityVenueId(props.id)
    } else {
      setSelectedVenue(props)
    }
  }, [activeSection, activeMode, setSelectedFacilityVenueId])

  const inGeo = activeSection === 'geo'
  const inHub = activeSection === 'hub'

  if (showLanding) {
    return <LandingPage />
  }

  return (
    <div className="app-shell">
      <TopBar />

      <main className="map-area">
        <MapView onVenueClick={handleVenueClick} />

        {/* ── Geo-Data Analysis tools ── */}
        {inGeo && activeMode === 'mobility'   && <MobilityLeftBar />}
        {inGeo && activeMode === 'mobility'   && <MobilityToolbar />}
        {inGeo && activeMode === 'facilities' && <LeftSidebar />}
        {inGeo && activeMode === 'greenery'   && <GreenerySidebar />}
        {inGeo && activeMode === 'greenery'   && <TransportPoolPanel />}
        {inGeo && activeMode === 'facilities' && <TransportPoolPanel />}
        {inGeo && selectedVenue && activeMode !== 'facilities' && (
          <VenuePopup venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
        )}

        {/* ── Hub System tools ── */}
        {inHub && activeMode === 'intermodal'  && <IntermodalSidebar />}
        {inHub && activeMode === 'intermodal'  && <IntermodalDataPanel />}
        {inHub && activeMode === 'intermodal'  && <IntermodalHubPopup />}
        {inHub && activeMode === 'rad'         && <RadSidebar />}
        {inHub && activeMode === 'rad'         && <RadDataPanel />}
        {inHub && activeMode === 'rad'         && <RadNodePopup />}
        {inHub && activeMode === 'rad'         && <RadEdgePopup />}
        {inHub && activeMode === 'hub-network' && <CapacitySidebar />}
        {inHub && activeMode === 'hub-network' && <HubLMDataPanel />}
        {inHub && activeMode === 'hub-network' && <HubLMHubPopup />}

        {/* ── Section panels ── */}
        {activeSection === 'strategy'   && <StrategyPanel />}
        {activeSection === 'capacity'   && <DataPanel />}
        {activeSection === 'urban'      && <UrbanDesignPanel />}
        {activeSection === 'simulation' && <SimulationPlaceholder />}
        {activeSection === 'hub-algo'   && <HubAlgoPanel />}

        {/* ── Always visible map UI ── */}
        {(inGeo || inHub) && <DistrictStatsPopup />}
        {(inGeo || inHub) && <AnalysisInfoModal />}
      </main>

      <BottomBar />
      <RightNav />
    </div>
  )
}
