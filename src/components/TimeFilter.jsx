import React from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'

export default function TimeFilter() {
  const { selectedDay, selectedTime, setSelectedDay, setSelectedTime } = useAppStore()

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Day &amp; Time</p>

      {/* Day buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors
              ${selectedDay === day
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {day.slice(0, 2)}
          </button>
        ))}
      </div>

      {/* Time input */}
      <input
        type="time"
        value={selectedTime}
        onChange={e => setSelectedTime(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}
