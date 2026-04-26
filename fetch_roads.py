"""
Run this script once to download Wolfsburg road data from Overpass API.
Result is saved to wolfsburg_roads.geojson (copy it to src/data/ afterwards).

Usage:
    python fetch_roads.py
"""
import urllib.request, urllib.parse, json, sys, io
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

QUERY = """
[out:json][timeout:90];
area["name"="Wolfsburg"]["boundary"="administrative"]->.city;
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|living_street|unclassified)$"](area.city);
);
out geom;
"""

ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]

raw = None
for url in ENDPOINTS:
    try:
        print(f'Trying {url} ...')
        body = urllib.parse.urlencode({'data': QUERY}).encode('utf-8')
        req  = urllib.request.Request(url, data=body,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with urllib.request.urlopen(req, timeout=100) as resp:
            raw = resp.read()
        print(f'  OK — {len(raw)/1024:.0f} KB')
        break
    except Exception as e:
        print(f'  FAILED: {e}')

if raw is None:
    print('All endpoints failed. Check your network connection.')
    sys.exit(1)

osm = json.loads(raw)
els = osm.get('elements', [])
print(f'OSM elements: {len(els)}')

features = []
for el in els:
    if el['type'] != 'way' or not el.get('geometry'):
        continue
    tags   = el.get('tags', {})
    coords = [[pt['lon'], pt['lat']] for pt in el['geometry']]
    features.append({
        'type': 'Feature',
        'properties': {
            'osm_id':   el['id'],
            'highway':  tags.get('highway', 'unclassified'),
            'name':     tags.get('name', ''),
            'maxspeed': tags.get('maxspeed', ''),
        },
        'geometry': {'type': 'LineString', 'coordinates': coords},
    })

geojson = {'type': 'FeatureCollection', 'features': features}
out     = json.dumps(geojson, ensure_ascii=False, separators=(',', ':'))

with open('wolfsburg_roads.geojson', 'w', encoding='utf-8') as f:
    f.write(out)

types = Counter(f['properties']['highway'] for f in features)
print(f'\nSaved wolfsburg_roads.geojson — {len(features)} roads, {len(out)//1024} KB')
for t, n in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {t:22s} {n}')

print('\nDone! Copy wolfsburg_roads.geojson to src/data/')
