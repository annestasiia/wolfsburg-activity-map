import React from 'react'
import { useAppStore } from '../../store/appStore'
import { DISTRICTS } from '../../constants'

function toRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function DistrictsPanel() {
  const { selectedDistricts, toggleDistrict, selectAllDistricts, clearAllDistricts } = useAppStore()
  const allSelected = selectedDistricts.size === DISTRICTS.length

  return (
    <div>
      <p className="panel-label">Districts — {selectedDistricts.size}/{DISTRICTS.length} selected</p>
      <div className="chip-grid" style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
        {DISTRICTS.map(d => {
          const on = selectedDistricts.has(d.name)
          return (
            <button
              key={d.name}
              className={`chip ${on ? 'active' : ''}`}
              style={on ? {
                background: toRgba(d.color, 0.22),
                borderColor: d.color,
                boxShadow: `0 0 8px ${toRgba(d.color, 0.28)}`,
              } : {}}
              onClick={() => toggleDistrict(d.name)}
            >
              {d.name}
            </button>
          )
        })}
      </div>
      <div className="chip-actions">
        <button className="chip-action-btn" onClick={allSelected ? clearAllDistricts : selectAllDistricts}>
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
        {selectedDistricts.size > 0 && !allSelected && (
          <button
            className="chip-action-btn"
            onClick={clearAllDistricts}
            style={{ color: 'rgba(255,90,90,0.7)' }}
          >
            Clear ({selectedDistricts.size})
          </button>
        )}
      </div>
    </div>
  )
}
