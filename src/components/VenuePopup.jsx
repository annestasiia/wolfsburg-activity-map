import React from 'react'
import { CATEGORY_COLORS } from '../constants'

const STATUS_LABEL = {
  open:    { text: 'Open now',  cls: 'text-green-600 bg-green-50' },
  closed:  { text: 'Closed',   cls: 'text-red-500  bg-red-50'   },
  unknown: { text: 'Hours N/A',cls: 'text-gray-400 bg-gray-50'  },
}

export default function VenuePopup({ venue, onClose }) {
  if (!venue) return null

  const catColor = CATEGORY_COLORS[venue.category] ?? '#888'
  const status   = STATUS_LABEL[venue.openStatus] ?? STATUS_LABEL.unknown

  return (
    <div className="absolute top-16 right-4 z-50 w-72 bg-white rounded-xl shadow-xl overflow-hidden pointer-events-auto">
      {/* Colour bar */}
      <div className="h-1" style={{ background: catColor }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{venue.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{venue.type}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-lg leading-none ml-2 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">{venue.street}, {venue.city}</p>

        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}
          >
            {status.text}
          </span>
          {venue.rating && (
            <span className="text-xs text-gray-500">★ {venue.rating}</span>
          )}
        </div>

        <dl className="space-y-1.5 text-xs">
          {venue.openingHours && (
            <Row label="Hours"    value={venue.openingHours} />
          )}
          {venue.peakTimes && (
            <Row label="Peak"     value={venue.peakTimes} />
          )}
          <Row label="Activity" value={venue.activityLevel || '—'} />
          {venue.ageGroups && (
            <Row label="Ages"     value={venue.ageGroups} />
          )}
        </dl>

        {venue.notes && (
          <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-3 leading-relaxed">
            {venue.notes}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 flex-shrink-0 text-gray-400">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  )
}
