#!/usr/bin/env python3
"""
Compute 4-mode accessibility centrality for Wolfsburg.
Grid: 100 m spacing within city bbox.
Modes: walk, bike, auto, pt (public transit)
Output: public/wolfsburg_centrality.geojson
  Each point: { score_walk, score_bike, score_drive, score_pt }
"""

import json, math, sys, time
from collections import defaultdict
import numpy as np
import networkx as nx
from scipy.spatial import cKDTree

# ─── Config ──────────────────────────────────────────────────────────────────
WALK_SPEED   = 4.5    # km/h
BIKE_SPEED   = 15.0   # km/h
AUTO_DEFAULT = 50.0   # km/h (when no maxspeed tag)
BUS_SPEED    = 20.0   # km/h
WALK_PT      = 4.5    # km/h (walk to bus stop)
TIME_MIN     = 15.0   # minutes budget

GRID_STEP_M  = 100    # meters

# Approx lon/lat per meter at 52.4°N
M_PER_LAT = 111_000.0
M_PER_LON = 111_000.0 * math.cos(math.radians(52.42))

BBOX = (10.55, 52.28, 10.95, 52.60)  # minLon, minLat, maxLon, maxLat

# VW Werk Wolfsburg – main gate + perimeter points
VW_WERK_POINTS = [
    (10.7892, 52.4200),  # main gate (south)
    (10.7950, 52.4245),  # east
    (10.7820, 52.4260),  # north-west
    (10.7780, 52.4220),  # west gate
    (10.7870, 52.4275),  # north
]

PUBLIC_BASE = "../public"

# ─── Utilities ────────────────────────────────────────────────────────────────
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

def log(msg):
    print(f"  {msg}", flush=True)

# ─── Graph builders ───────────────────────────────────────────────────────────
def build_graph(features, default_speed, speed_prop=None):
    """Undirected graph from GeoJSON LineStrings, weights in minutes."""
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
            try:
                speed = min(float(str(raw).split()[0]), 130)
            except Exception:
                pass
        lines = [g["coordinates"]] if t_type == "LineString" else g["coordinates"]
        for coords in lines:
            for i in range(len(coords) - 1):
                lo1, la1 = round(coords[i][0], 5), round(coords[i][1], 5)
                lo2, la2 = round(coords[i+1][0], 5), round(coords[i+1][1], 5)
                if (lo1, la1) == (lo2, la2):
                    continue
                t = edge_t(lo1, la1, lo2, la2, speed)
                G.add_edge((lo1, la1), (lo2, la2), weight=t)
    return G

# ─── Grid ────────────────────────────────────────────────────────────────────
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

# ─── Score computation (reverse Dijkstra from destinations) ──────────────────
def to_m(arr):
    """Convert (lon, lat) array to approximate metres for KDTree."""
    a = arr.copy()
    a[:, 0] *= math.cos(math.radians(52.42)) * M_PER_LON
    a[:, 1] *= M_PER_LAT
    return a

def compute_scores_reverse(G, grid_pts, dest_pts, cutoff_min, label=""):
    """
    For each destination run Dijkstra on G (undir = symmetric),
    mark reachable grid nodes, accumulate count.
    """
    n = len(grid_pts)
    if n == 0 or not dest_pts or G.number_of_nodes() == 0:
        return np.zeros(n)

    nodes = list(G.nodes())
    node_arr = np.array(nodes, dtype=np.float64)
    kd = cKDTree(to_m(node_arr))

    # Snap grid points → nearest graph node (in metre space)
    g_arr = np.array(grid_pts, dtype=np.float64)
    _, g_idx = kd.query(to_m(g_arr))
    g_nodes = [nodes[i] for i in g_idx]

    # Map node → list of grid indices
    node2grid = defaultdict(list)
    for gi, gn in enumerate(g_nodes):
        node2grid[gn].append(gi)

    # Snap destinations → nearest graph node (deduplicate)
    d_arr = np.array(dest_pts, dtype=np.float64)
    _, d_idx = kd.query(to_m(d_arr))
    dest_nodes = list({nodes[i] for i in d_idx})

    scores = np.zeros(n)
    t0 = time.time()
    for di, src in enumerate(dest_nodes):
        if di % 100 == 0 and di > 0:
            elapsed = time.time() - t0
            log(f"  [{label}] {di}/{len(dest_nodes)} dests, {elapsed:.1f}s elapsed")
        try:
            lengths = nx.single_source_dijkstra_path_length(G, src, cutoff=cutoff_min)
        except Exception:
            continue
        for rn in lengths:
            for gi in node2grid.get(rn, []):
                scores[gi] += 1

    return scores

