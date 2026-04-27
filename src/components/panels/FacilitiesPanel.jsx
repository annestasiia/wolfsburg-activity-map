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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
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
                borderRadius: 12,
                background: on ? `${c.color}20` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${on ? c.color + '50' : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{ICONS[c.name]}</span>
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: on ? '#fff' : 'rgba(255,255,255,0.48)',
                  marginBottom: 2,
                  transition: 'color 0.2s',
                }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
                  {counts[c.name]} venues
                </span>
              </span>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: on ? c.color : 'rgba(255,255,255,0.1)',
                boxShadow: on ? `0 0 8px ${c.color}` : 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
