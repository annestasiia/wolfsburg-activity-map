import React, { useCallback, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { runIntermodalAlgorithm } from '../utils/intermodalAlgorithm'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.35,10.68,52.52,10.93'

const BUS_STOPS_Q = `[out:json][timeout:30];node["highway"="bus_stop"](${BBOX});out body;`

const CAR_PARKINGS_Q = `[out:json][timeout:30];(
  node["amenity"="parking"]["access"!="private"](${BBOX});
  way["amenity"="parking"]["access"!="private"](${BBOX});
);out center;`

const BIKE_PARKINGS_Q = `[out:json][timeout:30];node["amenity"="bicycle_parking"](${BBOX});out body;`

const OSM_FACILITIES_Q = `[out:json][timeout:60];(
  node["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre|social_centre|marketplace"](${BBOX});
  way["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre"](${BBOX});
  node["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium|ice_rink"](${BBOX});
  way["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium"](${BBOX});
  node["shop"~"supermarket|mall|department_store"](${BBOX});
  way["shop"~"supermarket|mall|department_store"](${BBOX});
  node["amenity"~"school|university|college|kindergarten"](${BBOX});
  way["amenity"~"school|university|college|kindergarten"](${BBOX});
  node["amenity"~"hospital|clinic|doctors|dentist|pharmacy|health_post"](${BBOX});
  way["amenity"~"hospital|clinic"](${BBOX});
);out center;`

// Footfall estimates for OSM facility types
const OSM_FOOTFALL = {
  hospital: 800, clinic: 300, doctors: 200, dentist: 100, pharmacy: 150, health_post: 100,
  school: 400, university: 600, college: 400, kindergarten: 150,
  supermarket: 700, mall: 900, department_store: 500, marketplace: 400,
  sports_centre: 300, fitness_centre: 250, swimming_pool: 250, stadium: 800, ice_rink: 200,
  theatre: 350, cinema: 400, museum: 200, arts_centre: 150, library: 150,
  community_centre: 120, social_centre: 100,
}

const OSM_HOURS = {
  hospital: 'daily 08:00–20:00', clinic: 'Mo–Fr 08:00–18:00',
  school: 'Mo–Fr 07:30–17:00', university: 'Mo–Fr 08:00–18:00', college: 'Mo–Fr 08:00–17:00',
  kindergarten: 'Mo–Fr 07:00–17:00',
  supermarket: 'Mo–Sa 07:00–22:00', mall: 'Mo–Su 09:00–21:00',
  sports_centre: 'Mo–Su 07:00–22:00', fitness_centre: 'Mo–Su 07:00–22:00',
  swimming_pool: 'Mo–Su 07:00–20:00',
  theatre: 'Mo–Su 10:00–22:00', cinema: 'Mo–Su 10:00–24:00', museum: 'Tue–Su 10:00–18:00',
  library: 'Mo–Fr 09:00–19:00', community_centre: 'Mo–Fr 09:00–21:00',
}

function osmElementToVenueFeature(el) {
  const props = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!lat || !lng) return null

  const amenity = props.amenity || props.leisure || props.shop || ''
  const footfall = OSM_FOOTFALL[amenity] ?? 100
  const hours = OSM_HOURS[amenity] ?? null

  let category = 'Leisure'
  if (['hospital','clinic','doctors','dentist','pharmacy','health_post'].includes(amenity)) category = 'Healthcare'
  else if (['school','university','college','kindergarten'].includes(amenity)) category = 'Schools'
  else if (['theatre','cinema','museum','arts_centre','library','community_centre','social_centre'].includes(amenity)) category = 'Culture'
  else if (['supermarket','mall','department_store','marketplace'].includes(amenity)) category = 'Commercial'

  return {
    id: `osm-${el.id}`,
    name: props.name || amenity || 'Facility',
    lat, lng,
    category,
    activityIntensity: footfall >= 500 ? 'High' : footfall >= 200 ? 'Medium' : 'Low',
    openingHours: hours || '—',
    _footfall: footfall,
    _activeHours: hours,
  }
}

