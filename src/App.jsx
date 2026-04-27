import React, { useState, useCallback, useEffect } from 'react'
import { useAppStore } from './store/appStore'
import TopBar from './components/TopBar'
import BottomBar from './components/BottomBar'
import MapView from './components/MapView'
import VenuePopup from './components/VenuePopup'
import venuesData from './data/venues.json'
import districtBoundariesData from './data/districtBoundaries.json'
import parksData from './data/parks.json'
import waterData from './data/water.json'
import forestData from './data/forest.json'

export default function App() {
  const { setVenues, setDistrictBoundaries, setParks, setWater, setForest, setRoads, setFootways } = useAppStore()
  const [selectedVenue, setSelectedVenue] = useState(null)

  useEffect(() => {
    setVenues(venuesData.filter(v => v.lat !== null && v.lng !== null))
    setDistrictBoundaries(districtBoundariesData)
    setParks(parksData)
    setWater(waterData)
    setForest(forestData)
    fetch(`${import.meta.env.BASE_URL}wolfsburg_roads.geojson`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRoads(data) })
      .catch(() => {})
    fetch(`${import.meta.env.BASE_URL}wolfsburg_footways.geojson`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFootways(data) })
      .catch(() => {})
  }, [setVenues, setDistrictBoundaries, setParks, setWater, setForest, setRoads, setFootways])

  const handleVenueClick = useCallback((props) => setSelectedVenue(props), [])

  return (
    <div className="app-shell">
      <TopBar />
      <main className="map-area">
        <MapView onVenueClick={handleVenueClick} />
        {selectedVenue && (
          <VenuePopup
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
          />
        )}
      </main>
      <BottomBar />
    </div>
  )
}
