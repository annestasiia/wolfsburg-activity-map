"""
Run once to download Wolfsburg pedestrian footway data from Overpass API.
Copy result to public/wolfsburg_footways.geojson afterwards.

Usage:
    pip install requests
    python fetch_footways.py
"""
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests', '-q'])
    import requests

QUERY = """
[out:json][timeout:90];
area["name"="Wolfsburg"]["boundary"="administrative"]->.city;
(
  way["highway"~"^(footway|path|pedestrian|steps)$"](area.city);
);
out geom;
"""

ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]

data = None
for url in ENDPOINTS:
    try:
        print(f'Trying {url} ...')
        resp = requests.post(url, data={'data': QUERY}, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        print(f'  OK — {len(resp.content)//1024} KB')
        break
    except Exception as e:
        print(f'  FAILED: {e}')

if data is None:
    print('All endpoints failed.')
    sys.exit(1)

features = []
for el in data.get('elements', []):
    if el['type'] != 'way' or 'geometry' not in el:
        continue
    coords = [[p['lon'], p['lat']] for p in el['geometry']]
    features.append({
        'type': 'Feature',
        'geometry': {'type': 'LineString', 'coordinates': coords},
        'properties': {
            'osm_id':  el['id'],
            'highway': el.get('tags', {}).get('highway', 'path'),
            'name':    el.get('tags', {}).get('name', ''),
        },
    })

geojson = {'type': 'FeatureCollection', 'features': features}
with open('wolfsburg_footways.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, separators=(',', ':'))

from collections import Counter
types = Counter(f['properties']['highway'] for f in features)
print(f'\nSaved wolfsburg_footways.geojson — {len(features)} segments')
for t, n in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {t:15s} {n}')
print('\nDone! Copy wolfsburg_footways.geojson to public/')
