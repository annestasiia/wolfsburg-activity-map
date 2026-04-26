export const DISTRICTS = [
  { name: 'Stadtmitte',         color: '#185FA5', relationId: '288449'   },
  { name: 'Mitte-West',         color: '#534AB7', relationId: '11042427' },
  { name: 'Kästorf-Sandkamp',   color: '#1D9E75', relationId: '20064844' },
  { name: 'Vorsfelde',          color: '#D85A30', relationId: '19800466' },
  { name: 'Neuhaus-Reislingen', color: '#3B6D11', relationId: '20064820' },
]

export const CATEGORIES = [
  { name: 'Schools',    color: '#185FA5' },
  { name: 'Culture',    color: '#534AB7' },
  { name: 'Leisure',    color: '#1D9E75' },
  { name: 'Commercial', color: '#BA7517' },
]

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CATEGORY_COLORS = Object.fromEntries(CATEGORIES.map(c => [c.name, c.color]))
export const DISTRICT_COLORS  = Object.fromEntries(DISTRICTS.map(d => [d.name, d.color]))

export const WOLFSBURG_CENTER = [10.7865, 52.4227]
export const WOLFSBURG_ZOOM   = 12

export function getCurrentDayAbbr() {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
}

export function getCurrentTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
