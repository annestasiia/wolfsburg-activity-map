import React from 'react'
import { useAppStore } from '../../store/appStore'
import { useFilters } from '../../hooks/useFilters'
import { CATEGORIES } from '../../constants'

const MODE_LABELS = {
  pedestrian:     { label: 'Pedestrian',     color: '#0071E3' },
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
        <StatCard value={filteredVenues.length} label="Venues Visible"   color="#0071E3" />
        <StatCard value={openCount}             label="Open Now"         color="#34C759" />
        <StatCard value={highActivity}          label="High Activity"    color="#AF52DE" />
        <StatCard value={footwayCount.toLocaleString()} label="Footways"  color="#FF9500" />
        <StatCard value={roadCount.toLocaleString()}    label="Roads"     color="#FF6B35" />

        {/* Active layers card */}
        <div className="stat-card">
          <div style={{ marginBottom: 8 }}>
            {[...activeModes].length === 0 ? (
              <span style={{ fontSize: 14, color: '#AEAEB2', letterSpacing: '-0.01em' }}>None</span>
            ) : (
              [...activeModes].map(m => (
                <span key={m} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginRight: 8,
                  marginBottom: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: MODE_LABELS[m]?.color ?? '#1D1D1F',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: MODE_LABELS[m]?.color,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {MODE_LABELS[m]?.label}
                </span>
              ))
            )}
          </div>
          <div className="stat-label">
            <span className="stat-accent" style={{ background: '#0071E3' }} />
            Active Layers
          </div>
        </div>
      </div>

      <p className="panel-label" style={{ marginTop: 22 }}>By Category</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {catStats.map(c => (
          <div key={c.name} style={{
            background: `${c.color}0E`,
            border: `1px solid ${c.color}28`,
            borderRadius: 12,
            padding: '12px 16px',
            minWidth: 110,
          }}>
            <div style={{
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: '-0.03em',
              color: c.color,
              marginBottom: 4,
              lineHeight: 1,
            }}>
              {c.open}
              <span style={{ fontSize: 13, color: '#AEAEB2', fontWeight: 400 }}>/{c.total}</span>
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: '#6E6E73',
            }}>
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
