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
import TransportPoolPanel from './components/TransportPoolPanel'
import DataPanel from './components/DataPanel'
import venuesData from './data/venues.json'
import districtBoundariesData from './data/districtBoundaries.json'
import parksData from './data/parks.json'
import waterData from './data/water.json'
import forestData from './data/forest.json'
import buildingsData from './data/buildings.json'

export default function App() {
  const {
    setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways,
    activeMode, setSelectedFacilityVenueId,
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
    // Local GeoJSON library
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
    if (activeMode === 'facilities') {
      setSelectedFacilityVenueId(props.id)
    } else {
      setSelectedVenue(props)
    }
  }, [activeMode, setSelectedFacilityVenueId])

  return (
    <div className="app-shell">
      <TopBar />
      <main className="map-area">
        <MapView onVenueClick={handleVenueClick} />
        {activeMode === 'mobility'   && <MobilityLeftBar />}
        {activeMode === 'mobility'   && <MobilityToolbar />}
        {activeMode === 'facilities' && <LeftSidebar />}
        {selectedVenue && activeMode !== 'facilities' && (
          <VenuePopup
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
          />
        )}
        {activeMode === 'greenery'    && <GreenerySidebar />}
        {activeMode === 'greenery'    && <TransportPoolPanel />}
        {activeMode === 'facilities'  && <TransportPoolPanel />}
        {activeMode === 'intermodal' && <IntermodalSidebar />}
        {activeMode === 'intermodal' && <IntermodalDataPanel />}
        {activeMode === 'intermodal' && <IntermodalHubPopup />}
        {activeMode === 'rad' && <RadSidebar />}
        {activeMode === 'rad' && <RadDataPanel />}
        {activeMode === 'rad' && <RadNodePopup />}
        {activeMode === 'rad' && <RadEdgePopup />}
        {activeMode === 'data' && <DataPanel />}
        <DistrictStatsPopup />
        <AnalysisInfoModal />
      </main>
      <BottomBar />
    </div>
  )
}
