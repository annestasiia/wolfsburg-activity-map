import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'

const NAV_W   = 228
const SERIF = "'Georgia', 'Times New Roman', serif"
const SANS  = "system-ui, -apple-system, sans-serif"

// 'geo' is removed from the main list — it lives inside Hub System submenu
const SECTIONS = [
  { id: 'strategy',   label: 'Post-Car Strategy',      num: '01' },
  { id: 'capacity',   label: 'Capacity Analysis',      num: '02' },
  { id: 'hub',        label: 'Hub System',             num: '03', hasSubmenu: true },
  { id: 'urban',      label: 'Urban Design',           num: '04' },
  { id: 'simulation', label: 'Operational Simulation', num: '05' },
]

const HUB_SUBMENU = [
  { id: 'geo', label: 'Geo Data Analysis',        desc: 'Mobility · Facilities · Greenery' },
  { id: 'hub', label: 'Hubs Placement Algorithm', desc: 'Hub L · M · S network'            },
]

export default function LeftNav() {
  const { activeSection, setActiveSection, navOpen, setNavOpen } = useAppStore()
  const [hoveredId, setHoveredId] = useState(null)
  const [hubSubmenuOpen, setHubSubmenuOpen] = useState(false)

  const isHubRelated = activeSection === 'geo' || activeSection === 'hub'

  const handleSectionClick = (id, hasSubmenu) => {
    if (hasSubmenu) {
      setHubSubmenuOpen(v => !v)
      return
    }
    setActiveSection(id)
    setHubSubmenuOpen(false)
  }

  const handleSubmenuClick = (id) => {
    setActiveSection(id)
    setHubSubmenuOpen(false)
  }

  const handleCollapse = () => {
    setNavOpen(false)
    setHubSubmenuOpen(false)
  }

  return (
    <>
      {/* ── Hub System submenu panel ─────────────────────────────────────── */}
      {hubSubmenuOpen && navOpen && (
        <div style={{
          position: 'fixed',
          left: NAV_W,
          top: 0,
          bottom: 0,
          width: 220,
          zIndex: 399,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderLeft: '1px solid rgba(0,0,0,0.06)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Submenu header */}
          <div style={{ padding: '28px 20px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: '#bbb', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
              Hub System
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: '#111', lineHeight: 1.3 }}>
              Select analysis
            </div>
          </div>

          {/* Submenu items */}
          <div style={{ flex: 1, padding: '12px 0' }}>
            {HUB_SUBMENU.map(({ id, label, desc }) => {
              const isActive = activeSection === id
              const isHov   = hoveredId === `sub-${id}`
              return (
                <button
                  key={id}
                  onClick={() => handleSubmenuClick(id)}
                  onMouseEnter={() => setHoveredId(`sub-${id}`)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 3,
                    padding: '12px 20px',
                    width: '100%',
                    background: isActive ? '#111111' : isHov ? 'rgba(0,0,0,0.05)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #111' : '3px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease',
                  }}
                >
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#ffffff' : '#111111',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 10,
                    color: isActive ? 'rgba(255,255,255,0.55)' : '#aaa',
                    letterSpacing: '-0.005em',
                  }}>
                    {desc}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Close submenu button */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button
              onClick={() => setHubSubmenuOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: SANS, fontSize: 11, color: '#aaa',
                display: 'flex', alignItems: 'center', gap: 5, padding: 0,
              }}
            >
              ← back
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsed handle ─────────────────────────────────────────────── */}
      {!navOpen && (
        <button
          onClick={() => setNavOpen(true)}
          title="Open navigation"
          style={{
            position: 'fixed',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 401,
            width: 20,
            padding: '24px 2px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.09)',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            boxShadow: '2px 0 16px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: 11,
          }}
        >
          ›
        </button>
      )}

      {/* ── Main nav panel ───────────────────────────────────────────────── */}
      {navOpen && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: NAV_W,
          zIndex: 400,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRight: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.07)',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* Header */}
          <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: '#bbb', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
                Research · 2026
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: '#111', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                Post-Car<br />Wolfsburg
              </div>
            </div>
            {/* Collapse arrow */}
            <button
              onClick={handleCollapse}
              title="Collapse menu"
              style={{
                background: 'none', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6,
                cursor: 'pointer', padding: '4px 7px', color: '#999', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2, flexShrink: 0,
              }}
            >
              ‹
            </button>
          </div>

          {/* Section buttons */}
          <div style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
            {SECTIONS.map(({ id, label, num, hasSubmenu }) => {
              const isActive  = hasSubmenu ? isHubRelated : activeSection === id
              const isHov     = hoveredId === id
              const isSubmenu = hasSubmenu && hubSubmenuOpen

              return (
                <button
                  key={id}
                  onClick={() => handleSectionClick(id, hasSubmenu)}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 20px',
                    background: isActive ? '#111111' : isHov ? 'rgba(0,0,0,0.05)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid #111' : '3px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 10,
                    color: isActive ? 'rgba(255,255,255,0.45)' : '#ccc',
                    letterSpacing: '0.06em',
                    width: 18,
                    flexShrink: 0,
                  }}>
                    {num}
                  </span>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#ffffff' : '#111111',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.35,
                    flex: 1,
                  }}>
                    {label}
                  </span>
                  {hasSubmenu && (
                    <span style={{
                      fontFamily: SANS,
                      fontSize: 11,
                      color: isActive ? 'rgba(255,255,255,0.5)' : '#bbb',
                      transform: isSubmenu ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s ease',
                      display: 'inline-block',
                    }}>
                      ›
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: SANS, fontSize: 10, color: '#bbb', lineHeight: 1.8 }}>
              Wolfsburg City Centre<br />
              4 km² · 9 districts
            </div>
          </div>

        </div>
      )}
    </>
  )
}
