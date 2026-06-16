import React, { useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { runIntermodalAlgorithm, INTENSITY_FOOTFALL } from '../utils/intermodalAlgorithm'

// ── Config ────────────────────────────────────────────────────────────────────

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BBOX = '52.32,10.57,52.60,10.98'

const BUS_STOPS_Q = `[out:json][timeout:30];node["highway"="bus_stop"](${BBOX});out body;`

const CAR_PARKINGS_Q = `[out:json][timeout:30];(
  node["amenity"="parking"]["access"!="private"](${BBOX});
  way["amenity"="parking"]["access"!="private"](${BBOX});
);out center;`

const BIKE_PARKINGS_Q = `[out:json][timeout:30];node["amenity"="bicycle_parking"](${BBOX});out body;`

const OSM_FACILITIES_Q = `[out:json][timeout:90];(
  node["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre|social_centre|marketplace"](${BBOX});
  way["amenity"~"theatre|cinema|museum|arts_centre|library|community_centre|social_centre"](${BBOX});
  node["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium|ice_rink"](${BBOX});
  way["leisure"~"sports_centre|fitness_centre|swimming_pool|stadium"](${BBOX});
  node["shop"~"supermarket|grocery|convenience|bakery|butcher|hardware|electronics|department_store|mall"](${BBOX});
  way["shop"~"supermarket|grocery|convenience|department_store|mall"](${BBOX});
  node["amenity"~"school|university|college|kindergarten"](${BBOX});
  way["amenity"~"school|university|college|kindergarten"](${BBOX});
  node["amenity"~"hospital|clinic|doctors|dentist|pharmacy|health_post"](${BBOX});
  way["amenity"~"hospital|clinic|pharmacy"](${BBOX});
  node["amenity"~"fuel|bank|post_office"](${BBOX});
);out center;`

const FORESTS_Q = `[out:json][timeout:90];(
  way["landuse"="forest"](${BBOX});
  way["natural"="wood"](${BBOX});
  relation["landuse"="forest"](${BBOX});
  relation["natural"="wood"](${BBOX});
);out geom;`

const RESIDENTIAL_Q = `[out:json][timeout:90];(
  way["landuse"="residential"](${BBOX});
  relation["landuse"="residential"](${BBOX});
);out geom;`

// ── Footfall + category maps ──────────────────────────────────────────────────

const OSM_FOOTFALL = {
  hospital: 800, clinic: 300, doctors: 200, dentist: 120, pharmacy: 180, health_post: 100,
  school: 400, university: 600, college: 400, kindergarten: 150,
  supermarket: 700, grocery: 350, convenience: 250, bakery: 180, butcher: 140,
  hardware: 200, electronics: 250, department_store: 500, mall: 900, marketplace: 400,
  sports_centre: 300, fitness_centre: 250, swimming_pool: 250, stadium: 800, ice_rink: 200,
  theatre: 350, cinema: 400, museum: 200, arts_centre: 150, library: 150,
  community_centre: 120, social_centre: 100,
  fuel: 200, bank: 150, post_office: 100,
}
const OSM_HOURS = {
  hospital: 'daily 00:00–24:00', clinic: 'Mo–Fr 08:00–18:00',
  school: 'Mo–Fr 07:30–17:00', university: 'Mo–Fr 08:00–18:00', college: 'Mo–Fr 08:00–17:00',
  kindergarten: 'Mo–Fr 07:00–17:00',
  supermarket: 'Mo–Sa 07:00–22:00', grocery: 'Mo–Sa 07:00–21:00',
  convenience: 'Mo–Su 06:00–22:00', bakery: 'Mo–Sa 06:00–18:00',
  mall: 'Mo–Su 09:00–21:00', department_store: 'Mo–Sa 09:00–20:00',
  sports_centre: 'Mo–Su 07:00–22:00', fitness_centre: 'Mo–Su 06:00–23:00',
  swimming_pool: 'Mo–Su 07:00–21:00',
  theatre: 'Tue–Su 10:00–22:00', cinema: 'Mo–Su 10:00–24:00',
  museum: 'Tue–Su 10:00–18:00', library: 'Mo–Fr 09:00–19:00',
  community_centre: 'Mo–Fr 09:00–21:00',
  fuel: 'Mo–Su 00:00–24:00', bank: 'Mo–Fr 09:00–17:00', post_office: 'Mo–Fr 08:00–18:00',
}

export const CATEGORY_COLORS = {
  culture: '#534AB7', commercial: '#BA7517', educational: '#185FA5',
  leisure: '#1D9E75', healthcare: '#D62828', other: '#6B7280',
}
export const CATEGORY_LABELS = {
  culture: 'Culture', commercial: 'Commercial', educational: 'Educational',
  leisure: 'Leisure', healthcare: 'Healthcare', other: 'Other',
}

function osmAmenityToCategory(amenity, shop, leisure) {
  if (['hospital','clinic','doctors','dentist','pharmacy','health_post'].includes(amenity)) return 'healthcare'
  if (['school','university','college','kindergarten'].includes(amenity)) return 'educational'
  if (['theatre','cinema','museum','arts_centre','library','community_centre','social_centre'].includes(amenity)) return 'culture'
  if (shop || ['fuel','bank','post_office','marketplace'].includes(amenity)) return 'commercial'
  if (leisure) return 'leisure'
  return 'other'
}

function osmElementToVenue(el) {
  const props = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!lat || !lng) return null
  const amenity = props.amenity || ''
  const shop    = props.shop || ''
  const leisure = props.leisure || ''
  const key     = amenity || leisure || shop
  const footfall  = OSM_FOOTFALL[key] ?? 100
  const hours     = OSM_HOURS[key] ?? null
  const _category = osmAmenityToCategory(amenity, shop, leisure)
  return {
    id: `osm-${el.id}`,
    name: props.name || key || 'Facility',
    lat, lng,
    category: _category.charAt(0).toUpperCase() + _category.slice(1),
    _category,
    activityIntensity: footfall >= 500 ? 'High' : footfall >= 200 ? 'Medium' : 'Low',
    openingHours: hours || '—',
    _footfall: footfall,
    _activeHours: hours,
  }
}

