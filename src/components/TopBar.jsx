import React from 'react'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'

const MODES = [
  { id: 'mobility',   label: 'Mobility'   },
  { id: 'facilities', label: 'Facilities' },
  { id: 'greenery',   label: 'Greenery'   },
]

export default function TopBar() {
  const { activeMode, setActiveMode, selectedDay, selectedTime, showAllBorders, toggleShowAllBorders } = useAppStore()
  const { filteredVenues } = useFilters()

  return (
    <header className="top-bar">
      <div className="top-bar-logo">
        Wolfsburg<em>·</em>Map
      </div>

      <div className="mode-buttons">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-btn ${m.id} ${activeMode === m.id ? 'active' : ''}`}
            onClick={() => setActiveMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Global: show all district borders in light gray */}
      <button
        onClick={toggleShowAllBorders}
        style={{
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
          border:        `1px solid ${showAllBorders ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)'}`,
          background:     showAllBorders ? '#E8E8ED' : 'var(--bg-secondary)',
          color:          showAllBorders ? '#1D1D1F' : 'var(--text-secondary)',
          transition:    'all 0.18s ease',
          whiteSpace:    'nowrap',
        }}
      >
        <span style={{ fontSize: 14, opacity: 0.7 }}>⬡</span>
        Show all borders
      </button>

      <div className="top-bar-meta">
        <div>{selectedDay} · {selectedTime}</div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-tertiary)' }}>
          {filteredVenues.length} venues
        </div>
      </div>
    </header>
  )
}
