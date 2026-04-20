const XLSX  = require('../node_modules/xlsx')
const https = require('https')
const fs    = require('fs')
const path  = require('path')

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_ALIASES = {
  Mon: ['mo', 'mon', 'monday',    'montag'],
  Tue: ['tu', 'tue', 'tuesday',   'dienstag', 'di'],
  Wed: ['we', 'wed', 'wednesday', 'mittwoch',  'mi'],
  Thu: ['th', 'thu', 'thursday',  'donnerstag','do'],
  Fri: ['fr', 'fri', 'friday',    'freitag'],
  Sat: ['sa', 'sat', 'saturday',  'samstag'],
  Sun: ['su', 'sun', 'sunday',    'sonntag',   'so'],
}

function norm(s) { return s.toLowerCase().replace(/[.\s]+$/, '').trim() }

function dayRangeIncludes(fromTok, toTok, target) {
  const fi = ALL_DAYS.findIndex(d => DAY_ALIASES[d]?.includes(norm(fromTok)))
  const ti = ALL_DAYS.findIndex(d => DAY_ALIASES[d]?.includes(norm(toTok)))
  if (fi === -1 || ti === -1) return false
  const idx = ALL_DAYS.indexOf(target)
  return fi <= ti ? idx >= fi && idx <= ti : idx >= fi || idx <= ti
}

function dayMatches(token, target) {
  return DAY_ALIASES[target]?.includes(norm(token)) ?? false
}

function normaliseActivity(raw) {
  const s = String(raw || '').trim()
  if (/^high$/i.test(s))      return 'High'
  if (/^med(ium)?$/i.test(s)) return 'Med'
  if (/^low$/i.test(s))       return 'Low'
  return '—'
}

function getDayActivity(openingHours, actLevel, day) {
  if (!openingHours || !openingHours.trim()) return actLevel
  if (/24\/7|täglich|daily/i.test(openingHours)) return actLevel

  const segments = openingHours.split(/[\/;]+/).map(s => s.trim()).filter(Boolean)
  let foundOpen = false
  let foundClosed = false

  for (const seg of segments) {
    const isClosed = /closed|geschlossen/i.test(seg)
    // Range pattern: "Mo–Fr", "Mo-Fr", "Sat–Sun"
    const rangeM = seg.match(/([a-zäöüß]+)\s*[–\-]\s*([a-zäöüß]+)/i)
    if (rangeM && dayRangeIncludes(rangeM[1], rangeM[2], day)) {
      isClosed ? (foundClosed = true) : (foundOpen = true)
      continue
    }
    // Individual tokens: "Mo", "Tue&Thu" etc
    const tokens = seg.split(/[\s,&]+/)
    for (const tok of tokens) {
      if (dayMatches(tok, day)) {
        isClosed ? (foundClosed = true) : (foundOpen = true)
      }
    }
  }

  if (foundClosed && !foundOpen) return '—'
  if (foundOpen) return actLevel
  return '—'   // day not mentioned → assume closed
}

// ── Parse Excel ─────────────────────────────────────────────────────────────
const wb   = XLSX.readFile('/Users/basakpnar/Downloads/wolfsburg_hotspots_with_addresses.xlsx')
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const venues = rows
  .slice(2)
  .filter(row => String(row[2] || '').trim())
  .map((row, idx) => {
    const actLevel     = normaliseActivity(row[8])
    const openingHours = String(row[6] || '').trim()
    return {
      id:                idx,
      district:          String(row[0]  || '').trim(),
      category:          String(row[1]  || '').trim(),
      name:              String(row[2]  || '').trim(),
      type:              String(row[3]  || '').trim(),
      street:            String(row[4]  || '').trim(),
      city:              String(row[5]  || '').trim(),
      openingHours,
      peakTimes:         String(row[7]  || '').trim(),
      activityIntensity: String(row[8]  || '').trim(),
      ageGroups:         String(row[9]  || '').trim(),
      rating:            String(row[10] || '').trim(),
      notes:             String(row[11] || '').trim(),
      days: Object.fromEntries(
        ALL_DAYS.map(d => [d, getDayActivity(openingHours, actLevel, d)])
      ),
      lat: null,
      lng: null,
    }
  })

// ── Geocode via Nominatim ───────────────────────────────────────────────────
function geocode(street, city) {
  const q    = encodeURIComponent(`${street}, ${city}, Germany`)
  const url  = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'wolfsburg-activity-map/1.0' } }, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => {
        try {
          const r = JSON.parse(buf)
          resolve(r.length ? { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) } : { lat: null, lng: null })
        } catch { resolve({ lat: null, lng: null }) }
      })
    })
    req.on('error', () => resolve({ lat: null, lng: null }))
  })
}

async function main() {
  console.log(`Geocoding ${venues.length} venues…`)
  for (let i = 0; i < venues.length; i++) {
    const v = venues[i]
    const coords = await geocode(v.street, v.city)
    v.lat = coords.lat
    v.lng = coords.lng
    console.log(`[${i + 1}/${venues.length}] ${v.name}: ${v.lat ?? 'FAILED'}, ${v.lng ?? ''}`)
    if (i < venues.length - 1) await new Promise(r => setTimeout(r, 1150))
  }

  const failed  = venues.filter(v => v.lat === null).length
  const outPath = path.join(__dirname, '../src/data/venues.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(venues, null, 2))
  console.log(`\nDone. Saved to ${outPath}`)
  console.log(`Geocoded: ${venues.length - failed}/${venues.length} (${failed} failed)`)
}

main().catch(console.error)