function osmToGeoJSON(elements, type) {
  const features = elements
    .filter(el => (el.lat ?? el.center?.lat) && (el.lon ?? el.center?.lon))
    .map(el => {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      return { type: 'Feature', id: `${type}-${el.id}`,
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { ...(el.tags || {}), _osmType: type } }
    })
  return { type: 'FeatureCollection', features }
}

// Parses Overpass `out geom;` response — geometry is embedded inline in each element
function osmPolygonToGeoJSON(data) {
  const features = []
  for (const el of data.elements || []) {
    if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
      const coords = el.geometry.map(p => [p.lon, p.lat])
      features.push({ type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { name: el.tags?.name || '' },
      })
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      // Use outer member ways as polygon rings
      for (const m of el.members) {
        if (m.type === 'way' && m.role === 'outer' && Array.isArray(m.geometry) && m.geometry.length >= 4) {
          const coords = m.geometry.map(p => [p.lon, p.lat])
          features.push({ type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { name: el.tags?.name || '' },
          })
        }
      }
    }
  }
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

// ── Pie chart SVG ─────────────────────────────────────────────────────────────
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
  if (hubType === 'bus_bike')       sectors = [{ c: '#EF4444', s: 0, e: 180 }, { c: '#22C55E', s: 180, e: 360 }]
  else if (hubType === 'auto_bike') sectors = [{ c: '#6B7280', s: 0, e: 180 }, { c: '#22C55E', s: 180, e: 360 }]
  else                              sectors = [{ c: '#6B7280', s: 0, e: 120 }, { c: '#EF4444', s: 120, e: 240 }, { c: '#22C55E', s: 240, e: 360 }]
  const paths = sectors.map(({ c, s, e }) => `<path d="${sectorPath(cx, cy, r, s, e)}" fill="${c}"/>`).join('')
  const border = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${strokeW}"/>`
  const outer  = priority === 'priority'
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="#1D1D1F" stroke-width="1.5" stroke-dasharray="3 2"/>`
    : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${outer}${paths}${border}</svg>`
}

