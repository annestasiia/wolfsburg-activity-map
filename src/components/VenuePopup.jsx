import React from 'react'
import { CATEGORY_COLORS } from '../constants'

const STATUS = {
  open:    { text: 'Open now', bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
  closed:  { text: 'Closed',   bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  unknown: { text: 'Hours N/A',bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' },
}

export default function VenuePopup({ venue, onClose }) {
  if (!venue) return null

  const catColor = CATEGORY_COLORS[venue.category] ?? '#888'
  const status   = STATUS[venue.openStatus] ?? STATUS.unknown

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 50,
      width: 280,
      background: 'rgba(8, 14, 44, 0.95)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      pointerEvents: 'auto',
    }}>
      {/* colour accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

      <div style={{ padding: '14px 16px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0, lineHeight: 1.3 }}>
              {venue.name}
            </h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '3px 0 0' }}>{venue.type}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 0 0 8px',
              flexShrink: 0,
              marginTop: -2,
              fontFamily: 'inherit',
            }}
          >×</button>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginBottom: 12 }}>
          {venue.street}, {venue.city}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 999,
            background: status.bg,
            color: status.color,
          }}>
            {status.text}
          </span>
          {venue.rating && venue.rating !== '—' && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>★ {venue.rating}</span>
          )}
        </div>

        <dl style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          {venue.openingHours && <Row label="Hours"    value={venue.openingHours} color={catColor} />}
          {venue.peakTimes    && <Row label="Peak"     value={venue.peakTimes}    color={catColor} />}
          <Row label="Activity" value={venue.activityLevel || '—'} color={catColor} />
          {venue.ageGroups    && <Row label="Ages"     value={venue.ageGroups}    color={catColor} />}
        </dl>

        {venue.notes && (
          <p style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.38)',
            lineHeight: 1.6,
          }}>
            {venue.notes}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <dt style={{ width: 58, flexShrink: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.25)', paddingTop: 1 }}>
        {label}
      </dt>
      <dd style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{value}</dd>
    </div>
  )
}
