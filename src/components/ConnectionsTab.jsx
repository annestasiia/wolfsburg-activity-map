import React, { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

const MODES = [
  { key: 'cycling',    label: 'Cycling',         color: '#43A047', lineH: 3 },
  { key: 'pedestrian', label: 'Pedestrian',       color: '#FF8F00', lineH: 2 },
  { key: 'roads',      label: 'Roads',            color: '#78909C', lineH: 2 },
  { key: 'transit',    label: 'Public Transit',   color: '#1E88E5', lineH: 3 },
]

const CONN_GRADIENT = 'linear-gradient(to right, #ECEFF1, #80DEEA, #26C6DA, #0097A7, #006064)'

const CONN_LABELS = ['0', '1', '2', '3', '4']

const TOGGLE_KEYS = {
  cycling:    { show: 'showCycling',    toggle: 'toggleCycling'    },
  pedestrian: { show: 'showPedestrian', toggle: 'togglePedestrian' },
  roads:      { show: 'showRoads',      toggle: 'toggleRoads'      },
  transit:    { show: 'showTransit',    toggle: 'toggleTransit'    },
}

export default function ConnectionsTab() {
  const store = useAppStore()
  const {
    cycling, connectivityLoading,
    setCycling, setPedestrian, setRoads, setTransit, setConnectivityLoading,
    showConnectivityOverlay, toggleConnectivityOverlay,
  } = store

  // Lazy-load all transport files the first time this tab is mounted
  useEffect(() => {
    if (cycling || connectivityLoading) return
    setConnectivityLoading(true)
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}wolfsburg_cycling.geojson`).then(r => r.json()),
      fetch(`${base}wolfsburg_footways.geojson`).then(r => r.json()),
      fetch(`${base}wolfsburg_roads.geojson`).then(r => r.json()),
      fetch(`${base}wolfsburg_transit.geojson`).then(r => r.json()),
    ]).then(([c, p, r, t]) => {
      setCycling(c)
      setPedestrian(p)
      setRoads(r)
      setTransit(t)
      setConnectivityLoading(false)
    }).catch(() => setConnectivityLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── Transport layers ── */}
      <Section title="Transport Layers">
        {connectivityLoading && (
          <p className="text-xs text-gray-400 mb-3">Loading map data…</p>
        )}
        <div className="space-y-2">
          {MODES.map(({ key, label, color, lineH }) => {
            const showKey   = TOGGLE_KEYS[key].show
            const toggleKey = TOGGLE_KEYS[key].toggle
            const isOn      = store[showKey]
            return (
              <label key={key} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => store[toggleKey]()}
                  className="rounded border-gray-300 focus:ring-0 cursor-pointer"
                  style={{ accentColor: color }}
                />
                <span className="text-xs text-gray-700 group-hover:text-gray-900 flex items-center gap-2">
                  <span
                    className="inline-block rounded-sm flex-shrink-0"
                    style={{ width: 18, height: lineH, background: color, opacity: isOn ? 1 : 0.35 }}
                  />
                  {label}
                </span>
              </label>
            )
          })}
        </div>
      </Section>

      {/* ── Connectivity overlay ── */}
      <Section title="Connectivity">
        <label className="flex items-center gap-2 cursor-pointer group mb-3">
          <input
            type="checkbox"
            checked={showConnectivityOverlay}
            onChange={toggleConnectivityOverlay}
            className="rounded border-gray-300 focus:ring-0 cursor-pointer"
            style={{ accentColor: '#0097A7' }}
          />
          <span className="text-xs text-gray-600 group-hover:text-gray-900">
            Show connectivity overlay
          </span>
        </label>

        {showConnectivityOverlay && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Accessible modes
            </p>
            <div
              className="w-full h-3 rounded"
              style={{ background: CONN_GRADIENT }}
            />
            <div className="flex justify-between">
              {CONN_LABELS.map(n => (
                <span key={n} className="text-[9px] text-gray-400">{n}</span>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-0.5">
              Bike · Walk · Car · Transit
            </p>
          </div>
        )}
      </Section>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div className="px-4 py-4 border-b border-gray-100">
      {title && (
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}
