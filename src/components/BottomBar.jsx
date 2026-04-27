import React from 'react'
import { useAppStore } from '../store/appStore'
import DistrictsPanel from './panels/DistrictsPanel'
import FacilitiesPanel from './panels/FacilitiesPanel'
import TimePanel from './panels/TimePanel'
import StatsPanel from './panels/StatsPanel'

const TABS = [
  { id: 'districts',  label: 'Districts',  icon: '⬡' },
  { id: 'facilities', label: 'Facilities', icon: '⊞' },
  { id: 'time',       label: 'Time',       icon: '◷' },
  { id: 'statistics', label: 'Statistics', icon: '▦' },
]

const PANELS = {
  districts:  DistrictsPanel,
  facilities: FacilitiesPanel,
  time:       TimePanel,
  statistics: StatsPanel,
}

export default function BottomBar() {
  const { activeBottomPanel, setActiveBottomPanel } = useAppStore()
  const ActivePanel = activeBottomPanel ? PANELS[activeBottomPanel] : null

  return (
    <div className="bottom-bar">
      <div className={`bottom-panel-wrap ${activeBottomPanel ? 'open' : ''}`}>
        {ActivePanel && (
          <div className="bottom-panel-inner">
            <ActivePanel />
          </div>
        )}
      </div>

      <div className="bottom-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`bottom-tab ${activeBottomPanel === t.id ? 'active' : ''}`}
            onClick={() => setActiveBottomPanel(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
