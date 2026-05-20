import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'

function Toggle({ label, active, onToggle, color = '#FF4D6D', count, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 6px', borderRadius: 8,
        background: active && !disabled ? `${color}18` : 'transparent',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        transition: 'background 0.15s ease',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <div style={{
        width: 32, height: 18, borderRadius: 9,
        background: active && !disabled ? color : '#D1D1D6',
        flexShrink: 0, position: 'relative',
        transition: 'background 0.2s ease',
      }}>
        <div style={{
          position: 'absolute', top: 2,
          left: active && !disabled ? 16 : 2,
          width: 14, height: 14, borderRadius: 7,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.2s ease',
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

const MODES = [
  { id: 'automobile', label: 'Automobile', icon: '🚗', color: '#3D3D3F' },
  { id: 'transport',  label: 'Bus',        icon: '🚌', color: '#0077FF' },
  { id: 'cycling',    label: 'Cycling',    icon: '🚲', color: '#00C853' },
]

export default function TransportPoolPanel() {
  const [isOpen, setIsOpen] = useState(false)

  const {
    activeMobilityModes, toggleMobilityMode, mobilityDataLoading,
    autoShowRoutes,         toggleAutoShowRoutes,
    autoShowHeatmap,        toggleAutoShowHeatmap,
    autoShowParking,        toggleAutoShowParking,
    autoParkingGeoJSON,
    transitShowRoutes,      toggleTransitShowRoutes,
    transitShowBusStops,    toggleTransitShowBusStops,
    transitStopsGeoJSON,
    cyclingShowRoutes,      toggleCyclingShowRoutes,
    cyclingShowBikeParking, toggleCyclingShowBikeParking,
    cyclingParkingGeoJSON,
  } = useAppStore()

  const hasAuto    = activeMobilityModes.has('automobile')
  const hasTransit = activeMobilityModes.has('transport')
  const hasCycling = activeMobilityModes.has('cycling')
  const anyActive  = hasAuto || hasTransit || hasCycling

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Transport Pool"
        style={{
          position: 'absolute', right: 10, top: 112, zIndex: 10,
          background: anyActive ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${anyActive ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 14,
          padding: '10px 10px',
          boxShadow: anyActive ? '0 4px 16px rgba(0,0,0,0.14)' : '0 2px 8px rgba(0,0,0,0.08)',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>🚌</span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: anyActive ? '#1D1D1F' : '#6E6E73',
          letterSpacing: '-0.01em',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}>
          Transport
        </span>
        {anyActive && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#0077FF',
            boxShadow: '0 0 5px #0077FF80',
          }} />
        )}
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute', right: 10, top: 112, zIndex: 10,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
      padding: '10px 10px 12px',
      width: 210,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 6, marginBottom: 2,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#1D1D1F',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          Transport Pool
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 7, padding: '2px 7px', fontSize: 11, color: '#6E6E73',
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Mode sections */}
      {MODES.map(m => {
        const active  = activeMobilityModes.has(m.id)
        const loading = active && mobilityDataLoading

        return (
          <React.Fragment key={m.id}>
            <Divider />

            {/* Mode toggle header */}
            <button
              onClick={() => toggleMobilityMode(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 6px', borderRadius: 8,
                background: active ? `${m.color}14` : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%',
                textAlign: 'left', fontFamily: 'inherit',
                transition: 'background 0.15s ease',
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>
                {loading ? '⏳' : m.icon}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, flex: 1,
                color: active ? m.color : '#AEAEB2',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {m.label}
              </span>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: active ? m.color : '#E8E8ED',
                boxShadow: active ? `0 0 6px ${m.color}60` : 'none',
                transition: 'all 0.2s ease',
              }} />
            </button>

            {/* Automobile layer toggles */}
            {active && m.id === 'automobile' && (
              <div style={{ paddingLeft: 2 }}>
                <Toggle
                  label="Routes"
                  active={autoShowRoutes}
                  onToggle={toggleAutoShowRoutes}
                  color="#3D3D3F"
                />
                <Toggle
                  label="Heatmap"
                  active={autoShowHeatmap}
                  onToggle={toggleAutoShowHeatmap}
                  color="#FF4400"
                />
                <Toggle
                  label="Parking"
                  active={autoShowParking}
                  onToggle={toggleAutoShowParking}
                  color="#1565C0"
                  count={autoParkingGeoJSON?.features?.length}
                />
              </div>
            )}

            {/* Bus layer toggles */}
            {active && m.id === 'transport' && (
              <div style={{ paddingLeft: 2 }}>
                <Toggle
                  label="Routes"
                  active={transitShowRoutes}
                  onToggle={toggleTransitShowRoutes}
                  color="#0077FF"
                />
                <Toggle
                  label="Bus Stops"
                  active={transitShowBusStops}
                  onToggle={toggleTransitShowBusStops}
                  color="#0077FF"
                  count={transitStopsGeoJSON?.features?.length}
                />
              </div>
            )}

            {/* Cycling layer toggles */}
            {active && m.id === 'cycling' && (
              <div style={{ paddingLeft: 2 }}>
                <Toggle
                  label="Routes"
                  active={cyclingShowRoutes}
                  onToggle={toggleCyclingShowRoutes}
                  color="#00C853"
                />
                <Toggle
                  label="Parking"
                  active={cyclingShowBikeParking}
                  onToggle={toggleCyclingShowBikeParking}
                  color="#00897B"
                  count={cyclingParkingGeoJSON?.features?.length}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
