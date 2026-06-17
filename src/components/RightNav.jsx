import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SECTIONS = [
  { id: 'strategy',   label: 'Post-Car Strategy',      num: '01' },
  { id: 'capacity',   label: 'Capacity Analysis',      num: '02' },
  { id: 'hub',        label: 'Hub System',             num: '03', hasSubmenu: true },
  { id: 'urban',      label: 'Urban Design',           num: '04' },
  { id: 'simulation', label: 'Operational Simulation', num: '05' },
]

const HUB_SUBMENU = [
  { id: 'geo',      label: 'Geo Data Analysis',        desc: 'Mobility · Facilities · Greenery' },
  { id: 'hub',      label: 'Hubs Placement Algorithm', desc: 'Hub L · M · S network'            },
  { id: 'hub-algo', label: 'Hubs Algorithm Work',      desc: 'OSM · Data analysis · Method'     },
]

export default function LeftNav() {
  const { activeSection, setActiveSection, setActiveMode, navOpen, setNavOpen } = useAppStore()
  const [hoveredId, setHoveredId] = useState(null)
  const [hubSubmenuOpen, setHubSubmenuOpen] = useState(false)

  const isHubRelated = activeSection === 'geo' || activeSection === 'hub' || activeSection === 'hub-algo'
  const isMapSection = activeSection === 'hub' || activeSection === 'geo'

  // Auto-collapse nav for map sections, auto-expand for content sections
  useEffect(() => {
    if (isMapSection) {
      setNavOpen(false)
      setHubSubmenuOpen(false)
    } else {
      setNavOpen(true)
    }
  }, [activeSection])

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

  // hub-algo is a content page — nav should stay visible
  useEffect(() => {
    if (activeSection === 'hub-algo') setNavOpen(true)
  }, [activeSection])

  return (
    <>
      {/* ── Hub System submenu panel ─────────────────────────────────────── */}
      {hubSubmenuOpen && navOpen && (
        <div style={{
          position: 'fixed',
          left: 'var(--nav-w)',
          top: 0,
          bottom: 0,
          width: 'clamp(200px, 20vw, 260px)',
          zIndex: 399,
          background: '#FFFFFF',
          borderLeft: '1px solid #E8E8E8',
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Submenu header */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #E8E8E8' }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              03 — Hub System
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 400, color: '#888' }}>
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
                    gap: 3,
                    padding: '16px 24px',
                    width: '100%',
                    background: isActive ? '#111111' : isHov ? 'rgba(0,0,0,0.025)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #E8E8E8',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#ffffff' : '#111111',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 11,
                    fontWeight: 400,
                    color: isActive ? 'rgba(255,255,255,0.55)' : '#999',
                    lineHeight: 1.4,
                    letterSpacing: '0',
                  }}>
                    {desc}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid #E8E8E8' }}>
            <button
              onClick={() => setHubSubmenuOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: SANS, fontSize: 12, color: '#999',
                display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                letterSpacing: '0.02em',
              }}
            >
              ← back
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsed handle — thin 1px line ─────────────────────────────── */}
      {!navOpen && (
        <div
          style={{
            position: 'fixed', left: 0, top: 0, bottom: 0,
            width: 1, zIndex: 401, background: '#E8E8E8', cursor: 'pointer',
          }}
          onClick={() => setNavOpen(true)}
          title="Open navigation"
        >
          <button
            onClick={() => setNavOpen(true)}
            title="Open navigation"
            style={{
              position: 'absolute', top: '50%', left: 0,
              transform: 'translateY(-50%)',
              width: 24, padding: '16px 4px',
              background: '#FFFFFF',
              border: '1px solid #E8E8E8', borderLeft: 'none',
              borderRadius: '0 2px 2px 0',
              boxShadow: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: 12, fontFamily: SANS,
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
          left: 0, top: 0, bottom: 0,
          width: 'var(--nav-w)',
          zIndex: 400,
          background: '#FFFFFF',
          borderRight: '1px solid #E8E8E8',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* Header */}
          <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid #E8E8E8' }}>
            <div style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 700,
              color: '#999', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>
              Research · 2026
            </div>
            <div style={{
              fontFamily: SANS, fontSize: 22, fontWeight: 700,
              color: '#111111', letterSpacing: '-0.03em',
              lineHeight: 1.15, whiteSpace: 'nowrap',
            }}>
              Post-Car Wolfsburg
            </div>
          </div>

          {/* Section list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {SECTIONS.map(({ id, label, num, hasSubmenu }) => {
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
                    alignItems: 'center',
                    gap: 16,
                    padding: '15px 24px',
                    background: isActive ? '#111111' : isHov ? 'rgba(0,0,0,0.025)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #E8E8E8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {/* Number marker */}
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 10,
                    fontWeight: 700,
                    color: isActive ? 'rgba(255,255,255,0.4)' : '#ccc',
                    letterSpacing: '0.08em',
                    width: 20,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}>
                    {num}
                  </span>

                  {/* Label */}
                  <span style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#ffffff' : '#111111',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                    flex: 1,
                  }}>
                    {label}
                  </span>

                  {/* Submenu indicator */}
                  {hasSubmenu && (
                    <span style={{
                      fontFamily: SANS,
                      fontSize: 11,
                      color: isActive ? 'rgba(255,255,255,0.4)' : '#ccc',
                    }}>
                      ›
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Swiss-style footer rule */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #E8E8E8',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ width: 16, height: 1, background: '#111' }} />
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 700,
              color: '#999', letterSpacing: '0.10em', textTransform: 'uppercase',
            }}>
              Wolfsburg · 4 km²
            </span>
          </div>

        </div>
      )}
    </>
  )
}
