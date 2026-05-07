import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import DistrictsPanel from './panels/DistrictsPanel'
import FacilitiesPanel from './panels/FacilitiesPanel'
import TimePanel from './panels/TimePanel'
import StatsPanel from './panels/StatsPanel'
import MobilityPanel from './panels/MobilityPanel'

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

const MIN_H          = 0
const MAX_H          = 460
const SNAP_CLOSE_H   = 60
const DEFAULT_OPEN_H = 220

export default function BottomBar() {
  const { activeMode, activeBottomPanel, setActiveBottomPanel } = useAppStore()
  const [panelH, setPanelH] = useState(0)
  const drag = useRef(null)

  useEffect(() => { setPanelH(0) }, [activeMode])

  const beginDrag = useCallback((e) => {
    if (e.type === 'mousedown') e.preventDefault()
    const startY = e.touches ? e.touches[0].clientY : e.clientY
    drag.current = { startY, startH: panelH, moved: false }

    const onMove = (ev) => {
      if (!drag.current) return
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY
      const delta = drag.current.startY - y
      if (Math.abs(delta) > 3) drag.current.moved = true
      setPanelH(Math.max(MIN_H, Math.min(MAX_H, drag.current.startH + delta)))
    }

    const onUp = (ev) => {
      if (!drag.current) return
      const { moved, startH, startY: sy } = drag.current

      if (!moved) {
        setPanelH(startH < SNAP_CLOSE_H ? DEFAULT_OPEN_H : MIN_H)
      } else {
        const y = ev.changedTouches ? ev.changedTouches[0].clientY : ev.clientY
        const newH = startH + sy - y
        setPanelH(newH < SNAP_CLOSE_H ? MIN_H : Math.min(MAX_H, newH))
      }

      drag.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }, [panelH])

  const handleTabClick = useCallback((id) => {
    if (activeBottomPanel === id) {
      setPanelH(prev => prev >= SNAP_CLOSE_H ? MIN_H : DEFAULT_OPEN_H)
    } else {
      setActiveBottomPanel(id)
      setPanelH(DEFAULT_OPEN_H)
    }
  }, [activeBottomPanel, setActiveBottomPanel])

  if (activeMode === 'greenery') return null

  const ActivePanel = activeBottomPanel ? PANELS[activeBottomPanel] : null

  if (activeMode === 'mobility') {
    return (
      <div className="bottom-bar">
        <div
          className="bottom-drag-handle"
          onMouseDown={beginDrag}
          onTouchStart={beginDrag}
        >
          <div className="bottom-drag-pill" />
          <span className="bottom-drag-label">Mobility Analysis</span>
        </div>
        <div className="bottom-sheet-content" style={{ height: panelH }}>
          <div className="bottom-panel-inner">
            <MobilityPanel />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bottom-bar">
      {activeBottomPanel && (
        <>
          <div
            className="bottom-drag-handle"
            onMouseDown={beginDrag}
            onTouchStart={beginDrag}
          >
            <div className="bottom-drag-pill" />
          </div>
          <div className="bottom-sheet-content" style={{ height: panelH }}>
            <div className="bottom-panel-inner">
              {ActivePanel && <ActivePanel />}
            </div>
          </div>
        </>
      )}
      <div className="bottom-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`bottom-tab ${activeBottomPanel === t.id ? 'active' : ''}`}
            onClick={() => handleTabClick(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
