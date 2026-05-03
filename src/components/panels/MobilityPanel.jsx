import React from 'react'
import { useAppStore } from '../../store/appStore'

const SUB_LAYERS = [
  { id: 'transport',  label: 'Public Transport',         icon: '🚌' },
  { id: 'automobile', label: 'Automobile Transport',     icon: '🚗' },
  { id: 'cycling',    label: 'Cycling Accessibility',    icon: '🚲' },
  { id: 'pedestrian', label: 'Pedestrian Accessibility', icon: '🚶' },
]

export default function MobilityPanel() {
  const { mobilitySubLayer, setMobilitySubLayer, mobilityDataLoading } = useAppStore()

  return (
    <div>
      <p className="panel-label">Mobility Analysis</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {SUB_LAYERS.map(s => {
          const active  = mobilitySubLayer === s.id
          const loading = active && mobilityDataLoading
          return (
            <button
              key={s.id}
              onClick={() => setMobilitySubLayer(s.id)}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            8,
                padding:        '16px 12px',
                borderRadius:   14,
                background:     active ? '#E63946' : '#F5F5F7',
                border:         `1px solid ${active ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                cursor:         'pointer',
                transition:     'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fontFamily:     'inherit',
                opacity:        loading ? 0.75 : 1,
                boxShadow:      active ? '0 2px 10px rgba(230,57,70,0.30)' : 'none',
              }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>
                {loading ? '⏳' : s.icon}
              </span>
              <span style={{
                fontSize:      13,
                fontWeight:    500,
                color:         active ? '#FFFFFF' : '#1D1D1F',
                textAlign:     'center',
                lineHeight:    1.3,
                letterSpacing: '-0.01em',
              }}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
      {mobilitySubLayer && !mobilityDataLoading && (
        <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 12, letterSpacing: '-0.01em' }}>
          Districts colored by number of connections to Stadtmitte
        </p>
      )}
      {mobilityDataLoading && (
        <p style={{ fontSize: 13, color: '#AEAEB2', marginTop: 12, letterSpacing: '-0.01em' }}>
          Loading network data…
        </p>
      )}
    </div>
  )
}
