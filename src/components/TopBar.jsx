import React from 'react'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'

const MODES = [
  { id: 'mobility',   label: 'Mobility'   },
  { id: 'facilities', label: 'Facilities' },
  { id: 'greenery',   label: 'Greenery'   },
]

export default function TopBar() {
  const { activeMode, setActiveMode, selectedDay, selectedTime } = useAppStore()
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

      <div className="top-bar-meta">
        <div>{selectedDay} · {selectedTime}</div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-tertiary)' }}>
          {filteredVenues.length} venues
        </div>
      </div>
    </header>
  )
}
