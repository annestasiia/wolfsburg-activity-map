import React from 'react'
import { useAppStore } from '../store/appStore'
import { DAYS } from '../constants'

function slotToTime(slot) {
  const h = Math.floor(slot / 2).toString().padStart(2, '0')
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}

function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 2 + (m >= 30 ? 1 : 0)
}

export default function TimeFilter() {
  const { selectedDay, selectedTime, setSelectedDay, setSelectedTime } = useAppStore()

  const dayIndex = DAYS.indexOf(selectedDay)
  const timeSlot = timeToSlot(selectedTime)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Day &amp; Time</p>

      {/* Day slider */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Day</span>
          <span className="text-xs font-semibold text-gray-800">{selectedDay}</span>
        </div>
        <input
          type="range"
          min={0}
          max={6}
          step={1}
          value={dayIndex === -1 ? 0 : dayIndex}
          onChange={e => setSelectedDay(DAYS[Number(e.target.value)])}
          className="w-full accent-gray-800 cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          {DAYS.map(d => (
            <span
              key={d}
              className={`text-[10px] ${d === selectedDay ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}
            >
              {d.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      {/* Hour slider */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Time</span>
          <span className="text-xs font-semibold text-gray-800">{selectedTime}</span>
        </div>
        <input
          type="range"
          min={0}
          max={47}
          step={1}
          value={timeSlot}
          onChange={e => setSelectedTime(slotToTime(Number(e.target.value)))}
          className="w-full accent-gray-800 cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          {['00:00', '06:00', '12:00', '18:00', '23:30'].map(t => (
            <span key={t} className="text-[10px] text-gray-400">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
