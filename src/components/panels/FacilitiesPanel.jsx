import React from 'react'
import { useAppStore } from '../../store/appStore'
import { CATEGORIES } from '../../constants'

const ICONS = { Schools: '🏫', Culture: '🎭', Leisure: '🌳', Commercial: '🛍️' }

export default function FacilitiesPanel() {
  const { selectedCategories, toggleCategory, venues } = useAppStore()

  const counts = {}
  CATEGORIES.forEach(c => { counts[c.name] = venues.filter(v => v.category === c.name).length })

  return (
    <div>
      <p className="panel-label">Facility Categories</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {CATEGORIES.map(c => {
          const on = selectedCategories.has(c.name)
          return (
            <button
              key={c.name}
              onClick={() => toggleCategory(c.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 16px',
                borderRadius: 14,
                background: on ? `${c.color}12` : '#F5F5F7',
                border: `1px solid ${on ? c.color + '40' : 'rgba(0,0,0,0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{ICONS[c.name]}</span>
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: on ? '#1D1D1F' : '#6E6E73',
                  marginBottom: 2,
                  transition: 'color 0.2s',
                }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 13, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
                  {counts[c.name]} venues
                </span>
              </span>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: on ? c.color : '#E8E8ED',
                boxShadow: on ? `0 0 6px ${c.color}60` : 'none',
                transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                flexShrink: 0,
              }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
