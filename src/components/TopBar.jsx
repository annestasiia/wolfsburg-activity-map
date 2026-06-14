import React from 'react'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'

const GEO_MODES = [
  { id: 'mobility',   label: 'Mobility'   },
  { id: 'facilities', label: 'Facilities' },
  { id: 'greenery',   label: 'Greenery'   },
]

const HUB_MODES = [
  { id: 'hub-network', label: 'HUB' },
]

const pillStyle = (active) => ({
  display:       'flex',
  alignItems:    'center',
  gap:            6,
  padding:       '5px 12px',
  borderRadius:   980,
  fontSize:       13,
  fontWeight:     500,
  letterSpacing: '-0.01em',
  cursor:        'pointer',
  fontFamily:    'inherit',
  border:        `1px solid ${active ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)'}`,
  background:     active ? '#E8E8ED' : 'var(--bg-secondary)',
  color:          active ? '#1D1D1F' : 'var(--text-secondary)',
  transition:    'all 0.18s ease',
  whiteSpace:    'nowrap',
})

export default function TopBar() {
  const {
    activeSection,
    activeMode, setActiveMode,
    selectedDay, selectedTime,
    showAllBorders, toggleShowAllBorders,
    showDistrictNames, toggleDistrictNames,
    resetAll,
    incrementExportTrigger,
  } = useAppStore()
  const { filteredVenues } = useFilters()

  const showGeo = activeSection === 'geo'
  const showHub = activeSection === 'hub'
  const showControls = showGeo || showHub

  const modeTabs = showGeo ? GEO_MODES : showHub ? HUB_MODES : []

  return (
    <header className="top-bar">
      <div className="top-bar-logo">
        Wolfsburg<em>·</em>Map
      </div>

      {modeTabs.length > 0 && (
        <div className="mode-buttons">
          {modeTabs.map(m => (
            <button
              key={m.id}
              className={`mode-btn ${m.id} ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => setActiveMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {showControls && (
        <>
          <button onClick={resetAll} style={pillStyle(false)} title="Reset all filters and overlays">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 6.5A4.5 4.5 0 1 1 8 2.3" />
              <polyline points="8 1 8 3.5 10.5 3.5" />
            </svg>
            Reset
          </button>

          <button onClick={toggleDistrictNames} style={pillStyle(showDistrictNames)} title="Show district names on map">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="3" width="10" height="7" rx="1.5" />
              <line x1="4" y1="6.5" x2="9" y2="6.5" />
              <line x1="4" y1="8.5" x2="7" y2="8.5" />
            </svg>
            Districts
          </button>

          <button onClick={toggleShowAllBorders} style={pillStyle(showAllBorders)}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>⬡</span>
            Show all borders
          </button>

          <button onClick={incrementExportTrigger} style={pillStyle(false)} title="Download map as PNG">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1v8M4 6l3 3 3-3M1 10v1a2 2 0 002 2h8a2 2 0 002-2v-1" />
            </svg>
            Export PNG
          </button>

          <div className="top-bar-meta">
            <div>{selectedDay} · {selectedTime}</div>
            <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-tertiary)' }}>
              {filteredVenues.length} venues
            </div>
          </div>
        </>
      )}
    </header>
  )
}
