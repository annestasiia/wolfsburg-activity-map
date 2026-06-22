#!/usr/bin/env python3
"""
compute_centrality_hubs.py

Recomputes 4-mode centrality adding the post-car hub network.

What changes vs the baseline (compute_centrality.py):
  - All bus stops → S-hub nodes (access points to the hub network)
  - Virtual hub-to-hub edges added at HUB_SPEED km/h for pairs ≤ HUB_RADIUS m apart
    (models autonomous shuttles / buses connecting S-hubs within the hub network)
  - Hub locations (L/M nodes from VW Werk + high-traffic stops) added as extra
    destinations so grid points that can REACH a hub within budget get extra credit
  - Walk / Bike / Auto graphs unchanged (hubs add transit capacity, not road infra)

Output: public/wolfsburg_centrality_hubs.geojson
  Same schema as wolfsburg_centrality.geojson — properties: score_walk, score_bike,
  score_drive, score_pt — so the frontend can load both side by side.

Run from repo root:
  python scripts/compute_centrality_hubs.py
"""

import json, math, sys, time
from collections import defaultdict
import numpy as np
import networkx as nx
from scipy.spatial import cKDTree

# ── Config ────────────────────────────────────────────────────────────────────
WALK_SPEED   = 4.5    # km/h
BIKE_SPEED   = 15.0   # km/h
AUTO_DEFAULT = 50.0   # km/h
BUS_SPEED    = 20.0   # km/h  (existing bus routes)
HUB_SPEED    = 30.0   # km/h  (autonomous hub-to-hub shuttle — faster than bus)
WALK_PT      = 4.5    # km/h  walk to nearest stop/hub
TIME_MIN     = 15.0   # minute budget

HUB_RADIUS_M = 5000   # connect S-hubs within this radius (matches NET_COV.s = 5km)
GRID_STEP_M  = 100

M_PER_LAT = 111_000.0
M_PER_LON = 111_000.0 * math.cos(math.radians(52.42))
BBOX = (10.55, 52.28, 10.95, 52.60)

# Fixed L/M hub anchor points (VW Werk gates + city centre + Wolfsburg Hbf)
FIXED_HUB_LM = [
    (10.7892, 52.4200),  # VW Werk south gate
    (10.7950, 52.4245),  # VW Werk east
    (10.7820, 52.4260),  # VW Werk north-west
    (10.7780, 52.4220),  # VW Werk west gate
    (10.7870, 52.4275),  # VW Werk north
    (10.7864, 52.4299),  # Wolfsburg Hbf (main station)
    (10.7800, 52.4285),  # City centre / Porschestr.
    (10.7920, 52.4180),  # Allerpark area
]

PUBLIC_BASE = "public"

# ── Utilities ─────────────────────────────────────────────────────────────────
def hav_m(lo1, la1, lo2, la2):
    R = 6_371_000
    dlat = math.radians(la2 - la1)
    dlon = math.radians(lo2 - lo1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(min(1.0, a)))

def edge_t(lo1, la1, lo2, la2, speed_kmh):
    return hav_m(lo1, la1, lo2, la2) / (speed_kmh * 1000 / 60)

def load(name):
    with open(f"{PUBLIC_BASE}/{name}", encoding="utf-8") as f:
        return json.load(f)

def log(msg): print(f"  {msg}", flush=True)

def to_m(arr):
    a = np.array(arr, dtype=np.float64)
    a[:, 0] *= math.cos(math.radians(52.42)) * M_PER_LON
    a[:, 1] *= M_PER_LAT
    return a

# ── Graph builders ────────────────────────────────────────────────────────────
def build_graph(features, default_speed, speed_prop=None):
    G = nx.Graph()
    for feat in features:
        g = feat.get("geometry", {})
        props = feat.get("properties") or {}
        t_type = g.get("type")
        if t_type not in ("LineString", "MultiLineString"):
            continue
        speed = default_speed
        if speed_prop:
            raw = props.get(speed_prop, "")
            try: speed = min(float(str(raw).split()[0]), 130)
            except: pass
        lines = [g["coordinates"]] if t_type == "LineString" else g["coordinates"]
        for coords in lines:
            for i in range(len(coords) - 1):
                lo1, la1 = round(coords[i][0], 5),   round(coords[i][1], 5)
                lo2, la2 = round(coords[i+1][0], 5), round(coords[i+1][1], 5)
                if (lo1, la1) == (lo2, la2): continue
                G.add_edge((lo1, la1), (lo2, la2), weight=edge_t(lo1, la1, lo2, la2, speed))
    return G

