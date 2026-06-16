import React from 'react'
import { useAppStore } from '../store/appStore'
import { makePieSVG } from './IntermodalSidebar'

const HUB_TYPE_LABEL = {
  bus_bike:      'Bus + Bike Hub',
  auto_bike:     'Auto + Bike Hub',
  auto_bus_bike: 'Auto + Bus + Bike Hub',
}

const PRIORITY_LABEL = {
  priority:  'Priority hub',
  potential: 'Potential hub',
}

const STATUS_LABEL = {
  existing: 'Existing — bike parking present',
  proposed: 'Proposed — new bike parking needed',
}

const CONDITION_DESC = {
  A1: 'Facilities within 1500 m',
  A2: 'Park polygon intersects 500 m zone',
  A3: 'Existing bike parking within 200 m',
  B1: 'Facilities within 1500 m (car parking)',
  B2: 'Park polygon intersects 500 m zone (car parking)',
}

export default function IntermodalHubPopup() {
  const { intermodalSelectedHub, setIntermodalSelectedHub } = useAppStore()
  const hub = intermodalSelectedHub
  if (!hub) return null

  const pieSVG = makePieSVG(hub.hubType, hub.priority, 48)

  const topFacilities = (hub.nearbyFacilities || [])
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 246,
      zIndex: 30,
      width: 320,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div dangerouslySetInnerHTML={{ __html: pieSVG }} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', lineHeight: 1.3 }}>
            {HUB_TYPE_LABEL[hub.hubType]}
          </div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 2 }}>
            {hub.labelBus || hub.labelCar || 'Intermodal point'}
          </div>
        </div>
        <button
          onClick={() => setIntermodalSelectedHub(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, padding: '0 0 0 4px', lineHeight: 1, flexShrink: 0 }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '12px 16px', maxHeight: 440, overflowY: 'auto' }}>

        {/* Priority + Status badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 13, fontWeight: 600, padding: '3px 9px', borderRadius: 980,
            background: hub.priority === 'priority' ? '#1D1D1F' : '#F5F5F7',
            color: hub.priority === 'priority' ? '#fff' : '#6E6E73',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {PRIORITY_LABEL[hub.priority]}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600, padding: '3px 9px', borderRadius: 980,
            background: hub.status === 'existing' ? '#D1FAE5' : '#EFF6FF',
            color: hub.status === 'existing' ? '#065F46' : '#1D4ED8',
            border: `1px solid ${hub.status === 'existing' ? '#A7F3D0' : '#BFDBFE'}`,
          }}>
            {hub.status === 'existing' ? '✓ Existing' : '+ Proposed'}
          </span>
        </div>

        {/* Score */}
        <Row label="Score" value={hub.score.toLocaleString()} />

        {/* Status explanation */}
        <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 10, lineHeight: 1.5 }}>
          {STATUS_LABEL[hub.status]}
        </div>

        {/* Conditions triggered */}
        <SectionHead>Why here?</SectionHead>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {(hub.conditions || []).map(cond => (
            <span key={cond} title={CONDITION_DESC[cond]} style={{
              fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 980,
              background: '#F5F5F7', color: '#1D1D1F', border: '1px solid rgba(0,0,0,0.08)',
            }}>
              {cond}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {(hub.conditions || []).map(cond => (
            <div key={cond} style={{ fontSize: 13, color: '#6E6E73', display: 'flex', gap: 6 }}>
              <span style={{ fontWeight: 600, color: '#1D1D1F', flexShrink: 0 }}>{cond}:</span>
              {CONDITION_DESC[cond]}
            </div>
          ))}
        </div>

        {/* Nearby park */}
        {hub.nearbyParkName && (
          <>
            <SectionHead>Nearby greenery</SectionHead>
            <div style={{ fontSize: 13, color: '#065F46', background: '#D1FAE5', borderRadius: 8, padding: '6px 10px', marginBottom: 12 }}>
              🌳 {hub.nearbyParkName}
            </div>
          </>
        )}

        {/* Nearby facilities */}
        {topFacilities.length > 0 && (
          <>
            <SectionHead>Facilities in radius</SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
              {topFacilities.map((f, i) => (
                <div key={i} style={{ fontSize: 13, background: '#F5F5F7', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontWeight: 500, color: '#1D1D1F' }}>{f.name}</div>
                  <div style={{ color: '#6E6E73', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span>{f.footfall} visitors/day</span>
                    {f.hours && <span>· {f.hours}</span>}
                    <span>· {f.dist} m</span>
                  </div>
                </div>
              ))}
              {(hub.nearbyFacilities || []).length > 5 && (
                <div style={{ fontSize: 13, color: '#AEAEB2', textAlign: 'center' }}>
                  +{(hub.nearbyFacilities || []).length - 5} more facilities
                </div>
              )}
            </div>
          </>
        )}

        {/* Coordinates */}
        <div style={{ fontSize: 13, color: '#AEAEB2' }}>
          {hub.lat.toFixed(5)}, {hub.lng.toFixed(5)}
        </div>
      </div>
    </div>
  )
}

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#AEAEB2', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#6E6E73' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#1D1D1F' }}>{value}</span>
    </div>
  )
}
