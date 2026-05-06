import React from 'react'
import { useAppStore } from '../store/appStore'

const MODES = [
  { id: 'automobile', label: 'Automobile', sub: 'Transport', icon: '🚗', color: '#3D3D3F' },
  { id: 'transport',  label: 'Public',     sub: 'Transport', icon: '🚌', color: '#0077FF' },
  { id: 'cycling',    label: 'Cycling',    sub: 'Access',    icon: '🚲', color: '#00C853' },
]

export default function MobilityLeftBar() {
  const { activeMobilityModes, toggleMobilityMode, mobilityDataLoading } = useAppStore()

  return (
    <div style={{
      position:       'absolute',
      left:            10,
      top:             112,
      zIndex:          10,
      display:        'flex',
      flexDirection:  'column',
      gap:             8,
    }}>
      {MODES.map(m => {
        const active = activeMobilityModes.has(m.id)
        return (
          <button
            key={m.id}
            onClick={() => toggleMobilityMode(m.id)}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:             4,
              padding:        '12px 14px',
              borderRadius:    16,
              background:      active ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.80)',
              backdropFilter:  'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border:         `1.5px solid ${active ? m.color : 'rgba(0,0,0,0.08)'}`,
              boxShadow:       active
                ? `0 2px 12px ${m.color}38, 0 1px 4px rgba(0,0,0,0.08)`
                : '0 2px 8px rgba(0,0,0,0.08)',
              cursor:         'pointer',
              fontFamily:     'inherit',
              transition:     'all 0.2s ease',
              minWidth:        72,
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>
              {mobilityDataLoading && active ? '⏳' : m.icon}
            </span>
            <span style={{
              fontSize:      11,
              fontWeight:    700,
              color:          active ? m.color : '#6E6E73',
              lineHeight:    1.2,
              letterSpacing: '-0.01em',
            }}>
              {m.label}
            </span>
            <span style={{
              fontSize: 10,
              color:     active ? m.color : '#AEAEB2',
              lineHeight: 1.2,
            }}>
              {m.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}
