import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'

const NAV_W   = Math.max(240, Math.min(320, Math.round(window.innerWidth * 0.25)))
const SANS  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = SANS

// 'geo' is removed from the main list — it lives inside Hub System submenu
const SECTIONS = [
  { id: 'strategy',   label: 'Post-Car Strategy',      num: '01', desc: 'City-wide mobility framework'    },
  { id: 'capacity',   label: 'Capacity Analysis',      num: '02', desc: 'Demand · Fleet · Peak hours'     },
  { id: 'hub',        label: 'Hub System',             num: '03', desc: 'Placement algorithm · Networks',  hasSubmenu: true },
  { id: 'urban',      label: 'Urban Design',           num: '04', desc: 'Streetscape · Public space'      },
  { id: 'simulation', label: 'Operational Simulation', num: '05', desc: 'Real-time modelling'             },
]

const HUB_SUBMENU = [
  { id: 'geo', label: 'Geo Data Analysis',        desc: 'Mobility · Facilities · Greenery' },
  { id: 'hub', label: 'Hubs Placement Algorithm', desc: 'Hub L · M · S network'            },
]

export default function LeftNav() {
  const { activeSection, setActiveSection, setActiveMode, navOpen, setNavOpen } = useAppStore()
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
    if (id === 'hub') setActiveMode('hub-network')
    if (id === 'geo') setActiveMode('mobility')
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
          background: '#FFFFFF',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderLeft: '1px solid #E8E8E8',
          borderRight: '1px solid #E8E8E8',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Submenu header */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #E8E8E8' }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 400, color: '#888888', letterSpacing: '0.04em', marginBottom: 6 }}>
              Hub System
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 400, color: '#111', lineHeight: 1.3 }}>
              Select analysis
            </div>
          </div>

          {/* Submenu items */}
          <div style={{ flex: 1 }}>
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
                    gap: 4,
                    padding: '18px 24px',
                    width: '100%',
                    background: isHov ? 'rgba(0,0,0,0.025)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #E8E8E8',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: SERIF,
                    fontSize: 17,
                    fontWeight: isActive ? 600 : 400,
                    color: '#111111',
                    lineHeight: 1.3,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 11,
                    fontWeight: 400,
                    color: '#888888',
                    lineHeight: 1.4,
                  }}>
                    {desc}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Close submenu button */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E8E8E8' }}>
            <button
              onClick={() => setHubSubmenuOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: SANS, fontSize: 13, color: '#aaa',
                display: 'flex', alignItems: 'center', gap: 5, padding: 0,
              }}
            >
              ← back
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsed handle — always visible strip ──────────────────────── */}
      {!navOpen && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 1,
          zIndex: 401,
          background: '#E8E8E8',
          cursor: 'pointer',
        }}
          onClick={() => setNavOpen(true)}
          title="Open navigation"
        >
          <button
            onClick={() => setNavOpen(true)}
            title="Open navigation"
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              transform: 'translateY(-50%)',
              width: 28,
              padding: '20px 4px',
              background: '#FFFFFF',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: '1px solid #E8E8E8',
              borderLeft: 'none',
              borderRadius: '0 4px 4px 0',
              boxShadow: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888888',
              fontSize: 13,
              fontWeight: 600,
              zIndex: 402,
            }}
          >
            ›
          </button>
        </div>
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
          background: '#FFFFFF',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderRight: '1px solid #E8E8E8',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* Header */}
          <div style={{ padding: '32px 24px 24px', borderBottom: '1px solid #E8E8E8', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 400, color: '#888888', letterSpacing: '0.04em', marginBottom: 6 }}>
                Research · 2026
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#111111', lineHeight: 1.3, letterSpacing: 0 }}>
                Post-Car<br />Wolfsburg
              </div>
            </div>
            {/* Collapse arrow */}
            <button
              onClick={handleCollapse}
              title="Collapse menu"
              style={{
                background: 'none', border: '1px solid #E8E8E8', borderRadius: 4,
                cursor: 'pointer', padding: '4px 7px', color: '#888888', fontSize: 13, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2, flexShrink: 0,
              }}
            >
              ‹
            </button>
          </div>

          {/* Section buttons */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {SECTIONS.map(({ id, label, num, desc, hasSubmenu }) => {
              const isActive  = hasSubmenu ? isHubRelated : activeSection === id
              const isHov     = hoveredId === id

              return (
                <button
                  key={id}
                  onClick={() => handleSectionClick(id, hasSubmenu)}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    padding: '18px 24px',
                    background: isHov ? 'rgba(0,0,0,0.025)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #E8E8E8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{
                    fontFamily: SERIF,
                    fontSize: 17,
                    fontWeight: isActive ? 600 : 400,
                    color: '#111111',
                    lineHeight: 1.3,
                  }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

        </div>
      )}
    </>
  )
}
