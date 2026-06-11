export const CYCLING_WB_TYP_COLORS = {
  'Fahren auf der Fahrbahn':     '#607D8B',  // cycling on road — grey-blue
  'Feld-, Forst-, Treidelwege':  '#2E7D32',  // field/forest track — green
  'Gemeinsamer Geh- und Radweg': '#6A1B9A',  // shared pedestrian/cycle — purple
  'Gehweg, Radfahrer frei':      '#9C27B0',  // footway, cyclists allowed — light purple
  'Getrennter Geh- und Radweg':  '#1565C0',  // separate pedestrian/cycle — blue
  'Radwege außerhalb Wolfsburg': '#78909C',  // routes outside WB — grey
  'Radweg':                      '#0057B7',  // dedicated cycle path — main blue
  'Baulicher Radweg':            '#0288D1',  // structural cycle path — light blue
  'Radfahrstreifen':             '#00897B',  // cycle lane on road — teal
  'Schutzstreifen':              '#F57F17',  // advisory lane — amber
  'Fahrradstraße':               '#E53935',  // bicycle street — red
  'Sonstige':                    '#90A4AE',  // other — grey
}

export const CYCLING_WB_TYP_DEFAULT = '#78909C'

export const CYCLING_WB_TYP_LABELS = {
  'Fahren auf der Fahrbahn':     'Cycling on road',
  'Feld-, Forst-, Treidelwege':  'Field / forest track',
  'Gemeinsamer Geh- und Radweg': 'Shared footway & cycleway',
  'Gehweg, Radfahrer frei':      'Footway, cyclists allowed',
  'Getrennter Geh- und Radweg':  'Separate footway & cycleway',
  'Radwege außerhalb Wolfsburg': 'Routes outside Wolfsburg',
  'Radweg':                      'Dedicated cycle path',
  'Baulicher Radweg':            'Structural cycle path',
  'Radfahrstreifen':             'Cycle lane on road',
  'Schutzstreifen':              'Advisory cycle lane',
  'Fahrradstraße':               'Bicycle street',
  'Sonstige':                    'Other',
}

export const CYCLING_WB_COLOR_EXPR = [
  'match', ['get', 'typ'],
  ...Object.entries(CYCLING_WB_TYP_COLORS).flatMap(([k, v]) => [k, v]),
  CYCLING_WB_TYP_DEFAULT,
]
