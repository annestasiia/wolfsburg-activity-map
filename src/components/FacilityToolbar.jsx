import React from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'

function slotToTime(slot) {
  const h = Math.floor(slot / 2).toString().padStart(2, '0')
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}
function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 2 + (m >= 30 ? 1 : 0)
}

function Toggle({ label, active, onToggle, color = '#1565C0', count }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          8,
        padding:     '5px 6px',
        borderRadius: 8,
        background:   active ? `${color}18` : 'transparent',
        border:       'none',
        cursor:       'pointer',
        width:        '100%',
        textAlign:    'left',
        fontFamily:   'inherit',
        transition:   'background 0.15s ease',
      }}
    >
      <div style={{
        width:        32,
        height:       18,
        borderRadius:  9,
        background:    active ? color : '#D1D1D6',
        flexShrink:    0,
        position:     'relative',
        transition:   'background 0.2s ease',
      }}>
        <div style={{
          position:    'absolute',
          top:          2,
          left:         active ? 16 : 2,
          width:        14,
          height:       14,
          borderRadius:  7,
          background:   '#FFFFFF',
          boxShadow:    '0 1px 3px rgba(0,0,0,0.25)',
          transition:   'left 0.2s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F', flex: 1, lineHeight: 1.3 }}>
        {label}
      </span>
      {count != null && (
        <span style={{ fontSize: 10, color: '#AEAEB2', flexShrink: 0 }}>{count}</span>
      )}
    </button>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '4px 0' }} />
}

function SectionLabel({ children, color }) {
  return (
    <p style={{
      fontSize:      10,
      fontWeight:    600,
      color:          color || '#AEAEB2',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      margin:         0,
      paddingLeft:    6,
    }}>
      {children}
    </p>
  )
}

function TimeControls({ color, selectedDay, setSelectedDay, selectedTime, setSelectedTime }) {
  const dayIndex = DAYS.indexOf(selectedDay)
  const timeSlot = timeToSlot(selectedTime)
  return (
    <div style={{
      background:    '#F5F5F7',
      borderRadius:   10,
      padding:       '10px 10px 8px',
      display:       'flex',
      flexDirection: 'column',
      gap:            8,
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: '#6E6E73' }}>Day</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>{selectedDay}</span>
        </div>
        <input
          type="range" min={0} max={6} step={1}
          value={dayIndex === -1 ? 0 : dayIndex}
          onChange={e => setSelectedDay(DAYS[Number(e.target.value)])}
          style={{ width: '100%', cursor: 'pointer', accentColor: color }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {DAYS.map(d => (
            <span key={d} style={{
              fontSize:   9,
              color:       d === selectedDay ? '#1D1D1F' : '#AEAEB2',
              fontWeight:  d === selectedDay ? 600 : 400,
            }}>{d.slice(0, 2)}</span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: '#6E6E73' }}>Time</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F' }}>{selectedTime}</span>
        </div>
        <input
          type="range" min={0} max={47} step={1}
          value={timeSlot}
          onChange={e => setSelectedTime(slotToTime(Number(e.target.value)))}
          style={{ width: '100%', cursor: 'pointer', accentColor: color }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {['0h', '6h', '12h', '18h', '24h'].map(t => (
            <span key={t} style={{ fontSize: 9, color: '#AEAEB2' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function FacilityToolbar() {
  const {
    activeMobilityModes,
    // Automobile
    autoShowHeatmap,          toggleAutoShowHeatmap,
    autoShowParking,          toggleAutoShowParking,
    autoParkingGeoJSON,
    // Transit
    transitShowHeatmap,       toggleTransitShowHeatmap,
    transitShowBusStops,      toggleTransitShowBusStops,
    transitStopsGeoJSON,
    // Cycling
    cyclingShowRoutes,        toggleCyclingShowRoutes,
    cyclingShowLeisureRoutes, toggleCyclingShowLeisureRoutes,
    cyclingShowBikeParking,   toggleCyclingShowBikeParking,
    cyclingParkingGeoJSON,
    cyclingRoutesGeoJSON,
    // Shared time selectors
    selectedDay,  setSelectedDay,
    selectedTime, setSelectedTime,
  } = useAppStore()

  const hasAuto    = activeMobilityModes.has('automobile')
  const hasTransit = activeMobilityModes.has('transport')
  const hasCycling = activeMobilityModes.has('cycling')

  if (activeMobilityModes.size === 0) return null

  return (
    <div style={{
      position:           'absolute',
      right:               10,
      top:                 112,
      zIndex:              10,
      background:         'rgba(255,255,255,0.92)',
      backdropFilter:     'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border:             '1px solid rgba(0,0,0,0.08)',
      borderRadius:        16,
      boxShadow:          '0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
      padding:            '12px 10px',
      width:               210,
      display:            'flex',
      flexDirection:      'column',
      gap:                 4,
    }}>

      {/* ── Automobile ─────────────────────────────────────────── */}
      {hasAuto && (
        <>
          <SectionLabel color="#1565C0">Automobile</SectionLabel>
          <Toggle
            label="Road heatmap"
            active={autoShowHeatmap}
            onToggle={toggleAutoShowHeatmap}
            color="#1565C0"
          />
          {autoShowHeatmap && (
            <TimeControls
              color="#1565C0"
              selectedDay={selectedDay}   setSelectedDay={setSelectedDay}
              selectedTime={selectedTime} setSelectedTime={setSelectedTime}
            />
          )}
          <Toggle
            label="Parking lots"
            active={autoShowParking}
            onToggle={toggleAutoShowParking}
            color="#0D47A1"
            count={autoParkingGeoJSON?.features?.length}
          />
        </>
      )}

      {/* ── Public Transport ───────────────────────────────────── */}
      {hasTransit && (
        <>
          {hasAuto && <Divider />}
          <SectionLabel color="#0288D1">Public Transport</SectionLabel>
          <Toggle
            label="Route heatmap"
            active={transitShowHeatmap}
            onToggle={toggleTransitShowHeatmap}
            color="#0288D1"
          />
          {transitShowHeatmap && (
            <TimeControls
              color="#0288D1"
              selectedDay={selectedDay}   setSelectedDay={setSelectedDay}
              selectedTime={selectedTime} setSelectedTime={setSelectedTime}
            />
          )}
          <Toggle
            label="Bus stops"
            active={transitShowBusStops}
            onToggle={toggleTransitShowBusStops}
            color="#0288D1"
            count={transitStopsGeoJSON?.features?.length}
          />
        </>
      )}

      {/* ── Cycling ────────────────────────────────────────────── */}
      {hasCycling && (
        <>
          {(hasAuto || hasTransit) && <Divider />}
          <SectionLabel color="#0097A7">Cycling</SectionLabel>
          <Toggle
            label="Cycling routes"
            active={cyclingShowRoutes}
            onToggle={toggleCyclingShowRoutes}
            color="#0097A7"
          />
          <Toggle
            label="Leisure routes"
            active={cyclingShowLeisureRoutes}
            onToggle={toggleCyclingShowLeisureRoutes}
            color="#0277BD"
            count={cyclingRoutesGeoJSON?.features?.length}
          />
          <Toggle
            label="Bike parking"
            active={cyclingShowBikeParking}
            onToggle={toggleCyclingShowBikeParking}
            color="#00838F"
            count={cyclingParkingGeoJSON?.features?.length}
          />
        </>
      )}
    </div>
  )
}
