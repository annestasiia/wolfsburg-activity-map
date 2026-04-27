import React from 'react'
import { CATEGORY_COLORS } from '../constants'

const STATUS = {
  open:    { text: 'Open now', bg: 'rgba(52,199,89,0.12)',  color: '#1A7F37' },
  closed:  { text: 'Closed',   bg: 'rgba(255,59,48,0.10)',  color: '#D70015' },
  unknown: { text: 'Hours N/A',bg: 'rgba(0,0,0,0.05)',      color: '#6E6E73' },
}

export default function VenuePopup({ venue, onClose }) {
  if (!venue) return null

  const catColor = CATEGORY_COLORS[venue.category] ?? '#0071E3'
  const status   = STATUS[venue.openStatus] ?? STATUS.unknown

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 50,
      width: 284,
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      pointerEvents: 'auto',
    }}>
      {/* category colour bar */}
      <div style={{ height: 3, background: catColor, opacity: 0.8 }} />

      <div style={{ padding: '14px 16px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h3 style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#1D1D1F',
              margin: 0,
              lineHeight: 1.3,
            }}>
              {venue.name}
            </h3>
            <p style={{ fontSize: 13, color: '#6E6E73', margin: '3px 0 0', letterSpacing: '-0.01em' }}>
              {venue.type}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: 'none',
              color: '#6E6E73',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 980,
              flexShrink: 0,
              marginLeft: 8,
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >×</button>
        </div>

        <p style={{ fontSize: 13, color: '#AEAEB2', marginBottom: 12, letterSpacing: '-0.01em' }}>
          {venue.street}, {venue.city}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            padding: '4px 10px',
            borderRadius: 980,
            background: status.bg,
            color: status.color,
            letterSpacing: '-0.01em',
          }}>
            {status.text}
          </span>
          {venue.rating && venue.rating !== '—' && (
            <span style={{ fontSize: 13, color: '#6E6E73' }}>★ {venue.rating}</span>
          )}
        </div>

        <dl style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {venue.openingHours && <Row label="Hours"    value={venue.openingHours} />}
          {venue.peakTimes    && <Row label="Peak"     value={venue.peakTimes}    />}
          <Row label="Activity" value={venue.activityLevel || '—'} />
          {venue.ageGroups    && <Row label="Ages"     value={venue.ageGroups}    />}
        </dl>

        {venue.notes && (
          <p style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(0,0,0,0.07)',
            fontSize: 13,
            color: '#6E6E73',
            lineHeight: 1.6,
            letterSpacing: '-0.01em',
          }}>
            {venue.notes}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <dt style={{
        width: 56,
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        color: '#AEAEB2',
        paddingTop: 2,
      }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: '#1D1D1F', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
        {value}
      </dd>
    </div>
  )
}