# ─── Public Transit scoring ───────────────────────────────────────────────────
def compute_pt_scores(bus_graph, grid_pts, dest_pts, stop_pts):
    """
    Walk to nearest bus stop, remaining time on bus network.
    Precompute: for each stop, Dijkstra → dict{node: time}
    Query: for each grid point, pick nearest stop, remaining = 15 - walk_time,
           count dest nodes reachable within remaining_time.
    """
    n = len(grid_pts)
    if n == 0 or not dest_pts or not stop_pts or bus_graph.number_of_nodes() == 0:
        return np.zeros(n)

    nodes     = list(bus_graph.nodes())
    node_arr  = np.array(nodes, dtype=np.float64)
    kd        = cKDTree(to_m(node_arr))
    stop_arr  = np.array(stop_pts, dtype=np.float64)
    stop_kd   = cKDTree(to_m(stop_arr))

    # Snap destinations → graph nodes
    d_arr = np.array(dest_pts, dtype=np.float64)
    _, d_idx = kd.query(to_m(d_arr))
    dest_nodes = set(nodes[i] for i in d_idx)

    # Snap bus stops → graph nodes
    _, s_idx = kd.query(to_m(stop_arr))
    stop_graph_nodes = [nodes[i] for i in s_idx]

    # Precompute per-stop reachability: {stop_i: {dest_node: time}}
    log(f"  [PT] precomputing {len(stop_pts)} bus stop isochrones …")
    unique_stop_nodes = {}  # graph_node -> stop_index (first seen)
    for si, sn in enumerate(stop_graph_nodes):
        if sn not in unique_stop_nodes:
            unique_stop_nodes[sn] = si

    stop_node_dest_times = {}  # graph_node → {dest_node: min_time}
    for sn, si in unique_stop_nodes.items():
        try:
            lengths = nx.single_source_dijkstra_path_length(bus_graph, sn, cutoff=TIME_MIN)
        except Exception:
            lengths = {}
        stop_node_dest_times[sn] = {dn: t for dn, t in lengths.items() if dn in dest_nodes}

    log(f"  [PT] stop precompute done, scoring {n} grid points …")

    # Score each grid point
    g_arr = np.array(grid_pts, dtype=np.float64)
    g_m   = to_m(g_arr)
    scores = np.zeros(n)

    for gi, (glo, gla) in enumerate(grid_pts):
        _, si = stop_kd.query(g_m[gi])
        slo, sla = stop_arr[si]
        walk_m    = hav_m(glo, gla, slo, sla)
        walk_t    = walk_m / (WALK_PT * 1000 / 60)
        remaining = TIME_MIN - walk_t
        if remaining <= 0:
            continue
        sn = stop_graph_nodes[si]
        dt = stop_node_dest_times.get(sn, {})
        scores[gi] = sum(1 for t in dt.values() if t <= remaining)

    return scores

