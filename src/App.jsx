import React, { useState, useCallback, useEffect } from 'react'
import { useAppStore } from './store/appStore'
import TopBar from './components/TopBar'
import BottomBar from './components/BottomBar'
import MapView from './components/MapView'
import VenuePopup from './components/VenuePopup'
import GreenerySidebar from './components/GreenerySidebar'
import MobilityToolbar from './components/MobilityToolbar'
import MobilityLeftBar from './components/MobilityLeftBar'
import FacilityToolbar from './components/FacilityToolbar'
import LeftSidebar from './components/LeftSidebar'
import DistrictStatsPopup from './components/DistrictStatsPopup'
import AnalysisInfoModal from './components/panels/AnalysisInfoModal'
import IntermodalSidebar, { IntermodalDataPanel } from './components/IntermodalSidebar'
import IntermodalHubPopup from './components/IntermodalHubPopup'
import RadSidebar, { RadNodePopup, RadEdgePopup } from './components/RadSidebar'
import venuesData from './data/venues.json'
import districtBoundariesData from './data/districtBoundaries.json'
import parksData from './data/parks.json'
import waterData from './data/water.json'
import forestData from './data/forest.json'
import buildingsData from './data/buildings.json'

export default function App() {
  const { setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways, activeMode, setSelectedFacilityVenueId } = useAppStore()
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
  }, [setVenues, setDistrictBoundaries, setParks, setWater, setForest, setBuildings, setRoads, setFootways])

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
        {activeMode === 'facilities' && <FacilityToolbar />}
        {selectedVenue && activeMode !== 'facilities' && (
          <VenuePopup
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
          />
        )}
        {activeMode === 'greenery'    && <GreenerySidebar />}
        {activeMode === 'intermodal' && <IntermodalSidebar />}
        {activeMode === 'intermodal' && <IntermodalDataPanel />}
        {activeMode === 'intermodal' && <IntermodalHubPopup />}
        {activeMode === 'rad' && <RadSidebar />}
        {activeMode === 'rad' && <RadNodePopup />}
        {activeMode === 'rad' && <RadEdgePopup />}
        <DistrictStatsPopup />
        <AnalysisInfoModal />
      </main>
      <BottomBar />
    </div>
  )
}
