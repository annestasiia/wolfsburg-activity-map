import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useFilters } from '../hooks/useFilters'
import { CATEGORIES, DAYS } from '../constants'
import FacilitiesPanel from './panels/FacilitiesPanel'
import DistrictsPanel from './panels/DistrictsPanel'
import TimePanel from './panels/TimePanel'
import StatsPanel from './panels/StatsPanel'

const ICONS = { Schools: '🏫', Culture: '🎭', Leisure: '🌳', Commercial: '🛍️' }

const STATUS_STYLE = {
  open:    { text: 'Open now', bg: 'rgba(52,199,89,0.12)',  color: '#1A7F37' },
  closed:  { text: 'Closed',   bg: 'rgba(255,59,48,0.10)',  color: '#D70015' },
  unknown: { text: 'Hours N/A', bg: 'rgba(0,0,0,0.05)',     color: '#6E6E73' },
}

const MODE_META = {
  facilities: { icon: '⊞', label: 'Facilities' },
}

export default function LeftSidebar() {
  const [isOpen, setIsOpen] = useState(true)

  const {
    activeMode,
    selectedFacilityVenueId, setSelectedFacilityVenueId,
    selectedDay,
  } = useAppStore()

  const { filteredVenues } = useFilters()

  const venue = activeMode === 'facilities' && selectedFacilityVenueId != null
    ? filteredVenues.find(v => v.id === selectedFacilityVenueId) ?? null
    : null

  const meta = MODE_META[activeMode] ?? { icon: '⊞', label: activeMode }

  // ── Collapsed vertical tab ─────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title={`Open ${meta.label}`}
        style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', zIndex: 10,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
          padding: '14px 10px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 18 }}>{meta.icon}</span>
        <span style={{
          writingMode: 'vertical-rl', fontSize: 12, fontWeight: 600,
          color: '#3D3D3F', letterSpacing: '-0.01em',
        }}>
          {meta.label}
        </span>
      </button>
    )
  }

  // ── Open sidebar ───────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 300, zIndex: 10,
      background: 'rgba(255,255,255,0.93)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '4px 0 24px rgba(0,0,0,0.09)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 13px',
        borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
      }}>
        {venue ? (
          <>
            <button
              onClick={() => setSelectedFacilityVenueId(null)}
              style={{
                background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', color: '#3D3D3F', flexShrink: 0,
              }}
            >← {meta.label}</button>
            <span style={{
              fontSize: 14, fontWeight: 600, color: '#1D1D1F',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, marginLeft: 10,
            }}>
              {venue.name}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
            {meta.icon} {meta.label}
          </span>
        )}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 8, padding: '4px 9px', fontSize: 13, color: '#6E6E73',
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
            transition: 'all 0.15s ease', flexShrink: 0, marginLeft: 8,
          }}
        >✕</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Facilities: venue detail ── */}
        {activeMode === 'facilities' && venue && (
          <div style={{ padding: '16px 18px 24px' }}>
            <VenueDetail venue={venue} selectedDay={selectedDay} />
          </div>
        )}

        {/* ── Facilities: accordion sections ── */}
        {activeMode === 'facilities' && !venue && (
          <>
            <Section title="Facility Categories" icon="⊞" defaultOpen>
              <FacilitiesPanel noTitle />
            </Section>
            <Section title="Connections" icon="🔗">
              <ConnectionsSection />
            </Section>
            <Section title="Districts" icon="⬡">
              <DistrictsPanel noTitle />
            </Section>
            <Section title="Time" icon="◷">
              <TimePanel />
            </Section>
            <Section title="Statistics" icon="▦">
              <StatsPanel noTitle />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

// ── Connections section ────────────────────────────────────────────────────────

const TRANSPORT_MODES = [
  { id: 'automobile', label: 'Automobile',       sub: 'Transport', icon: '🚗', color: '#1565C0' },
  { id: 'transport',  label: 'Public Transport', sub: 'Transit',   icon: '🚌', color: '#0288D1' },
  { id: 'cycling',    label: 'Cycling',          sub: 'Access',    icon: '🚲', color: '#0097A7' },
]

function ConnectionsSection() {
  const { activeMobilityModes, toggleMobilityMode, mobilityDataLoading } = useAppStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.4 }}>
        Toggle a transport mode to overlay its network on the map.
      </p>
      {TRANSPORT_MODES.map(m => {
        const active = activeMobilityModes.has(m.id)
        const loading = active && mobilityDataLoading
        return (
          <button
            key={m.id}
            onClick={() => toggleMobilityMode(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 12, fontFamily: 'inherit',
              background: active ? `${m.color}12` : '#F5F5F7',
              border: `1px solid ${active ? m.color + '50' : 'rgba(0,0,0,0.08)'}`,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              boxShadow: active ? `0 1px 6px ${m.color}28` : 'none',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>
              {loading ? '⏳' : m.icon}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{
                display: 'block', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                color: active ? '#1D1D1F' : '#6E6E73', marginBottom: 1, transition: 'color 0.2s',
              }}>
                {m.label}
              </span>
              <span style={{ fontSize: 12, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
                {m.sub}
              </span>
            </span>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: active ? m.color : '#E8E8ED',
              boxShadow: active ? `0 0 6px ${m.color}60` : 'none',
              transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }} />
          </button>
        )
      })}
      {activeMobilityModes.size > 0 && (
        <p style={{ fontSize: 12, color: '#6E6E73', marginTop: 4, letterSpacing: '-0.01em' }}>
          Layer controls appear on the right →
        </p>
      )}
    </div>
  )
}

