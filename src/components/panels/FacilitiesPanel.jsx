import React from 'react'
import { useAppStore } from '../../store/appStore'
import { CATEGORIES } from '../../constants'

const ICONS = { Schools: '🏫', Culture: '🎭', Leisure: '🌳', Commercial: '🛍️' }

export default function FacilitiesPanel({ noTitle }) {
  const {
    selectedCategories, toggleCategory, venues,
    showBuildingPlots, toggleBuildingPlots,
  } = useAppStore()

  const counts = {}
  CATEGORIES.forEach(c => { counts[c.name] = venues.filter(v => v.category === c.name).length })

  return (
    <div>
      {!noTitle && <p className="panel-label">Facility Categories</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>

        {/* Building plots toggle */}
        <button
          onClick={toggleBuildingPlots}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 16px', borderRadius: 14, fontFamily: 'inherit',
            background: showBuildingPlots ? '#0097A712' : '#F5F5F7',
            border: `1px solid ${showBuildingPlots ? '#0097A740' : 'rgba(0,0,0,0.08)'}`,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>🏗️</span>
          <span style={{ flex: 1 }}>
            <span style={{
              display: 'block', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
              color: showBuildingPlots ? '#1D1D1F' : '#6E6E73', marginBottom: 2,
            }}>
              Building plots
            </span>
            <span style={{ fontSize: 13, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
              Activity · Accessibility
            </span>
          </span>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: showBuildingPlots ? '#0097A7' : '#E8E8ED',
            boxShadow: showBuildingPlots ? '0 0 6px #0097A760' : 'none',
          }} />
        </button>

        {CATEGORIES.map(c => {
          const on = selectedCategories.has(c.name)
          return (
            <button
              key={c.name}
              onClick={() => toggleCategory(c.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', borderRadius: 14, fontFamily: 'inherit',
                background: on ? `${c.color}12` : '#F5F5F7',
                border: `1px solid ${on ? c.color + '40' : 'rgba(0,0,0,0.08)'}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{ICONS[c.name]}</span>
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
                  color: on ? '#1D1D1F' : '#6E6E73', marginBottom: 2,
                }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 13, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
                  {counts[c.name]} venues
                </span>
              </span>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: on ? c.color : '#E8E8ED',
                boxShadow: on ? `0 0 6px ${c.color}60` : 'none',
              }} />
            </button>
          )
        })}
      </div>

      {showBuildingPlots && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#F5F5F7', borderRadius: 12 }}>
          {/* Accessibility — color saturation per category */}
          <p style={{ fontSize: 13, fontWeight: 600, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Color — Transport access
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {CATEGORIES.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 1, height: 10, borderRadius: 4,
                  background: `linear-gradient(to right, #ECEFF1, ${c.color})`,
                  border: '1px solid rgba(0,0,0,0.06)',
                }} />
                <span style={{ fontSize: 13, color: '#3A3A3C', width: 72 }}>{c.name}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 80 }}>
              <span style={{ fontSize: 13, color: '#AEAEB2' }}>No access</span>
              <span style={{ fontSize: 13, color: '#AEAEB2' }}>All modes</span>
            </div>
          </div>

          {/* Activity — opacity */}
          <p style={{ fontSize: 13, fontWeight: 600, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Opacity — Activity level
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {[0.15, 0.45, 0.70, 0.95].map((op, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 28, height: 18, borderRadius: 4,
                  background: `rgba(83,74,183,${op})`,
                  border: '1px solid rgba(0,0,0,0.06)',
                }} />
                <span style={{ fontSize: 13, color: '#AEAEB2' }}>
                  {['None', 'Low', 'Med', 'High'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
