import React from 'react'
import { useAppStore } from '../store/appStore'

const ANALYSIS_META = {
  coverage:     { label: 'Green Coverage',         color: '#2D6A4F', icon: '🌳' },
  social:       { label: 'Social Infrastructure',  color: '#6B46C1', icon: '👥' },
  encounter:    { label: 'Encounter Potential',     color: '#C05621', icon: '✨' },
  accessibility:{ label: 'Green Accessibility',    color: '#2B6CB0', icon: '🚶' },
}

export default function DistrictStatsPopup() {
  const {
    hoveredGSADistrict,
    greenSocialActiveAnalysis,
    greenSocialScores,
    setHoveredGSADistrict,
  } = useAppStore()

  if (!hoveredGSADistrict || !greenSocialActiveAnalysis) return null

  const { name, score, rank, total } = hoveredGSADistrict
  const meta    = ANALYSIS_META[greenSocialActiveAnalysis] || ANALYSIS_META.coverage
  const color   = meta.color
  const allVals = Object.values(greenSocialScores).filter(v => isFinite(v))
  const avg     = allVals.length ? allVals.reduce((s, v) => s + v, 0) / allVals.length : 0
  const diff    = score - avg
  const diffLabel = diff >= 0
    ? `+${diff.toFixed(1)} above avg`
    : `${diff.toFixed(1)} below avg`
  const diffColor = diff >= 0 ? '#2D6A4F' : '#C05621'

  const pct = (score / 10) * 100

  return (
    <div style={{
      position:       'absolute',
      bottom:          48,
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:          30,
      background:     'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border:         `1.5px solid ${color}30`,
      borderRadius:    16,
      boxShadow:      `0 8px 32px rgba(0,0,0,0.13), 0 0 0 1px ${color}18`,
      padding:        '14px 22px',
      display:        'flex',
      alignItems:     'center',
      gap:             22,
      minWidth:        360,
      maxWidth:        520,
      pointerEvents:  'none',
    }}>
      {/* Score circle */}
      <div style={{
        width:          56,
        height:         56,
        borderRadius:  '50%',
        background:    `conic-gradient(${color} ${pct * 3.6}deg, #E8E8ED ${pct * 3.6}deg)`,
        display:       'flex',
        alignItems:    'center',
        justifyContent:'center',
        flexShrink:     0,
        position:      'relative',
      }}>
        <div style={{
          width:          44,
          height:         44,
          borderRadius:  '50%',
          background:    'rgba(255,255,255,0.97)',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          flexDirection: 'column',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>
            {score.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, color: '#AEAEB2', letterSpacing: '0.02em' }}>/ 10</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize:     16,
            fontWeight:   700,
            color:       '#1D1D1F',
            letterSpacing:'-0.02em',
            whiteSpace:  'nowrap',
          }}>
            {name}
          </span>
          <span style={{
            fontSize:    11,
            fontWeight:  500,
            color,
            background: `${color}14`,
            padding:    '2px 8px',
            borderRadius: 980,
            border:     `1px solid ${color}30`,
            whiteSpace: 'nowrap',
          }}>
            {meta.icon} {meta.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
          <div style={{
            flex: 1, height: 6, background: '#E8E8ED', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width:      `${pct}%`,
              height:     '100%',
              background:  color,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: diffColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {diffLabel}
          </span>
        </div>

        <div style={{ marginTop: 5, fontSize: 11, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
          Rank <strong style={{ color: '#3D3D3F' }}>#{rank}</strong> of {total} districts
          · City avg <strong style={{ color: '#3D3D3F' }}>{avg.toFixed(1)}</strong>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => setHoveredGSADistrict(null)}
        style={{
          pointerEvents:  'auto',
          alignSelf:      'flex-start',
          background:     '#F5F5F7',
          border:         '1px solid rgba(0,0,0,0.08)',
          borderRadius:    8,
          width:           24,
          height:          24,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          cursor:         'pointer',
          fontSize:        12,
          color:          '#6E6E73',
          flexShrink:      0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
