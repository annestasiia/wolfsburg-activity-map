import React, { useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { DAYS } from '../../constants'

const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_LABELS = ['00:00', '06:00', '12:00', '18:00', '23:30']

function slotToTime(slot) {
  const h = Math.floor(slot / 2).toString().padStart(2, '0')
  const m = slot % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
}

function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 2 + (m >= 30 ? 1 : 0)
}

function timeOfDayLabel(slot) {
  const h = Math.floor(slot / 2)
  if (h < 6)  return 'Night'
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  if (h < 21) return 'Evening'
  return 'Night'
}

export default function TimePanel() {
  const { selectedDay, selectedTime, setSelectedDay, setSelectedTime } = useAppStore()

  const dayIdx  = Math.max(0, DAYS.indexOf(selectedDay))
  const timeSlot = timeToSlot(selectedTime)
  const dayPct  = dayIdx / (DAYS.length - 1)
  const hourPct = timeSlot / 47

  const onDay  = useCallback(e => setSelectedDay(DAYS[Number(e.target.value)]),  [setSelectedDay])
  const onTime = useCallback(e => setSelectedTime(slotToTime(Number(e.target.value))), [setSelectedTime])

  return (
    <div className="time-panel-grid">
      {/* Day */}
      <div>
        <p className="panel-label">Day of Week</p>
        <div className="time-value-display">{selectedDay}</div>
        <p className="time-sublabel">{FULL_DAYS[dayIdx]}</p>
        <input
          type="range" min={0} max={6} step={1}
          value={dayIdx}
          onChange={onDay}
          className="time-slider day-slider"
          style={{ '--pct': dayPct }}
        />
        <div className="time-tick-row">
          {DAYS.map((d, i) => (
            <span key={d} className={`time-tick ${i === dayIdx ? 'active' : ''}`}>
              {d.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      {/* Time */}
      <div>
        <p className="panel-label">Time of Day</p>
        <div className="time-value-display">{selectedTime}</div>
        <p className="time-sublabel">{timeOfDayLabel(timeSlot)}</p>
        <input
          type="range" min={0} max={47} step={1}
          value={timeSlot}
          onChange={onTime}
          className="time-slider hour-slider"
          style={{ '--pct': hourPct }}
        />
        <div className="time-tick-row">
          {TIME_LABELS.map(t => (
            <span key={t} className="time-tick">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
