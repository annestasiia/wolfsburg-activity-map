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
import venuesData from './data/venues.json'
import districtBoundariesData from './data/districtBoundaries.json'
import parksData from './data/parks.json'
import waterData from './data/water.json'
import forestData from './data/forest.json'
import buildingsData from './data/buildings.json'

const SERIF = "'Georgia', 'Times New Roman', serif"
const SANS  = "system-ui, -apple-system, sans-serif"

function LandingOverlay() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        maxWidth: 540,
        padding: '52px 60px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderRadius: 20,
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontFamily: SANS,
          fontSize: 10,
          fontWeight: 700,
          color: '#aaa',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          Research Pitch · Wolfsburg 2026
        </div>
        <h1 style={{
          fontFamily: SERIF,
          fontSize: 28,
          fontWeight: 400,
          color: '#111',
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          margin: '0 0 22px',
        }}>
          The Post-Car Wolfsburg<br />
          <span style={{ color: '#555' }}>Spatial Strategy for a Car-Free City Centre</span>
        </h1>
        <p style={{
          fontFamily: SERIF,
          fontSize: 16,
          color: '#444',
          lineHeight: 1.75,
          margin: '0 0 14px',
        }}>
          A city where no one owns a private car. All mobility is shared —
          electric, autonomous, and on-demand.
        </p>
        <p style={{
          fontFamily: SERIF,
          fontSize: 16,
          color: '#666',
          lineHeight: 1.75,
          margin: 0,
        }}>
          This is not a car-free city in the traditional sense of banning vehicles.
          It is a city where car ownership itself becomes obsolete — replaced by a system
          that is more convenient, more equitable, and more efficient than private ownership ever was.
        </p>
        <div style={{
          marginTop: 28,
          paddingTop: 22,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          fontFamily: SANS,
          fontSize: 12,
          color: '#aaa',
          letterSpacing: '-0.01em',
        }}>
          Select a section from the right to begin →
        </div>
      </div>
    </div>
  )
}

function UrbanPlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: '#ccc', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16 }}>In Development</div>
        <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: '#ddd', letterSpacing: '-0.02em' }}>Urban Design</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: '#ccc', marginTop: 12 }}>Coming soon</div>
      </div>
    </div>
  )
}

function SimulationPlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: '#ccc', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16 }}>In Development</div>
        <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: '#ddd', letterSpacing: '-0.02em' }}>Operational Simulation</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: '#ccc', marginTop: 12 }}>Coming soon</div>
      </div>
    </div>
  )
}

export default function App() {
  const {
    setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways,
    activeSection, activeMode, setSelectedFacilityVenueId,
    setLocalBusStops, setLocalCarParkings, setLocalBikeParkings,
    setLocalFacilities, setLocalHistoric, setLocalParksForests, setLocalCycling,
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
      ['wolfsburg_cycling.geojson',      setLocalCycling],
    ]
    for (const [filename, setter] of localFiles) {
      fetch(`${import.meta.env.BASE_URL}${filename}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setter(data) })
        .catch(() => {})
    }
  }, [setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways,
      setLocalBusStops, setLocalCarParkings, setLocalBikeParkings, setLocalFacilities, setLocalHistoric, setLocalParksForests, setLocalCycling])

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

  return (
    <div className="app-shell">
      <TopBar />
      <main className="map-area">
        {/* Map always rendered as base layer */}
        <MapView onVenueClick={handleVenueClick} />

        {/* ── Landing ── */}
        {activeSection === null && <LandingOverlay />}

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
        {activeSection === 'urban'      && <UrbanPlaceholder />}
        {activeSection === 'simulation' && <SimulationPlaceholder />}

        {/* ── Always visible map UI ── */}
        {(inGeo || inHub) && <DistrictStatsPopup />}
        {(inGeo || inHub) && <AnalysisInfoModal />}
      </main>
      <BottomBar />
      <RightNav />
    </div>
  )
}
