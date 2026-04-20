import { useState, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { useDistricts } from './hooks/useDistricts'
import { useFilters } from './hooks/useFilters'
import FileUpload from './components/FileUpload'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import VenuePopup from './components/VenuePopup'
import { clearBoundaryCache } from './utils/fetchDistrict'

// Expose cache-clearing helper in the browser console for debugging
if (typeof window !== 'undefined') window.__clearBoundaryCache = clearBoundaryCache

export default function App() {
  const {
    activeBoundaries,
    selected,
    loading:  districtLoading,
    progress: districtProgress,
    error:    districtError,
    toggleDistrict,
    selectAll,
    clearAll,
  } = useDistricts()

  const { fileUploaded, selectedDay, selectedTime } = useAppStore()
  const { filteredVenues, openCount } = useFilters()

  const [selectedVenue, setSelectedVenue] = useState(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)

  const handleVenueClick = useCallback((props) => setSelectedVenue(props), [])

  if (!fileUploaded) return <FileUpload />

  const sidebarProps = {
    venueCount:       filteredVenues.length,
    openCount,
    districtSelected: selected,
    districtLoading,
    districtProgress,
    districtError,
    onToggleDistrict: toggleDistrict,
    onSelectAll:      selectAll,
    onClearAll:       clearAll,
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* ── Top bar ── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-100 bg-white z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
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
          {filteredVenues.length} venues visible &nbsp;·&nbsp;
          {openCount} open &nbsp;·&nbsp;
          {selectedDay} {selectedTime}
        </div>
      </header>

      {/* ── Boundary warning ── */}
      {districtError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-700 z-10">
          ⚠ District boundaries unavailable (Overpass API unreachable). Venue data is unaffected.
        </div>
      )}

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="hidden md:flex">
          <Sidebar {...sidebarProps} />
        </div>

        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-40 flex">
            <div className="flex-shrink-0">
              <Sidebar {...sidebarProps} />
            </div>
            <div
              className="flex-1 bg-black bg-opacity-30"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        <div className="flex-1 relative">
          <MapView activeBoundaries={activeBoundaries} onVenueClick={handleVenueClick} />
          {selectedVenue && (
            <VenuePopup venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
          )}
        </div>
      </div>
    </div>
  )
}
