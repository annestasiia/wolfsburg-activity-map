import React from 'react'
import { useAppStore } from '../store/appStore'
import { DISTRICTS, CATEGORIES } from '../constants'
import TimeFilter from './TimeFilter'

export default function Sidebar({ venueCount, openCount }) {
  const {
    selectedDistricts, toggleDistrict, selectAllDistricts, clearAllDistricts,
    selectedCategories, toggleCategory,
    showNotes, setShowNotes,
    boundariesError,
    geocodingSkipped,
  } = useAppStore()

  const allSelected = selectedDistricts.size === DISTRICTS.length

  return (
    <aside className="w-64 flex-shrink-0 h-full bg-white border-r border-gray-100 flex flex-col overflow-y-auto">
      {/* App title (mobile only — desktop title is in TopBar) */}
      <div className="md:hidden px-4 py-3 border-b border-gray-100">
        <h1 className="text-sm font-semibold text-gray-800">Wolfsburg Activity Map</h1>
      </div>

      {/* ── Districts ── */}
      <Section title="Districts">
        <div className="space-y-1.5">
          {DISTRICTS.map(d => (
            <label key={d.name} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedDistricts.has(d.name)}
                onChange={() => toggleDistrict(d.name)}
                className="rounded border-gray-300 text-blue-500 focus:ring-0 cursor-pointer"
              />
              <span
                className="text-xs text-gray-700 group-hover:text-gray-900"
                style={{ borderLeft: `3px solid ${d.color}`, paddingLeft: 6 }}
              >
                {d.name}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={allSelected ? clearAllDistricts : selectAllDistricts}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        {boundariesError && (
          <p className="text-xs text-amber-500 mt-2">
            ⚠ Boundary data unavailable — venues still shown
          </p>
        )}
      </Section>

      {/* ── Categories ── */}
      <Section title="Categories">
        <div className="space-y-1.5">
          {CATEGORIES.map(c => (
            <label key={c.name} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedCategories.has(c.name)}
                onChange={() => toggleCategory(c.name)}
                className="rounded border-gray-300 focus:ring-0 cursor-pointer"
                style={{ accentColor: c.color }}
              />
              <span className="text-xs text-gray-700 group-hover:text-gray-900 flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: c.color }}
                />
                {c.name}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Day & Time ── */}
      <Section>
        <TimeFilter />
      </Section>

      {/* ── Notes toggle ── */}
      <Section>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setShowNotes(!showNotes)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0
              ${showNotes ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${showNotes ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </div>
          <span className="text-xs text-gray-600">Show reviews &amp; notes</span>
        </label>
      </Section>

      {/* ── Stats footer ── */}
      <div className="mt-auto px-4 py-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
        <div>{venueCount} venues visible</div>
        <div>{openCount} open now</div>
        {geocodingSkipped > 0 && (
          <div className="text-amber-400">{geocodingSkipped} addresses unresolved</div>
        )}
      </div>
    </aside>
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
