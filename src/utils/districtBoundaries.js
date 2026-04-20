// Verified OSM relation IDs for Wolfsburg districts (April 2026)
// Each district maps to one or more OSM relations that are merged
// into a single GeoJSON MultiPolygon for display.

export const DISTRICT_CONFIG = {
  Stadtmitte: {
    relationIds: [3879168],
    color: '#185FA5',
    fillColor: '#185FA5',
    fillOpacity: 0.06,
  },
  'Mitte-West': {
    // Westhagen + Detmerode combined form this district
    relationIds: [3879170, 3879171],
    color: '#534AB7',
    fillColor: '#534AB7',
    fillOpacity: 0.06,
  },
  'Kästorf-Sandkamp': {
    // Kästorf + Sandkamp combined
    relationIds: [3879175, 3879176],
    color: '#1D9E75',
    fillColor: '#1D9E75',
    fillOpacity: 0.06,
  },
  Nordstadt: {
    relationIds: [3879169],
    color: '#BA7517',
    fillColor: '#BA7517',
    fillOpacity: 0.06,
  },
  Vorsfelde: {
    relationIds: [1263350],
    color: '#D85A30',
    fillColor: '#D85A30',
    fillOpacity: 0.06,
  },
  'Neuhaus-Reislingen': {
    // Neuhaus + Reislingen combined
    relationIds: [3879173, 3879174],
    color: '#3B6D11',
    fillColor: '#3B6D11',
    fillOpacity: 0.06,
  },
}

// Overpass endpoints tried in order — first success wins
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export function buildOverpassQuery(relationIds) {
  const unionBlock = relationIds.map((id) => `relation(${id});`).join('\n  ')
  return `[out:json][timeout:30];
(
  ${unionBlock}
);
(._;>;);
out body;`
}