function osmToGeoJSON(elements, type) {
  const features = elements
    .filter(el => {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      return lat && lng
    })
    .map(el => {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      return {
        type: 'Feature',
        id: `${type}-${el.id}`,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { ...(el.tags || {}), _osmType: type },
      }
    })
  return { type: 'FeatureCollection', features }
}

async function overpassFetch(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  return res.json()
}

// ── Toggle row ─────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, color }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1F' }}>
      <div
        onClick={onChange}
        style={{
          width: 32, height: 18, borderRadius: 9,
          background: checked ? (color || '#0071E3') : '#E0E0E0',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0, cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 15 : 2,
          width: 14, height: 14, borderRadius: 7, background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#AEAEB2', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {children}
      </div>
    </div>
  )
}

// ── Hub type pill ──────────────────────────────────────────────────────────────
function HubTypePill({ type, active, onClick }) {
  const labels = { bus_bike: 'Bus + Bike', auto_bike: 'Auto + Bike', auto_bus_bike: 'Auto + Bus + Bike' }
  const colors = { bus_bike: '#EF4444', auto_bike: '#6B7280', auto_bus_bike: '#8B5CF6' }
  const c = colors[type]
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 980, fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer',
        border: `1.5px solid ${active ? c : 'rgba(0,0,0,0.10)'}`,
        background: active ? `${c}18` : 'transparent',
        color: active ? c : '#6E6E73',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: active ? c : '#ccc', flexShrink: 0 }} />
      {labels[type]}
    </button>
  )
}

// ── Pie chart legend item ──────────────────────────────────────────────────────
function PieLegend({ hubType }) {
  const size = 20
  const svgStr = makePieSVG(hubType, 'potential', size)
  return (
    <span
      style={{ display: 'inline-block', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgStr }}
    />
  )
}