def add_hub_network_edges(G, hub_pts, radius_m=HUB_RADIUS_M, speed=HUB_SPEED):
    """
    Add virtual direct edges between hub pairs within radius_m.
    These model autonomous shuttle/bus links — hub to hub, no road topology required.
    Edges are added directly to the graph as new nodes if not already present.
    """
    if len(hub_pts) < 2:
        return
    arr = np.array(hub_pts, dtype=np.float64)
    kd  = cKDTree(to_m(arr))
    pairs = kd.query_pairs(radius_m)
    added = 0
    for i, j in pairs:
        lo1, la1 = hub_pts[i]
        lo2, la2 = hub_pts[j]
        node1 = (round(lo1, 5), round(la1, 5))
        node2 = (round(lo2, 5), round(la2, 5))
        t = edge_t(lo1, la1, lo2, la2, speed)
        # Only add if faster than existing path (or no path yet)
        if G.has_edge(node1, node2):
            if G[node1][node2]["weight"] > t:
                G[node1][node2]["weight"] = t
        else:
            G.add_edge(node1, node2, weight=t)
            added += 1
    log(f"Hub network: added {added} virtual edges between {len(hub_pts)} hub nodes at <={radius_m//1000}km")

# ── Grid ──────────────────────────────────────────────────────────────────────
def make_grid():
    min_lon, min_lat, max_lon, max_lat = BBOX
    lat_step = GRID_STEP_M / M_PER_LAT
    lon_step = GRID_STEP_M / M_PER_LON
    pts = []
    la = min_lat
    while la <= max_lat:
        lo = min_lon
        while lo <= max_lon:
            pts.append((round(lo, 6), round(la, 6)))
            lo += lon_step
        la += lat_step
    return pts

# ── Reverse Dijkstra scoring ──────────────────────────────────────────────────
def compute_scores_reverse(G, grid_pts, dest_pts, cutoff_min, label=""):
    n = len(grid_pts)
    if n == 0 or not dest_pts or G.number_of_nodes() == 0:
        return np.zeros(n)

    nodes    = list(G.nodes())
    node_arr = np.array(nodes, dtype=np.float64)
    kd       = cKDTree(to_m(node_arr))

    g_arr = np.array(grid_pts, dtype=np.float64)
    _, g_idx = kd.query(to_m(g_arr))
    g_nodes  = [nodes[i] for i in g_idx]

    node2grid = defaultdict(list)
    for gi, gn in enumerate(g_nodes):
        node2grid[gn].append(gi)

    d_arr = np.array(dest_pts, dtype=np.float64)
    _, d_idx    = kd.query(to_m(d_arr))
    dest_nodes  = list({nodes[i] for i in d_idx})

    scores = np.zeros(n)
    t0 = time.time()
    for di, src in enumerate(dest_nodes):
        if di % 100 == 0 and di > 0:
            log(f"  [{label}] {di}/{len(dest_nodes)} dests, {time.time()-t0:.1f}s")
        try:
            lengths = nx.single_source_dijkstra_path_length(G, src, cutoff=cutoff_min)
        except: continue
        for rn in lengths:
            for gi in node2grid.get(rn, []):
                scores[gi] += 1
    return scores

