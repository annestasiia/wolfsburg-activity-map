import React, { useState, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { useDistricts } from './hooks/useDistricts'
import { useFilters } from './hooks/useFilters'
import FileUpload from './components/FileUpload'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import VenuePopup from './components/VenuePopup'
import { DAYS } from './constants'

export default function App() {
  useDistricts() // fetch OSM boundaries on startup

  const { fileUploaded, selectedDay, selectedTime, boundariesError } = useAppStore()
  const { filteredVenues, openCount } = useFilters()

  const [selectedVenue, setSelectedVenue] = useState(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)

  const handleVenueClick = useCallback((props) => setSelectedVenue(props), [])

  const dayLabel  = selectedDay
  const timeLabel = selectedTime

  if (!fileUploaded) return <FileUpload />

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* ── Top bar ── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-100 bg-white z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(o => !o)}
          >
            ☰
          </button>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">
            Wolfsburg Activity Map
          </span>
        </div>
        <div className="text-xs text-gray-400 hidden sm:block">
          {filteredVenues.length} venues visible
          &nbsp;·&nbsp;
          {openCount} open
          &nbsp;·&nbsp;
          {dayLabel} {timeLabel}
        </div>
      </header>

      {/* ── Boundary warning ── */}
      {boundariesError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-700 z-10">
          ⚠ District boundaries unavailable (Overpass API unreachable). Venue data is unaffected.
        </div>
      )}

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar venueCount={filteredVenues.length} openCount={openCount} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-40 flex">
            <div className="flex-shrink-0">
              <Sidebar venueCount={filteredVenues.length} openCount={openCount} />
            </div>
            <div
              className="flex-1 bg-black bg-opacity-30"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapView onVenueClick={handleVenueClick} />

          {/* Venue detail popup (React portal over the map) */}
          {selectedVenue && (
            <VenuePopup
              venue={selectedVenue}
              onClose={() => setSelectedVenue(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