// ── Pie chart SVG maker (shared with MapView) ─────────────────────────────────
function polarXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function sectorPath(cx, cy, r, startDeg, endDeg) {
  const s = polarXY(cx, cy, r, startDeg)
  const e = polarXY(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${cx} ${cy} L${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}Z`
}

export function makePieSVG(hubType, priority, size = 36) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 2
  const strokeW = priority === 'priority' ? 2 : 1.5
  let sectors
  if (hubType === 'bus_bike')      sectors = [{ c: '#EF4444', s: 0, e: 180 }, { c: '#22C55E', s: 180, e: 360 }]
  else if (hubType === 'auto_bike') sectors = [{ c: '#6B7280', s: 0, e: 180 }, { c: '#22C55E', s: 180, e: 360 }]
  else                              sectors = [{ c: '#6B7280', s: 0, e: 120 }, { c: '#EF4444', s: 120, e: 240 }, { c: '#22C55E', s: 240, e: 360 }]

  const paths = sectors.map(({ c, s, e }) => `<path d="${sectorPath(cx, cy, r, s, e)}" fill="${c}"/>`).join('')
  const border = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${strokeW}"/>`
  const outer = priority === 'priority'
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="#1D1D1F" stroke-width="1.5" stroke-dasharray="3 2"/>`
    : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${outer}${paths}${border}</svg>`
}

// ── Main sidebar ───────────────────────────────────────────────────────────────
export default function IntermodalSidebar() {
  const {
    venues, parks,
    intermodalLoading, intermodalError, intermodalHubs,
    intermodalRawBusStops, intermodalRawCarParkings, intermodalRawBikeParkings,
    intermodalShowBusStops, intermodalShowCarParkings, intermodalShowBikeParkings,
    intermodalHubTypes, intermodalStatusFilter,
    intermodalShowFacilitiesRadius, intermodalShowGreeneryRadius,
    intermodalShowFacilitiesPoints, intermodalShowParksOverlay,
    setIntermodalLoading, setIntermodalError, setIntermodalHubs, setIntermodalRawData,
    toggleIntermodalShowBusStops, toggleIntermodalShowCarParkings, toggleIntermodalShowBikeParkings,
    toggleIntermodalHubType, setIntermodalStatusFilter,
    toggleIntermodalFacilitiesRadius, toggleIntermodalGreeneryRadius,
    toggleIntermodalFacilitiesPoints, toggleIntermodalParksOverlay,
  } = useAppStore()

  const [fetchProgress, setFetchProgress] = useState('')

  const handleRunAnalysis = useCallback(async () => {
    setIntermodalLoading(true)
    setIntermodalError(null)
    setIntermodalHubs([])
    setFetchProgress('Loading bus stops…')

    try {
      const post = (q) => overpassFetch(q)

      setFetchProgress('Loading bus stops…')
      const busRaw = await post(BUS_STOPS_Q)
      const busGeoJSON = osmToGeoJSON(busRaw.elements || [], 'bus')

      setFetchProgress('Loading car parkings…')
      const carRaw = await post(CAR_PARKINGS_Q)
      const carGeoJSON = osmToGeoJSON(carRaw.elements || [], 'car')

      setFetchProgress('Loading bike parkings…')
      const bikeRaw = await post(BIKE_PARKINGS_Q)
      const bikeGeoJSON = osmToGeoJSON(bikeRaw.elements || [], 'bike')

      setFetchProgress('Loading additional facilities from OSM…')
      const facRaw = await post(OSM_FACILITIES_Q)
      const osmFacs = (facRaw.elements || []).map(osmElementToVenueFeature).filter(Boolean)

      setIntermodalRawData(busGeoJSON, carGeoJSON, bikeGeoJSON, osmFacs)

      setFetchProgress('Running algorithm…')
      const allVenues = [...venues, ...osmFacs]
      const parksGJ = parks || { type: 'FeatureCollection', features: [] }
      const hubs = runIntermodalAlgorithm(allVenues, busGeoJSON, carGeoJSON, bikeGeoJSON, parksGJ)

      setIntermodalHubs(hubs)
      setFetchProgress('')
    } catch (err) {
      console.error('Intermodal fetch error:', err)
      setIntermodalError('Failed to load data. Check your internet connection and try again.')
      setFetchProgress('')
    } finally {
      setIntermodalLoading(false)
    }
  }, [venues, parks, setIntermodalLoading, setIntermodalError, setIntermodalHubs, setIntermodalRawData])

  const hubCounts = {
    bus_bike:      intermodalHubs.filter(h => h.hubType === 'bus_bike').length,
    auto_bike:     intermodalHubs.filter(h => h.hubType === 'auto_bike').length,
    auto_bus_bike: intermodalHubs.filter(h => h.hubType === 'auto_bus_bike').length,
    priority:      intermodalHubs.filter(h => h.priority === 'priority').length,
    existing:      intermodalHubs.filter(h => h.status === 'existing').length,
    proposed:      intermodalHubs.filter(h => h.status === 'proposed').length,
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0,
      width: 300,
      height: '100%',
      background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '4px 0 20px rgba(0,0,0,0.06)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1D1D1F', marginBottom: 2 }}>
          Intermodal Hub
        </div>
        <div style={{ fontSize: 12, color: '#6E6E73' }}>
          Wolfsburg · Multi-modal transfer points
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto' }}>

        {/* Run button */}
        <button
          onClick={handleRunAnalysis}
          disabled={intermodalLoading}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 10,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: intermodalLoading ? 'not-allowed' : 'pointer',
            border: 'none',
            background: intermodalLoading ? '#E0E0E0' : '#1D1D1F',
            color: intermodalLoading ? '#999' : '#fff',
            marginBottom: 16, transition: 'background 0.15s',
          }}
        >
          {intermodalLoading ? (fetchProgress || 'Loading…') : intermodalHubs.length ? 'Re-run Analysis' : 'Run Analysis'}
        </button>

        {/* Error */}
        {intermodalError && (
          <div style={{ fontSize: 12, color: '#EF4444', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
            {intermodalError}
          </div>
        )}

        {/* Results summary */}
        {intermodalHubs.length > 0 && (
          <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#1D1D1F' }}>
              {intermodalHubs.length} hubs identified
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                { label: `${hubCounts.priority} priority`, color: '#1D1D1F' },
                { label: `${hubCounts.existing} existing`, color: '#22C55E' },
                { label: `${hubCounts.proposed} proposed`, color: '#0071E3' },
              ].map(({ label, color }) => (
                <span key={label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 980, padding: '2px 8px', color, fontWeight: 500, fontSize: 11 }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Base Layers */}
        <Section title="Base Layers">
          <Toggle
            checked={intermodalShowBusStops}
            onChange={toggleIntermodalShowBusStops}
            label="Bus stops"
            color="#EF4444"
          />
          <Toggle
            checked={intermodalShowCarParkings}
            onChange={toggleIntermodalShowCarParkings}
            label="Car parkings"
            color="#6B7280"
          />
          <Toggle
            checked={intermodalShowBikeParkings}
            onChange={toggleIntermodalShowBikeParkings}
            label="Bike parkings"
            color="#22C55E"
          />
        </Section>

        {/* Hub Types */}
        {intermodalHubs.length > 0 && (
          <Section title="Hub Types">
            {['bus_bike', 'auto_bike', 'auto_bus_bike'].map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <HubTypePill
                  type={type}
                  active={intermodalHubTypes.has(type)}
                  onClick={() => toggleIntermodalHubType(type)}
                />
                <span style={{ fontSize: 11, color: '#AEAEB2' }}>{hubCounts[type]}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Status Filter */}
        {intermodalHubs.length > 0 && (
          <Section title="Status">
            {[
              { value: 'all',      label: 'All hubs' },
              { value: 'existing', label: 'Existing (bike parking present)' },
              { value: 'proposed', label: 'Proposed (new bike parking needed)' },
            ].map(({ value, label }) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#1D1D1F' }}>
                <div
                  onClick={() => setIntermodalStatusFilter(value)}
                  style={{
                    width: 16, height: 16, borderRadius: 8,
                    border: `2px solid ${intermodalStatusFilter === value ? '#0071E3' : '#ccc'}`,
                    background: intermodalStatusFilter === value ? '#0071E3' : '#fff',
                    flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {intermodalStatusFilter === value && (
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />
                  )}
                </div>
                {label}
              </label>
            ))}
          </Section>
        )}

        {/* Radius Layers */}
        <Section title="Radius Layers">
          <Toggle
            checked={intermodalShowFacilitiesRadius}
            onChange={toggleIntermodalFacilitiesRadius}
            label="Facilities radius (1500 m)"
            color="#F59E0B"
          />
          {intermodalShowFacilitiesRadius && (
            <div style={{ paddingLeft: 20 }}>
              <Toggle
                checked={intermodalShowFacilitiesPoints}
                onChange={toggleIntermodalFacilitiesPoints}
                label="Show facility points"
                color="#F59E0B"
              />
            </div>
          )}
          <Toggle
            checked={intermodalShowGreeneryRadius}
            onChange={toggleIntermodalGreeneryRadius}
            label="Greenery radius (500 m)"
            color="#22C55E"
          />
          {intermodalShowGreeneryRadius && (
            <div style={{ paddingLeft: 20 }}>
              <Toggle
                checked={intermodalShowParksOverlay}
                onChange={toggleIntermodalParksOverlay}
                label="Show park areas"
                color="#22C55E"
              />
            </div>
          )}
        </Section>

        {/* Legend */}
        {intermodalHubs.length > 0 && (
          <Section title="Legend">
            {[
              { type: 'bus_bike', label: 'Bus + Bike hub' },
              { type: 'auto_bike', label: 'Auto + Bike hub' },
              { type: 'auto_bus_bike', label: 'Auto + Bus + Bike hub' },
            ].map(({ type, label }) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1D1D1F' }}>
                <PieLegend hubType={type} />
                <span>{label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6E6E73', marginTop: 4 }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, border: '1.5px dashed #1D1D1F', background: 'transparent' }} />
              <span>Priority hub (score above median)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6E6E73' }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, border: '1.5px solid transparent', background: 'transparent', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 3, borderRadius: 7, background: '#22C55E40', border: '1px solid #22C55E' }} />
              </div>
              <span>Existing (bike parking present)</span>
            </div>
          </Section>
        )}

        {/* Data info */}
        {intermodalHubs.length > 0 && (
          <div style={{ fontSize: 11, color: '#AEAEB2', lineHeight: 1.5, marginTop: 4 }}>
            Data: OpenStreetMap · Overpass API<br />
            Facilities: venues.json + OSM enrichment
          </div>
        )}
      </div>
    </div>
  )
}
