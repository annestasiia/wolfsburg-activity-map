// Heuristic opening-hours parser for free-text strings like
// "Mo–Fr 9:00–20:00 / Sa 10:00–18:00 / So geschlossen"

const DAY_ALIASES = {
  Mon: ['mo', 'mon', 'monday',    'montag'],
  Tue: ['tu', 'tue', 'tuesday',   'dienstag'],
  Wed: ['we', 'wed', 'wednesday', 'mittwoch'],
  Thu: ['th', 'thu', 'thursday',  'donnerstag'],
  Fri: ['fr', 'fri', 'friday',    'freitag'],
  Sat: ['sa', 'sat', 'saturday',  'samstag'],
  Sun: ['su', 'sun', 'sunday',    'sonntag', 'so'],
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function norm(s) { return s.toLowerCase().replace(/\.$/, '') }

function timeToMin(s) {
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

function matchDay(token, dayAbbr) {
  return DAY_ALIASES[dayAbbr]?.some(alias => norm(token) === alias) ?? false
}

function dayRangeIncludes(fromTok, toTok, targetDay) {
  const fi = ALL_DAYS.findIndex(d => DAY_ALIASES[d]?.includes(norm(fromTok)))
  const ti = ALL_DAYS.findIndex(d => DAY_ALIASES[d]?.includes(norm(toTok)))
  if (fi === -1 || ti === -1) return false
  if (fi <= ti) return ALL_DAYS.indexOf(targetDay) >= fi && ALL_DAYS.indexOf(targetDay) <= ti
  // wrap-around (rare)
  const idx = ALL_DAYS.indexOf(targetDay)
  return idx >= fi || idx <= ti
}

// Returns 'open' | 'closed' | 'unknown'
export function parseOpeningHours(hoursStr, day, timeStr) {
  if (!hoursStr || !hoursStr.trim()) return 'unknown'

  const currentMin = timeToMin(timeStr)
  if (currentMin === null) return 'unknown'

  // Split into segments by / ; or newline
  const segments = hoursStr.split(/[\/;\n]+/).map(s => s.trim()).filter(Boolean)

  let matched = false

  for (const seg of segments) {
    // Patterns: "Mo–Fr 9:00–20:00", "Mo-Fr 09:00-17:00", "Mo 9:00-18:00"
    // Range day pattern
    const rangeMatch = seg.match(
      /([a-zäöüß]+)\s*[–\-]\s*([a-zäöüß]+)[,\s]+(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/i
    )
    if (rangeMatch) {
      const [, f, t, open, close] = rangeMatch
      if (dayRangeIncludes(f, t, day)) {
        matched = true
        if (/closed|geschlossen/i.test(seg)) return 'closed'
        const o = timeToMin(open), c = timeToMin(close)
        if (o !== null && c !== null) return currentMin >= o && currentMin <= c ? 'open' : 'closed'
      }
    }

    // Single day pattern
    const singleMatch = seg.match(
      /([a-zäöüß]+)[,\s]+(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/i
    )
    if (singleMatch) {
      const [, d, open, close] = singleMatch
      if (matchDay(d, day)) {
        matched = true
        if (/closed|geschlossen/i.test(seg)) return 'closed'
        const o = timeToMin(open), c = timeToMin(close)
        if (o !== null && c !== null) return currentMin >= o && currentMin <= c ? 'open' : 'closed'
      }
    }

    // Bare time range (no day prefix) — treat as valid for all days
    const bareMatch = seg.match(/^(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})$/)
    if (bareMatch) {
      matched = true
      const o = timeToMin(bareMatch[1]), c = timeToMin(bareMatch[2])
      if (o !== null && c !== null) return currentMin >= o && currentMin <= c ? 'open' : 'closed'
    }

    // Explicit closed for this day
    const closedMatch = seg.match(/([a-zäöüß]+)\s*(closed|geschlossen)/i)
    if (closedMatch && matchDay(closedMatch[1], day)) return 'closed'

    // Range closed: "Mo–Fr closed"
    const rangeClosed = seg.match(/([a-zäöüß]+)\s*[–\-]\s*([a-zäöüß]+)\s*(closed|geschlossen)/i)
    if (rangeClosed && dayRangeIncludes(rangeClosed[1], rangeClosed[2], day)) return 'closed'
  }

  return matched ? 'unknown' : 'unknown'
}