# ── PT scoring (walk → hub/stop → hub network) ───────────────────────────────
def compute_pt_scores(pt_g, grid_pts, dest_pts, stop_pts):
    """
    PT with hub network: walk to nearest stop/hub, ride hub network within budget.
    Same algorithm as baseline but pt_g already contains hub-to-hub virtual edges.
    """
    n = len(grid_pts)
    if n == 0 or not dest_pts or not stop_pts or pt_g.number_of_nodes() == 0:
        return np.zeros(n)

    nodes    = list(pt_g.nodes())
    node_arr = np.array(nodes, dtype=np.float64)
    kd       = cKDTree(to_m(node_arr))
    stop_arr = np.array(stop_pts, dtype=np.float64)
    stop_kd  = cKDTree(to_m(stop_arr))

    d_arr = np.array(dest_pts, dtype=np.float64)
    _, d_idx   = kd.query(to_m(d_arr))
    dest_nodes = set(nodes[i] for i in d_idx)

    _, s_idx         = kd.query(to_m(stop_arr))
    stop_graph_nodes = [nodes[i] for i in s_idx]

    log(f"  [PT-hubs] precomputing {len(stop_pts)} stop/hub isochrones …")
    unique_stop_nodes = {}
    for si, sn in enumerate(stop_graph_nodes):
        if sn not in unique_stop_nodes:
            unique_stop_nodes[sn] = si

    stop_node_dest_times = {}
    for sn in unique_stop_nodes:
        try:
            lengths = nx.single_source_dijkstra_path_length(pt_g, sn, cutoff=TIME_MIN)
        except: lengths = {}
        stop_node_dest_times[sn] = {dn: t for dn, t in lengths.items() if dn in dest_nodes}

    log(f"  [PT-hubs] scoring {n} grid points …")
    g_arr  = np.array(grid_pts, dtype=np.float64)
    g_m    = to_m(g_arr)
    scores = np.zeros(n)

    for gi, (glo, gla) in enumerate(grid_pts):
        _, si     = stop_kd.query(g_m[gi])
        slo, sla  = stop_arr[si]
        walk_t    = hav_m(glo, gla, slo, sla) / (WALK_PT * 1000 / 60)
        remaining = TIME_MIN - walk_t
        if remaining <= 0: continue
        sn = stop_graph_nodes[si]
        dt = stop_node_dest_times.get(sn, {})
        scores[gi] = sum(1 for t in dt.values() if t <= remaining)

    return scores

