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

function Toggle({ label, active, onToggle, color = '#FF4D6D', count, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          8,
        padding:     '5px 6px',
        borderRadius: 8,
        background:   active && !disabled ? `${color}18` : 'transparent',
        border:       'none',
        cursor:       disabled ? 'default' : 'pointer',
        width:        '100%',
        textAlign:    'left',
        fontFamily:   'inherit',
        transition:   'background 0.15s ease',
        opacity:       disabled ? 0.38 : 1,
      }}
    >
      <div style={{
        width:        32,
        height:       18,
        borderRadius:  9,
        background:    active && !disabled ? color : '#D1D1D6',
        flexShrink:    0,
        position:     'relative',
        transition:   'background 0.2s ease',
      }}>
        <div style={{
          position:    'absolute',
          top:          2,
          left:         active && !disabled ? 16 : 2,
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

export default function MobilityToolbar() {
  const {
    activeMobilityModes,
    showDistrictNames,          toggleDistrictNames,
    showFacilitiesInMobility,
    // Automobile
    autoShowRegional,           toggleAutoShowRegional,
    autoShowHeatmap,            toggleAutoShowHeatmap,
    autoShowParking,            toggleAutoShowParking,
    autoParkingGeoJSON,
    // Transit
    transitShowRegional,        toggleTransitShowRegional,
    transitShowHeatmap,         toggleTransitShowHeatmap,
    transitShowBusStops,        toggleTransitShowBusStops,
    transitStopsGeoJSON,
    // Cycling
    cyclingShowRegional,        toggleCyclingShowRegional,
    cyclingShowRoutes,          toggleCyclingShowRoutes,
    cyclingShowLeisureRoutes,   toggleCyclingShowLeisureRoutes,
    cyclingShowBikeParking,     toggleCyclingShowBikeParking,
    cyclingParkingGeoJSON,
    cyclingRoutesGeoJSON,
    // Shared time selectors
    selectedDay,  setSelectedDay,
    selectedTime, setSelectedTime,
  } = useAppStore()

  const multiMode  = activeMobilityModes.size > 1
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
      <SectionLabel>Map Overlays</SectionLabel>
      <Toggle
        label="District names"
        active={showDistrictNames}
        onToggle={toggleDistrictNames}
        color="#6E6E73"
      />

      {/* ── Automobile ─────────────────────────────────────────── */}
      {hasAuto && (
        <>
          <Divider />
          <SectionLabel color="#3D3D3F">Automobile</SectionLabel>
          <Toggle
            label="Regional activity"
            active={autoShowRegional}
            onToggle={toggleAutoShowRegional}
            color="#3D3D3F"
            disabled={multiMode}
          />
          <Toggle
            label="Road heatmap"
            active={autoShowHeatmap}
            onToggle={toggleAutoShowHeatmap}
            color="#FF4400"
          />
          {autoShowHeatmap && (
            <TimeControls
              color="#FF4400"
              selectedDay={selectedDay}   setSelectedDay={setSelectedDay}
              selectedTime={selectedTime} setSelectedTime={setSelectedTime}
            />
          )}
          <Toggle
            label="Parking lots"
            active={autoShowParking}
            onToggle={toggleAutoShowParking}
            color="#1565C0"
            count={autoParkingGeoJSON?.features?.length}
          />
        </>
      )}

      {/* ── Public Transport ───────────────────────────────────── */}
      {hasTransit && (
        <>
          <Divider />
          <SectionLabel color="#0077FF">Public Transport</SectionLabel>
          <Toggle
            label="Regional activity"
            active={transitShowRegional}
            onToggle={toggleTransitShowRegional}
            color="#0077FF"
            disabled={multiMode}
          />
          <Toggle
            label="Route heatmap"
            active={transitShowHeatmap}
            onToggle={toggleTransitShowHeatmap}
            color="#5E5CE6"
          />
          {transitShowHeatmap && (
            <TimeControls
              color="#5E5CE6"
              selectedDay={selectedDay}   setSelectedDay={setSelectedDay}
              selectedTime={selectedTime} setSelectedTime={setSelectedTime}
            />
          )}
          <Toggle
            label="Bus stops"
            active={transitShowBusStops}
            onToggle={toggleTransitShowBusStops}
            color="#0077FF"
            count={transitStopsGeoJSON?.features?.length}
          />
        </>
      )}

      {/* ── Cycling ────────────────────────────────────────────── */}
      {hasCycling && (
        <>
          <Divider />
          <SectionLabel color="#00C853">Cycling</SectionLabel>
          <Toggle
            label="Regional activity"
            active={cyclingShowRegional}
            onToggle={toggleCyclingShowRegional}
            color="#00C853"
            disabled={multiMode}
          />
          <Toggle
            label="Cycling routes"
            active={cyclingShowRoutes}
            onToggle={toggleCyclingShowRoutes}
            color="#00C853"
          />
          <Toggle
            label="Leisure routes"
            active={cyclingShowLeisureRoutes}
            onToggle={toggleCyclingShowLeisureRoutes}
            color="#FF8C42"
            count={cyclingRoutesGeoJSON?.features?.length}
          />
          <Toggle
            label="Bike parking"
            active={cyclingShowBikeParking}
            onToggle={toggleCyclingShowBikeParking}
            color="#00897B"
            count={cyclingParkingGeoJSON?.features?.length}
          />
        </>
      )}

      {multiMode && (
        <>
          <Divider />
          <p style={{
            fontSize:   10,
            color:      '#AEAEB2',
            margin:      0,
            paddingLeft: 6,
            lineHeight:  1.4,
          }}>
            Regional activity unavailable in multi-mode
          </p>
        </>
      )}

      {/* ── Facilities overlay ─────────────────────────────────── */}
      {showFacilitiesInMobility && (
        <>
          <Divider />
          <SectionLabel color="#FF6900">Facilities</SectionLabel>
          <TimeControls
            color="#FF6900"
            selectedDay={selectedDay}   setSelectedDay={setSelectedDay}
            selectedTime={selectedTime} setSelectedTime={setSelectedTime}
          />
        </>
      )}
    </div>
  )
}