# ─── Normalise to 0–100 ───────────────────────────────────────────────────────
def normalise(arr):
    mx = arr.max()
    if mx == 0:
        return arr
    return (arr / mx * 100).astype(np.float32)

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("Loading data …")
    roads      = load("wolfsburg_roads.geojson")["features"]
    footways   = load("wolfsburg_footways.geojson")["features"]
    cycling    = load("wolfsburg_cycling_official.geojson")["features"]
    facilities = load("wolfsburg_facilities.geojson")["features"]
    bus_stops  = load("wolfsburg_bus_stops.geojson")["features"]
    bus_routes = load("wolfsburg_bus_routes.geojson")["features"]

    # ── Destination points ────────────────────────────────────────────────────
    dest_pts = []
    for f in facilities:
        c = f.get("geometry", {}).get("coordinates")
        if c and not isinstance(c[0], list):  # Point only
            dest_pts.append((c[0], c[1]))
    # VW Werk
    dest_pts.extend(VW_WERK_POINTS)
    log(f"Destinations: {len(dest_pts)} (facilities + VW Werk)")

    # ── Bus stop points ───────────────────────────────────────────────────────
    stop_pts = []
    for f in bus_stops:
        c = f.get("geometry", {}).get("coordinates")
        if c and not isinstance(c[0], list):
            stop_pts.append((c[0], c[1]))
    log(f"Bus stops: {len(stop_pts)}")

    # ── Build graphs ──────────────────────────────────────────────────────────
    print("Building walk graph …")
    walk_g = build_graph(roads + footways, WALK_SPEED)
    log(f"Walk graph: {walk_g.number_of_nodes()} nodes, {walk_g.number_of_edges()} edges")

    print("Building bike graph …")
    # Cycling official routes + roads (roads at reduced speed for cyclists)
    bike_road_feats = [f for f in roads if f.get("properties", {}).get("highway") not in
                       ("motorway", "motorway_link", "trunk", "trunk_link")]
    bike_g = build_graph(cycling + bike_road_feats, BIKE_SPEED)
    log(f"Bike graph: {bike_g.number_of_nodes()} nodes, {bike_g.number_of_edges()} edges")

    print("Building auto graph …")
    # Only driveable roads; use maxspeed tag
    drive_types = {"motorway","motorway_link","trunk","trunk_link","primary","primary_link",
                   "secondary","secondary_link","tertiary","tertiary_link",
                   "unclassified","residential","service","services","living_street",
                   "track","road"}
    auto_feats = [f for f in roads if f.get("properties", {}).get("highway") in drive_types]
    auto_g = build_graph(auto_feats, AUTO_DEFAULT, speed_prop="maxspeed")
    log(f"Auto graph: {auto_g.number_of_nodes()} nodes, {auto_g.number_of_edges()} edges")

    print("Building PT (bus) graph …")
    # Bus uses road network at bus speed
    bus_feats = [f for f in roads if f.get("properties", {}).get("highway") in drive_types]
    pt_g = build_graph(bus_feats, BUS_SPEED)
    log(f"PT graph:   {pt_g.number_of_nodes()} nodes, {pt_g.number_of_edges()} edges")

    # ── Grid ──────────────────────────────────────────────────────────────────
    print("Creating grid …")
    grid_pts = make_grid()
    log(f"Grid: {len(grid_pts)} points")

    # ── Compute scores ────────────────────────────────────────────────────────
    print("Computing walk scores …")
    t0 = time.time()
    walk_scores = compute_scores_reverse(walk_g, grid_pts, dest_pts, TIME_MIN, "walk")
    log(f"done in {time.time()-t0:.1f}s, max={walk_scores.max():.0f}")

    print("Computing bike scores …")
    t0 = time.time()
    bike_scores = compute_scores_reverse(bike_g, grid_pts, dest_pts, TIME_MIN, "bike")
    log(f"done in {time.time()-t0:.1f}s, max={bike_scores.max():.0f}")

    print("Computing auto scores …")
    t0 = time.time()
    auto_scores = compute_scores_reverse(auto_g, grid_pts, dest_pts, TIME_MIN, "auto")
    log(f"done in {time.time()-t0:.1f}s, max={auto_scores.max():.0f}")

    print("Computing PT scores …")
    t0 = time.time()
    pt_scores = compute_pt_scores(pt_g, grid_pts, dest_pts, stop_pts)
    log(f"done in {time.time()-t0:.1f}s, max={pt_scores.max():.0f}")

    # ── Normalise ─────────────────────────────────────────────────────────────
    walk_n = normalise(walk_scores)
    bike_n = normalise(bike_scores)
    auto_n = normalise(auto_scores)
    pt_n   = normalise(pt_scores)

    # ── Build GeoJSON ─────────────────────────────────────────────────────────
    print("Writing GeoJSON …")
    features = []
    for i, (lo, la) in enumerate(grid_pts):
        sw = float(walk_n[i])
        sb = float(bike_n[i])
        sa = float(auto_n[i])
        sp = float(pt_n[i])
        # Skip fully-zero points (not connected to any graph = outside city)
        if sw + sb + sa + sp == 0:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lo, la]},
            "properties": {
                "score_walk":  round(sw, 1),
                "score_bike":  round(sb, 1),
                "score_drive": round(sa, 1),
                "score_pt":    round(sp, 1),
            },
        })

    out = {"type": "FeatureCollection", "features": features}
    outpath = f"{PUBLIC_BASE}/wolfsburg_centrality.geojson"
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    sz = len(json.dumps(out)) / 1024 / 1024
    print(f"Done! {len(features)} points written to {outpath} ({sz:.1f} MB)")

if __name__ == "__main__":
    main()
