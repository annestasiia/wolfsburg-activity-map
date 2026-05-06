import React, { useState, useRef } from 'react'
import GreeneryPanel from './panels/GreeneryPanel'

const MIN_WIDTH     = 220
const MAX_WIDTH     = 540
const DEFAULT_WIDTH = 300

export default function GreenerySidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [width, setWidth]   = useState(DEFAULT_WIDTH)

  const handleResizeStart = (e) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = width

    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX))
      setWidth(newWidth)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Closed state — small vertical tab ──────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Open Greenery Layers"
        style={{
          position:       'absolute',
          left:            12,
          top:            '50%',
          transform:      'translateY(-50%)',
          zIndex:          10,
          background:     'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border:         '1px solid rgba(0,0,0,0.08)',
          borderRadius:    12,
          padding:        '14px 10px',
          cursor:         'pointer',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:             8,
          boxShadow:      '0 4px 16px rgba(0,0,0,0.10)',
          fontFamily:     'inherit',
        }}
      >
        <span style={{ fontSize: 18 }}>🌿</span>
        <span style={{
          writingMode:    'vertical-rl',
          fontSize:        12,
          fontWeight:      600,
          color:          '#2D6A4F',
          letterSpacing:  '-0.01em',
        }}>
          Greenery
        </span>
      </button>
    )
  }

  // ── Open state — sidebar + resize handle ───────────────────────────────────
  return (
    <div style={{
      position:      'absolute',
      left:           0,
      top:            0,
      bottom:         0,
      width:          width + 6,   // +6 for the resize handle strip
      zIndex:         10,
      display:       'flex',
      pointerEvents: 'none',       // let map clicks through the transparent handle area
    }}>
      {/* ── Panel ── */}
      <div style={{
        width:              width,
        flexShrink:         0,
        background:        'rgba(255,255,255,0.93)',
        backdropFilter:    'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight:       '1px solid rgba(0,0,0,0.08)',
        boxShadow:         '4px 0 24px rgba(0,0,0,0.09)',
        display:           'flex',
        flexDirection:     'column',
        overflow:          'hidden',
        pointerEvents:     'auto',
      }}>
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 18px 13px',
          borderBottom:   '1px solid rgba(0,0,0,0.06)',
          flexShrink:      0,
        }}>
          <span style={{
            fontSize:       15,
            fontWeight:     600,
            color:         '#1D1D1F',
            letterSpacing: '-0.02em',
          }}>
            🌿 Greenery Layers
          </span>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background:   '#F5F5F7',
              border:       '1px solid rgba(0,0,0,0.08)',
              borderRadius:  8,
              padding:      '4px 9px',
              fontSize:      13,
              color:        '#6E6E73',
              cursor:       'pointer',
              fontFamily:   'inherit',
              lineHeight:    1,
              transition:   'all 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 20px' }}>
          <GreeneryPanel noTitle />
        </div>
      </div>

      {/* ── Resize handle ── */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          width:          6,
          flexShrink:     0,
          cursor:        'col-resize',
          pointerEvents: 'auto',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
        }}
      >
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:            4,
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width:        3,
              height:       3,
              borderRadius: '50%',
              background:   'rgba(0,0,0,0.22)',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
