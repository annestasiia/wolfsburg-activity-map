import * as XLSX from 'xlsx'

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const ws = workbook.Sheets[sheetName]

        // header: 1 → array of arrays; defval: '' fills empty cells
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Data starts at row 4 (index 3); skip header rows 0–2
        const venues = rows
          .slice(3)
          .filter(row => row.length > 2 && String(row[2] || '').trim())
          .map((row, idx) => ({
            id: idx,
            district:          String(row[0]  || '').trim(),
            category:          String(row[1]  || '').trim(),
            name:              String(row[2]  || '').trim(),
            type:              String(row[3]  || '').trim(),
            street:            String(row[4]  || '').trim(),
            city:              String(row[5]  || '').trim(),
            openingHours:      String(row[6]  || '').trim(),
            peakTimes:         String(row[7]  || '').trim(),
            activityIntensity: String(row[8]  || '').trim(),
            ageGroups:         String(row[9]  || '').trim(),
            rating:            String(row[10] || '').trim(),
            notes:             String(row[11] || '').trim(),
            days: {
              Mon: normaliseActivity(row[12]),
              Tue: normaliseActivity(row[13]),
              Wed: normaliseActivity(row[14]),
              Thu: normaliseActivity(row[15]),
              Fri: normaliseActivity(row[16]),
              Sat: normaliseActivity(row[17]),
              Sun: normaliseActivity(row[18]),
            },
            lat: null,
            lng: null,
          }))

        resolve(venues)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function normaliseActivity(raw) {
  const s = String(raw || '').trim()
  if (/^high$/i.test(s))   return 'High'
  if (/^med(ium)?$/i.test(s)) return 'Med'
  if (/^low$/i.test(s))    return 'Low'
  return '—'
}