// ── UI primitives ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, color, indent = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1D1D1F', paddingLeft: indent ? 12 : 0 }}>
      <div onClick={onChange} style={{
        width: 32, height: 18, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
        background: checked ? (color || '#0071E3') : '#E0E0E0', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 15 : 2, width: 14, height: 14,
          borderRadius: 7, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label}
    </label>
  )
}

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#AEAEB2', marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  )
}
function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 0' }} />
}
const scaleBtn = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)',
  background: '#F5F5F7', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 16, fontWeight: 500, color: '#1D1D1F', display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

function geojsonFacilityToVenue(feature) {
  const props = feature.properties || {}
  if (!feature.geometry?.coordinates) return null
  const [lng, lat] = feature.geometry.coordinates
  if (!lat || !lng) return null
  const amenity = props.amenity || ''
  const shop    = props.shop || ''
  const leisure = props.leisure || ''
  const key     = amenity || leisure || shop
  const footfall  = OSM_FOOTFALL[key] ?? 100
  const hours     = OSM_HOURS[key] ?? null
  const _category = osmAmenityToCategory(amenity, shop, leisure)
  return {
    id: `osm-${props._id || props._osmId || Math.random().toString(36).slice(2)}`,
    name: props.name || key || 'Facility',
    lat, lng,
    category: _category.charAt(0).toUpperCase() + _category.slice(1),
    _category,
    activityIntensity: footfall >= 500 ? 'High' : footfall >= 200 ? 'Medium' : 'Low',
    openingHours: hours || '—',
    _footfall: footfall,
    _activeHours: hours,
  }
}

