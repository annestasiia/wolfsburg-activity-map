import React from 'react'
import { useAppStore } from '../store/appStore'
import { computeFleetPerHub, MODE_META } from '../utils/fleetCalc'

const SANS  = "system-ui, -apple-system, sans-serif"
const SERIF = "'Georgia', 'Times New Roman', serif"
const TIER_COLOR = { hub_l: '#1D1D1F', hub_m: '#1D7A3A', hub_s: '#185FA5' }
const TIER_LABEL = { hub_l: 'Hub L', hub_m: 'Hub M', hub_s: 'Hub S' }
const TIER_DESC  = {
  hub_l: 'Fleet depot + fast charging',
  hub_m: 'Intermodal transfer node',
  hub_s: 'Bus/bike interchange',
}
const fmt = (n) => n >= 10000 ? `${(n / 10000).toFixed(2)} ha` : `${Math.round(n)} m²`

export default function HubLMHubPopup() {
  const {
    hubLMSelectedHub, setHubLMSelectedHub,
    hubLMResults, hubSBusOnly,
  } = useAppStore()

  if (!hubLMSelectedHub) return null

  const { hub, tier } = hubLMSelectedHub
  const color = TIER_COLOR[tier]

  const hubLCount = hubLMResults?.hubL?.hubs?.length || 1
  const hubMCount = hubLMResults?.hubM?.hubs?.length || 1
  const hubSCount = (hubSBusOnly || []).length || 1
  const fleetPerHub = computeFleetPerHub(hubLCount, hubMCount, hubSCount)
  const d = fleetPerHub[tier]

  const fleetModes = Object.entries(d).filter(([k, v]) => k !== '_total' && v > 0)

  return (
    <div style={{
      position: 'absolute', top: 64, left: 316, zIndex: 500,
      width: 248,
      background: '#fff',
      border: `1px solid #E8E8E8`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
      fontFamily: SANS,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', background: '#FAFAF9', borderBottom: '1px solid #E8E8E8', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 3 }}>
            {TIER_LABEL[tier]}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 14, color: '#111', lineHeight: 1.3, maxWidth: 180 }}>
            {hub.name || hub.labelBus || 'Hub'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{TIER_DESC[tier]}</div>
        </div>
        <button onClick={() => setHubLMSelectedHub(null)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, lineHeight: 1, padding: 0, marginTop: -2
        }}>×</button>
      </div>

      {/* Location info */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid #E8E8E8' }}>
        {hub.area > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 11, color: '#888' }}>Site area</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#111' }}>{fmt(hub.area)}</span>
          </div>
        )}
        {hub.zone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 11, color: '#888' }}>Zone</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#111', textTransform: 'capitalize' }}>{hub.zone}</span>
          </div>
        )}
        {hub.status && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 11, color: '#888' }}>Status</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: hub.status === 'existing' ? '#1D7A3A' : '#185FA5', textTransform: 'capitalize' }}>{hub.status}</span>
          </div>
        )}
        {hub.score !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 11, color: '#888' }}>Score</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#111' }}>{Math.round(hub.score)}</span>
          </div>
        )}
      </div>

      {/* Fleet breakdown */}
      <div style={{ padding: '8px 14px 12px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
          Fleet served (per hub)
        </div>
        {fleetModes.map(([mode, n]) => {
          const meta = MODE_META[mode]
          return (
            <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color || '#ccc', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#444', flex: 1 }}>{meta?.label || mode}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color }}>×{n}</span>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTop: `1px solid ${color}22` }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#222' }}>Total vehicles</span>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color }}>×{d._total}</span>
        </div>
      </div>
    </div>
  )
}
