import React from 'react'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'

const MODES = [
  { id: 'pedestrian',     label: 'Pedestrian'     },
  { id: 'transport',      label: 'Transport'      },
  { id: 'infrastructure', label: 'Infrastructure' },
]

export default function TopBar() {
  const { activeModes, toggleMode, selectedDay, selectedTime } = useAppStore()
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
            className={`mode-btn ${m.id} ${activeModes.has(m.id) ? 'active' : ''}`}
            onClick={() => toggleMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="top-bar-meta">
        <div>{selectedDay} · {selectedTime}</div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,0.18)' }}>
          {filteredVenues.length} venues
        </div>
      </div>
    </header>
  )
}