// ── IntermodalDataPanel — right panel (Data Layers + Density) ─────────────────
export function IntermodalDataPanel() {
  const {
    intermodalLoading, intermodalError,
    intermodalRawBusStops, intermodalRawCarParkings, intermodalRawBikeParkings, intermodalRawOsmFacilities,
    intermodalShowBusStops, intermodalShowCarParkings, intermodalShowBikeParkings,
    intermodalShowFacilities, intermodalFacilityCategories, intermodalShowParksBase,
    intermodalShowFacilitiesRadius, intermodalShowGreeneryRadius,
    intermodalShowFacilitiesPoints, intermodalShowParksOverlay,
    intermodalLoadProgress,
    setIntermodalLoading, setIntermodalError, setIntermodalRawData, setIntermodalLoadProgress,
    toggleIntermodalShowBusStops, toggleIntermodalShowCarParkings, toggleIntermodalShowBikeParkings,
    toggleIntermodalShowFacilities, toggleIntermodalFacilityCategory, toggleIntermodalShowParksBase,
    toggleIntermodalFacilitiesRadius, toggleIntermodalGreeneryRadius,
    toggleIntermodalFacilitiesPoints, toggleIntermodalParksOverlay,
    localBusStops, localCarParkings, localBikeParkings, localFacilities, localParksForests,
    densityConfig, setDensityConfig,
  } = useAppStore()

  const dataLoaded = !!(intermodalRawBusStops && intermodalRawCarParkings)

  const handleLoadData = useCallback(async () => {
    if (!localBusStops) return
    setIntermodalLoading(true)
    setIntermodalError(null)
    setIntermodalLoadProgress('Loading residential zones…')
    try {
      const residentialRaw = await overpassFetch(RESIDENTIAL_Q)
      const osmFacs       = (localFacilities?.features || []).map(geojsonFacilityToVenue).filter(Boolean)
      const residentialGJ = osmPolygonToGeoJSON(residentialRaw)
      setIntermodalRawData(localBusStops, localCarParkings, localBikeParkings, osmFacs, localParksForests, residentialGJ)
      setIntermodalLoadProgress('')
    } catch (err) {
      console.error('Intermodal load error:', err)
      setIntermodalError('Failed to load residential data. Check your connection.')
      setIntermodalLoadProgress('')
    } finally {
      setIntermodalLoading(false)
    }
  }, [localBusStops, localCarParkings, localBikeParkings, localFacilities, localParksForests,
      setIntermodalLoading, setIntermodalError, setIntermodalRawData, setIntermodalLoadProgress])

  useEffect(() => {
    if (!localBusStops || dataLoaded || intermodalLoading) return
    handleLoadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBusStops])

  const busCount  = intermodalRawBusStops?.features?.length ?? 0
  const carCount  = intermodalRawCarParkings?.features?.length ?? 0
  const bikeCount = intermodalRawBikeParkings?.features?.length ?? 0
  const facCount  = intermodalRawOsmFacilities?.length ?? 0

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 230, height: '100%',
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.06)', zIndex: 20,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>Layers</div>
      </div>

      {intermodalLoading && (
        <div style={{ background: '#FFF3CD', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '5px 14px', fontSize: 13, color: '#856404', flexShrink: 0 }}>
          {intermodalLoadProgress || 'Loading…'}
        </div>
      )}
      {intermodalError && (
        <div style={{ background: '#FEF2F2', padding: '5px 14px', fontSize: 13, color: '#EF4444', flexShrink: 0 }}>
          {intermodalError}
          <button onClick={handleLoadData} style={{ marginLeft: 6, fontFamily: 'inherit', fontSize: 13, color: '#0071E3', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 16px' }}>

        <SectionHead>Data Layers</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 4 }}>
          <Toggle checked={intermodalShowBusStops} onChange={toggleIntermodalShowBusStops}
            label={`Bus stops${busCount ? ` (${busCount})` : ''}`} color="#EF4444" />
          <Toggle checked={intermodalShowCarParkings} onChange={toggleIntermodalShowCarParkings}
            label={`Car parkings${carCount ? ` (${carCount})` : ''}`} color="#6B7280" />
          <Toggle checked={intermodalShowBikeParkings} onChange={toggleIntermodalShowBikeParkings}
            label={`Bike parkings${bikeCount ? ` (${bikeCount})` : ''}`} color="#22C55E" />

          <Toggle checked={intermodalShowFacilities} onChange={toggleIntermodalShowFacilities}
            label={`Facilities${facCount ? ` (${facCount})` : ''}`} color="#F59E0B" />

          {intermodalShowFacilities && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 10, marginTop: 2 }}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const active = intermodalFacilityCategories.has(key)
                const color  = CATEGORY_COLORS[key]
                return (
                  <button key={key} onClick={() => toggleIntermodalFacilityCategory(key)}
                    style={{
                      fontSize: 13, fontWeight: 500, padding: '2px 7px', borderRadius: 980,
                      fontFamily: 'inherit', cursor: 'pointer',
                      border: `1.5px solid ${active ? color : 'rgba(0,0,0,0.10)'}`,
                      background: active ? `${color}18` : 'transparent',
                      color: active ? color : '#AEAEB2',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          <Toggle checked={intermodalShowParksBase} onChange={toggleIntermodalShowParksBase}
            label="Parks & Forests" color="#16A34A" />
        </div>

        {!dataLoaded && !intermodalLoading && (
          <button onClick={handleLoadData} style={{
            width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.12)',
            background: '#F5F5F7', color: '#1D1D1F', marginTop: 6,
          }}>
            Reload OSM data
          </button>
        )}

        <Divider />

        <SectionHead>Radius Layers</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 4 }}>
          <Toggle checked={intermodalShowFacilitiesRadius} onChange={toggleIntermodalFacilitiesRadius}
            label="Facilities radius (1500 m)" color="#F59E0B" />
          {intermodalShowFacilitiesRadius && (
            <Toggle indent checked={intermodalShowFacilitiesPoints} onChange={toggleIntermodalFacilitiesPoints}
              label="Show facility points" color="#F59E0B" />
          )}
          <Toggle checked={intermodalShowGreeneryRadius} onChange={toggleIntermodalGreeneryRadius}
            label="Greenery radius (500 m)" color="#22C55E" />
          {intermodalShowGreeneryRadius && (
            <Toggle indent checked={intermodalShowParksOverlay} onChange={toggleIntermodalParksOverlay}
              label="Show park areas" color="#22C55E" />
          )}
        </div>

        <Divider />

        <SectionHead>Density Config</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
          {[
            { key: 'high',   label: 'High density (top 30%)',  color: '#EF4444' },
            { key: 'medium', label: 'Medium density (mid 40%)', color: '#F59E0B' },
            { key: 'low',    label: 'Low density (bottom 30%)', color: '#6B7280' },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#6E6E73', flex: 1, lineHeight: 1.3 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number" min={50} max={3000} step={50}
                  value={densityConfig[key]}
                  onChange={e => setDensityConfig(key, Number(e.target.value))}
                  style={{
                    width: 56, padding: '3px 6px', borderRadius: 6, fontSize: 13,
                    border: '1px solid rgba(0,0,0,0.15)', fontFamily: 'inherit',
                    color: '#1D1D1F', background: '#fff', textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, color: '#AEAEB2' }}>m</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#AEAEB2', lineHeight: 1.5, marginTop: 6 }}>
          Exclusion radius per score tier · Re-run Analysis to apply
        </div>

        <div style={{ fontSize: 13, color: '#AEAEB2', lineHeight: 1.5, marginTop: 12 }}>
          Local GeoJSON library · OSM Overpass (residential)
        </div>
      </div>
    </div>
  )
}

// ── IntermodalSidebar — left panel (Analysis) ─────────────────────────────────
export default function IntermodalSidebar() {
  const {
    venues, parks,
    intermodalLoading, intermodalError, intermodalHubs,
    intermodalRawBusStops, intermodalRawCarParkings, intermodalRawBikeParkings,
    intermodalRawOsmFacilities, intermodalRawForests, intermodalRawResidential,
    intermodalHubTypes, intermodalStatusFilter,
    intermodalObjectScale, intermodalLoadProgress,
    densityConfig,
    setIntermodalLoading, setIntermodalError, setIntermodalHubs, setIntermodalLoadProgress,
    toggleIntermodalHubType, setIntermodalStatusFilter,
    setIntermodalObjectScale,
  } = useAppStore()

  const dataLoaded = !!(intermodalRawBusStops && intermodalRawCarParkings)

  const handleRunAnalysis = useCallback(async () => {
    if (!dataLoaded) return
    setIntermodalLoading(true)
    setIntermodalError(null)
    setIntermodalHubs([])
    setIntermodalLoadProgress('Running algorithm…')
    try {
      const allVenues = [...venues, ...(intermodalRawOsmFacilities || [])]
      const greenGJ = {
        type: 'FeatureCollection',
        features: [...(parks?.features || []), ...(intermodalRawForests?.features || [])],
      }
      const hubs = runIntermodalAlgorithm(
        allVenues, intermodalRawBusStops, intermodalRawCarParkings,
        intermodalRawBikeParkings, greenGJ, intermodalRawResidential, densityConfig
      )
      setIntermodalHubs(hubs)
      setIntermodalLoadProgress('')
    } catch (err) {
      console.error('Algorithm error:', err)
      setIntermodalError('Analysis failed. Try reloading data.')
      setIntermodalLoadProgress('')
    } finally {
      setIntermodalLoading(false)
    }
  }, [venues, parks, intermodalRawBusStops, intermodalRawCarParkings, intermodalRawBikeParkings,
      intermodalRawOsmFacilities, intermodalRawForests, intermodalRawResidential, densityConfig,
      setIntermodalLoading, setIntermodalError, setIntermodalHubs, setIntermodalLoadProgress])

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
      position: 'absolute', top: 0, left: 0, width: 280, height: '100%',
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '4px 0 20px rgba(0,0,0,0.06)', zIndex: 20,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F' }}>Intermodal Hub</div>
        <div style={{ fontSize: 13, color: '#6E6E73' }}>Wolfsburg · Multi-modal transfer points</div>
      </div>

      {intermodalLoading && (
        <div style={{ background: '#FFF3CD', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '6px 16px', fontSize: 13, color: '#856404', flexShrink: 0 }}>
          {intermodalLoadProgress || 'Loading…'}
        </div>
      )}
      {intermodalError && !intermodalLoading && (
        <div style={{ background: '#FEF2F2', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '8px 16px', fontSize: 13, color: '#EF4444', flexShrink: 0 }}>
          {intermodalError}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>

        {/* ── ANALYSIS ─────────────────────────────────────────────────────── */}
        <SectionHead>Analysis</SectionHead>
        <button onClick={handleRunAnalysis} disabled={intermodalLoading || !dataLoaded}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 4, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            fontFamily: 'inherit', cursor: (intermodalLoading || !dataLoaded) ? 'not-allowed' : 'pointer',
            border: 'none', marginBottom: 12,
            background: (intermodalLoading || !dataLoaded) ? '#E0E0E0' : '#1D1D1F',
            color: (intermodalLoading || !dataLoaded) ? '#999' : '#fff',
                      }}>
          {intermodalLoading && intermodalLoadProgress === 'Running algorithm…' ? 'Running…'
            : intermodalHubs.length ? 'Re-run Analysis' : 'Run Analysis'}
        </button>

        {/* Results summary */}
        {intermodalHubs.length > 0 && (
          <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#1D1D1F' }}>{intermodalHubs.length} hubs identified</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                { label: `${hubCounts.priority} priority`, color: '#1D1D1F' },
                { label: `${hubCounts.existing} existing`, color: '#22C55E' },
                { label: `${hubCounts.proposed} proposed`, color: '#0071E3' },
              ].map(({ label, color }) => (
                <span key={label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 980, padding: '2px 8px', color, fontWeight: 500, fontSize: 13 }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hub Types */}
        {intermodalHubs.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#AEAEB2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>Hub Types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
              {[
                { type: 'bus_bike',      label: 'Bus + Bike',        color: '#EF4444' },
                { type: 'auto_bike',     label: 'Auto + Bike',       color: '#6B7280' },
                { type: 'auto_bus_bike', label: 'Auto + Bus + Bike', color: '#7C3AED' },
              ].map(({ type, label, color }) => {
                const active = intermodalHubTypes.has(type)
                return (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => toggleIntermodalHubType(type)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      borderRadius: 980, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1.5px solid ${active ? color : 'rgba(0,0,0,0.10)'}`,
                      background: active ? `${color}18` : 'transparent',
                      color: active ? color : '#6E6E73',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: active ? color : '#ccc', flexShrink: 0 }} />
                      {label}
                    </button>
                    <span style={{ fontSize: 13, color: '#AEAEB2' }}>{hubCounts[type]}</span>
                  </div>
                )
              })}
            </div>

            {/* Status filter */}
            <div style={{ fontSize: 13, color: '#AEAEB2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
              {[
                { value: 'all',      label: 'All hubs' },
                { value: 'existing', label: 'Existing (bike parking present)' },
                { value: 'proposed', label: 'Proposed (needs bike parking)' },
              ].map(({ value, label }) => (
                <label key={value} onClick={() => setIntermodalStatusFilter(value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#1D1D1F' }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                    border: `2px solid ${intermodalStatusFilter === value ? '#0071E3' : '#ccc'}`,
                    background: intermodalStatusFilter === value ? '#0071E3' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {intermodalStatusFilter === value && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                  </div>
                  {label}
                </label>
              ))}
            </div>
          </>
        )}

        <Divider />

        {/* ── LEGEND ─────────────────────────────────────────────────────────── */}
        {intermodalHubs.length > 0 && (
          <>
            <SectionHead>Legend</SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {[
                { type: 'bus_bike',      label: 'Bus + Bike hub' },
                { type: 'auto_bike',     label: 'Auto + Bike hub' },
                { type: 'auto_bus_bike', label: 'Auto + Bus + Bike hub' },
              ].map(({ type, label }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1D1D1F' }}>
                  <span dangerouslySetInnerHTML={{ __html: makePieSVG(type, 'potential', 20) }} style={{ display: 'inline-block', width: 20, height: 20, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6E6E73' }}>
                <span dangerouslySetInnerHTML={{ __html: makePieSVG('bus_bike', 'priority', 20) }} style={{ display: 'inline-block', width: 20, height: 20, flexShrink: 0 }} />
                Priority hub (score above median)
              </div>
            </div>
          </>
        )}

        {/* ── OBJECT SIZE ─────────────────────────────────────────────────────── */}
        <SectionHead>Object Size</SectionHead>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button onClick={() => setIntermodalObjectScale(intermodalObjectScale - 0.25)} style={scaleBtn}>−</button>
          <div style={{ flex: 1, background: '#F5F5F7', borderRadius: 8, padding: '4px 10px', fontSize: 13, textAlign: 'center', color: '#1D1D1F', fontWeight: 500 }}>
            ×{intermodalObjectScale.toFixed(2)}
          </div>
          <button onClick={() => setIntermodalObjectScale(intermodalObjectScale + 0.25)} style={scaleBtn}>+</button>
        </div>
      </div>
    </div>
  )
}