// ── Accordion section ──────────────────────────────────────────────────────────

function Section({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '13px 18px',
          background: open ? 'rgba(0,0,0,0.015)' : 'transparent',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.15s ease',
        }}
      >
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#1D1D1F',
          letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>
          {title}
        </span>
        <span style={{
          fontSize: 11, color: '#AEAEB2', lineHeight: 1,
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '4px 18px 18px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Venue detail ───────────────────────────────────────────────────────────────

function VenueDetail({ venue, selectedDay }) {
  const cat = CATEGORIES.find(c => c.name === venue.category)
  const catColor = cat?.color ?? '#888'
  const status = STATUS_STYLE[venue.openStatus] ?? STATUS_STYLE.unknown

  return (
    <div>
      {/* Badge row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{
          padding: '3px 10px', borderRadius: 980,
          background: catColor + '18', color: catColor,
          fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
        }}>
          {ICONS[venue.category]} {venue.category}
        </span>
        <span style={{
          padding: '3px 10px', borderRadius: 980,
          background: '#F5F5F7', color: '#6E6E73',
          fontSize: 12, letterSpacing: '-0.01em',
        }}>
          {venue.type}
        </span>
        <span style={{
          padding: '3px 10px', borderRadius: 980,
          background: status.bg, color: status.color,
          fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          {status.text}
        </span>
      </div>

      {/* Activity card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: catColor + '12', borderRadius: 10,
        padding: '10px 14px', marginBottom: 18,
      }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{ICONS[venue.category]}</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: catColor, lineHeight: 1 }}>
            {venue.activityLevel || '—'}
          </div>
          <div style={{ fontSize: 12, color: catColor + 'AA', marginTop: 3 }}>
            activity level today
          </div>
        </div>
      </div>

      {/* Heatmap label */}
      <p style={{
        fontSize: 11, fontWeight: 600, color: '#AEAEB2',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
      }}>
        Weekly Pattern
      </p>

      {/* Heatmap cells */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {DAYS.map(day => {
          const level = venue.days?.[day] ?? '—'
          const isToday = day === selectedDay
          const bg = level === 'High' ? catColor
                   : level === 'Med'  ? catColor + '80'
                   : level === 'Low'  ? catColor + '40'
                   : '#E8E8ED'
          return (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', height: 32, borderRadius: 6, background: bg,
                border: isToday ? `2px solid ${catColor}` : '1px solid rgba(0,0,0,0.07)',
                boxShadow: isToday ? `0 0 0 2px ${catColor}30` : 'none',
              }} />
              <span style={{
                fontSize: 10, letterSpacing: '0.03em',
                color: isToday ? '#1D1D1F' : '#AEAEB2',
                fontWeight: isToday ? 700 : 400,
              }}>
                {day.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 18,
        paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        {[['High', catColor], ['Med', catColor + '80'], ['Low', catColor + '40'], ['—', '#E8E8ED']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: color, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: '#6E6E73' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
        {venue.openingHours && <InfoRow label="Hours" value={venue.openingHours} />}
        {venue.peakTimes    && <InfoRow label="Peak"  value={venue.peakTimes}   />}
        {venue.ageGroups    && <InfoRow label="Ages"  value={venue.ageGroups}   />}
      </div>

      {/* Notes */}
      {venue.notes && venue.notes !== '—' && (
        <p style={{
          fontSize: 13, color: '#6E6E73', lineHeight: 1.6, letterSpacing: '-0.01em',
          paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.07)',
        }}>
          {venue.notes}
        </p>
      )}

      <p style={{ fontSize: 12, color: '#AEAEB2', marginTop: 14, letterSpacing: '-0.01em' }}>
        {venue.street}, {venue.city}
      </p>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{
        width: 44, flexShrink: 0, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: '#AEAEB2', paddingTop: 2,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#1D1D1F', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
        {value}
      </span>
    </div>
  )
}