def normalise(arr):
    mx = arr.max()
    return arr if mx == 0 else (arr / mx * 100).astype(np.float32)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading data …")
    roads      = load("wolfsburg_roads.geojson")["features"]
    footways   = load("wolfsburg_footways.geojson")["features"]
    cycling    = load("wolfsburg_cycling_official.geojson")["features"]
    facilities = load("wolfsburg_facilities.geojson")["features"]
    bus_stops  = load("wolfsburg_bus_stops.geojson")["features"]

    # ── Destinations: facilities + VW Werk + hub L/M anchors ─────────────────
    dest_pts = []
    for f in facilities:
        c = f.get("geometry", {}).get("coordinates")
        if c and not isinstance(c[0], list):
            dest_pts.append((c[0], c[1]))
    dest_pts.extend(FIXED_HUB_LM)
    log(f"Destinations (with hubs): {len(dest_pts)}")

    # ── Bus stop / hub S locations ────────────────────────────────────────────
    stop_pts = []
    for f in bus_stops:
        c = f.get("geometry", {}).get("coordinates")
        if c and not isinstance(c[0], list):
            stop_pts.append((c[0], c[1]))
    # Add fixed L/M hubs as high-quality entry points to the network
    stop_pts.extend(FIXED_HUB_LM)
    # Deduplicate
    stop_pts = list({(round(lo, 5), round(la, 5)) for lo, la in stop_pts})
    log(f"Stop/hub entry points: {len(stop_pts)}")

    # ── Build graphs ──────────────────────────────────────────────────────────
    drive_types = {"motorway","motorway_link","trunk","trunk_link","primary","primary_link",
                   "secondary","secondary_link","tertiary","tertiary_link",
                   "unclassified","residential","service","services","living_street",
                   "track","road"}

    print("Building walk graph …")
    walk_g = build_graph(roads + footways, WALK_SPEED)
    log(f"Walk: {walk_g.number_of_nodes()} nodes")

    print("Building bike graph …")
    bike_road = [f for f in roads if f.get("properties",{}).get("highway") not in
                 ("motorway","motorway_link","trunk","trunk_link")]
    bike_g = build_graph(cycling + bike_road, BIKE_SPEED)
    log(f"Bike: {bike_g.number_of_nodes()} nodes")

    print("Building auto graph …")
    auto_g = build_graph([f for f in roads if f.get("properties",{}).get("highway") in drive_types],
                         AUTO_DEFAULT, speed_prop="maxspeed")
    log(f"Auto: {auto_g.number_of_nodes()} nodes")

    print("Building PT+hub graph …")
    pt_g = build_graph([f for f in roads if f.get("properties",{}).get("highway") in drive_types],
                       BUS_SPEED)
    # KEY CHANGE: inject hub-to-hub virtual edges into PT graph
    add_hub_network_edges(pt_g, stop_pts, radius_m=HUB_RADIUS_M, speed=HUB_SPEED)
    log(f"PT+hub: {pt_g.number_of_nodes()} nodes, {pt_g.number_of_edges()} edges")

    # ── Grid ──────────────────────────────────────────────────────────────────
    print("Creating grid …")
    grid_pts = make_grid()
    log(f"Grid: {len(grid_pts)} points")

    # ── Compute scores ────────────────────────────────────────────────────────
    print("Computing walk scores (unchanged) …")
    t0 = time.time()
    walk_s = compute_scores_reverse(walk_g, grid_pts, dest_pts, TIME_MIN, "walk")
    log(f"done {time.time()-t0:.1f}s")

    print("Computing bike scores (unchanged) …")
    t0 = time.time()
    bike_s = compute_scores_reverse(bike_g, grid_pts, dest_pts, TIME_MIN, "bike")
    log(f"done {time.time()-t0:.1f}s")

    print("Computing auto scores (unchanged) …")
    t0 = time.time()
    auto_s = compute_scores_reverse(auto_g, grid_pts, dest_pts, TIME_MIN, "auto")
    log(f"done {time.time()-t0:.1f}s")

    print("Computing PT+hub scores …")
    t0 = time.time()
    pt_s = compute_pt_scores(pt_g, grid_pts, dest_pts, stop_pts)
    log(f"done {time.time()-t0:.1f}s")

    # ── Normalise against SAME baseline max to keep scales comparable ─────────
    # Load baseline to get normalisation maxima — if available
    baseline_path = f"{PUBLIC_BASE}/wolfsburg_centrality.geojson"
    try:
        with open(baseline_path, encoding="utf-8") as f:
            baseline = json.load(f)
        bw = [feat["properties"].get("w", feat["properties"].get("score_walk",  0)) for feat in baseline["features"]]
        bb = [feat["properties"].get("b", feat["properties"].get("score_bike",  0)) for feat in baseline["features"]]
        ba = [feat["properties"].get("a", feat["properties"].get("score_drive", 0)) for feat in baseline["features"]]
        bp = [feat["properties"].get("p", feat["properties"].get("score_pt",    0)) for feat in baseline["features"]]
        # Normalise hub scores relative to baseline max so colours are directly comparable
        def norm_rel(arr, baseline_vals):
            mx = max(max(baseline_vals), arr.max(), 1)
            return np.clip(arr / mx * 100, 0, 100).astype(np.float32)
        walk_n = norm_rel(walk_s, bw)
        bike_n = norm_rel(bike_s, bb)
        auto_n = norm_rel(auto_s, ba)
        pt_n   = norm_rel(pt_s,   bp)
        log("Normalised relative to baseline maxima (colours directly comparable).")
    except Exception as e:
        log(f"Could not load baseline for relative normalisation ({e}), using self-normalisation.")
        walk_n = normalise(walk_s)
        bike_n = normalise(bike_s)
        auto_n = normalise(auto_s)
        pt_n   = normalise(pt_s)

    # ── Write GeoJSON ─────────────────────────────────────────────────────────
    print("Writing GeoJSON …")
    features = []
    for i, (lo, la) in enumerate(grid_pts):
        sw, sb, sa, sp = float(walk_n[i]), float(bike_n[i]), float(auto_n[i]), float(pt_n[i])
        if sw + sb + sa + sp == 0:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lo, la]},
            "properties": {
                "w": round(sw, 1),
                "b": round(sb, 1),
                "a": round(sa, 1),
                "p": round(sp, 1),
            },
        })

    out = {"type": "FeatureCollection", "features": features}
    outpath = f"{PUBLIC_BASE}/wolfsburg_centrality_hubs.geojson"
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    sz = len(json.dumps(out)) / 1024 / 1024
    print(f"\nDone! {len(features)} points → {outpath} ({sz:.1f} MB)")
    print("Comparison tip: both files use the same 0-100 scale → use identical")
    print("choropleth colour ramps in the frontend for a direct visual comparison.")

if __name__ == "__main__":
    main()
