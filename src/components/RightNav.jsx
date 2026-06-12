import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'

const SECTIONS = [
  { id: 'strategy',   label: 'Post-Car Strategy',      num: '01' },
  { id: 'geo',        label: 'Geo-Data Analysis',      num: '02' },
  { id: 'capacity',   label: 'Capacity Analysis',      num: '03' },
  { id: 'hub',        label: 'Hub System',             num: '04' },
  { id: 'urban',      label: 'Urban Design',           num: '05' },
  { id: 'simulation', label: 'Operational Simulation', num: '06' },
]

const SERIF = "'Georgia', 'Times New Roman', serif"
const SANS  = "system-ui, -apple-system, sans-serif"

export default function RightNav() {
  const { activeSection, setActiveSection } = useAppStore()
  const [hovered, setHovered] = useState(false)

  const isCollapsed = activeSection !== null && !hovered
  const W = isCollapsed ? 6 : 228

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: W,
        zIndex: 400,
        transition: 'width 320ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex',
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thin handle strip */}
      <div style={{
        width: 6,
        flexShrink: 0,
        background: activeSection !== null ? 'rgba(0,0,0,0.13)' : 'transparent',
        cursor: activeSection !== null ? 'pointer' : 'default',
        transition: 'background 0.2s ease',
      }} />

      {/* Nav panel */}
      <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '32px 24px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: '#bbb', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
            Research · 2026
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 16, color: '#111', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            Post-Car<br />Wolfsburg
          </div>
        </div>

        {/* Section buttons */}
        <div style={{ flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SECTIONS.map(({ id, label, num }) => {
            const active = activeSection === id
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 24px',
                  background: active ? '#111111' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #111' : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  color: active ? 'rgba(255,255,255,0.45)' : '#ccc',
                  letterSpacing: '0.06em',
                  width: 18,
                  flexShrink: 0,
                }}>
                  {num}
                </span>
                <span style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#ffffff' : '#333333',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.35,
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: SANS, fontSize: 10, color: '#bbb', lineHeight: 1.8 }}>
            Wolfsburg City Centre<br />
            4 km² · 9 districts
          </div>
        </div>

      </div>
    </div>
  )
}
