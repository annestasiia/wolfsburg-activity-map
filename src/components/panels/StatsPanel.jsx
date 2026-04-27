import React from 'react'
import { useAppStore } from '../../store/appStore'
import { useFilters } from '../../hooks/useFilters'
import { CATEGORIES } from '../../constants'

const MODE_LABELS = {
  pedestrian:     { label: 'Pedestrian',     color: '#00C6F0' },
  transport:      { label: 'Transport',      color: '#FF6B35' },
  infrastructure: { label: 'Infrastructure', color: '#A855F7' },
}

export default function StatsPanel() {
  const { activeModes, footways, roads, venues } = useAppStore()
  const { filteredVenues, openCount } = useFilters()

  const highActivity = filteredVenues.filter(v => v.activityLevel === 'High').length
  const footwayCount = footways?.features?.length ?? 0
  const roadCount    = roads?.features?.length ?? 0

  const catStats = CATEGORIES.map(c => ({
    ...c,
    open:  filteredVenues.filter(v => v.category === c.name && v.openStatus !== 'closed' && v.radius > 0).length,
    total: venues.filter(v => v.category === c.name).length,
  }))

  return (
    <div>
      <p className="panel-label">Activity Summary</p>
      <div className="stats-grid">
        <StatCard value={filteredVenues.length} label="Venues Visible"   color="#00C6F0" />
        <StatCard value={openCount}             label="Open Now"         color="#4ade80" />
        <StatCard value={highActivity}          label="High Activity"    color="#A855F7" />
        <StatCard value={footwayCount.toLocaleString()} label="Footway Segments" color="#FF9500" />
        <StatCard value={roadCount.toLocaleString()}    label="Road Segments"    color="#FF6B35" />
        <div className="stat-card">
          <div style={{ marginBottom: 6 }}>
            {[...activeModes].length === 0 ? (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No layers active</span>
            ) : (
              [...activeModes].map(m => (
                <span key={m} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginRight: 8,
                  fontSize: 12,
                  color: MODE_LABELS[m]?.color ?? '#fff',
                  fontWeight: 500,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: MODE_LABELS[m]?.color, display: 'inline-block' }} />
                  {MODE_LABELS[m]?.label}
                </span>
              ))
            )}
          </div>
          <div className="stat-label">
            <span className="stat-accent" style={{ background: '#7B61FF' }} />
            Active Layers
          </div>
        </div>
      </div>

      <p className="panel-label" style={{ marginTop: 20 }}>By Category</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {catStats.map(c => (
          <div key={c.name} style={{
            background: `${c.color}12`,
            border: `1px solid ${c.color}30`,
            borderRadius: 10,
            padding: '11px 16px',
            minWidth: 110,
          }}>
            <div style={{ fontSize: 20, fontWeight: 300, color: c.color, marginBottom: 3, letterSpacing: '-0.02em' }}>
              {c.open}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>/{c.total}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              {c.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-label">
        <span className="stat-accent" style={{ background: color }} />
        {label}
      </div>
    </div>
  )
}
