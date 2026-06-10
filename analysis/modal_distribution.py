"""
Modal distribution baseline — Wolfsburg City Centre
Sources: MiD 2017, WOKS 2023/2025, KBA 2023
Replace stub values marked WOKS before production use.
"""
import os
import numpy as np
import pandas as pd

# ─── INPUT DATA ──────────────────────────────────────────────────────────────
district_population = {
    "Stadtmitte":    2800,
    "Schillerteich": 2100,
    "Hellwinkel":    1900,
    "Heßlingen":     2200,
    "Rothenfelde":   1800,
    "Köhlerberg":    1400,
    "Alt-Wolfsburg": 2600,
    "Sandkamp":      1100,
    "Hochenstein":   1500,
}
# Stubs — replace with real WOKS figures before running
workers_in_zone    = 18_000  # WOKS Arbeitsmarktbericht 2025
trips_per_resident = 3.2     # MiD 2017
trips_per_worker   = 2.1     # MiD 2017
trips_per_visitor  = 1.5     # MiD 2017
visitors_share     = 0.20
avg_car_occupancy  = 1.3     # MiD 2017

modal_share = {
    "private_car":    0.62,  # MiD 2017 + Wolfsburg +4 % (KBA 2023)
    "public_transit": 0.10,
    "walking":        0.20,
    "cycling":        0.08,
}

# ─── STEP 1 — Population and total demand ────────────────────────────────────
total_residents = sum(district_population.values())
visitors        = (total_residents + workers_in_zone) * visitors_share
D_total         = (total_residents * trips_per_resident
                   + workers_in_zone  * trips_per_worker
                   + visitors         * trips_per_visitor)
D_internal      = D_total * 0.65          # intra-zone share (MiD 2017)

# ─── STEP 2 — Trips by mode ───────────────────────────────────────────────────
car_trips     = D_total * modal_share["private_car"]
transit_trips = D_total * modal_share["public_transit"]
walk_trips    = D_total * modal_share["walking"]
cycling_trips = D_total * modal_share["cycling"]

# ─── STEP 3 — Unique vehicles per day ────────────────────────────────────────
car_vehicles_per_day = car_trips / avg_car_occupancy

# ─── HOURLY DISTRIBUTION (MiD 2017 typical weekday profile) ──────────────────
hour_shares_raw = np.array([
    0.005, 0.003, 0.002, 0.002, 0.005, 0.015,  # 00-05
    0.040, 0.075, 0.085, 0.065, 0.055, 0.060,  # 06-11
    0.060, 0.055, 0.055, 0.065, 0.075, 0.080,  # 12-17
    0.065, 0.045, 0.030, 0.020, 0.015, 0.008,  # 18-23
])
hour_shares = hour_shares_raw / hour_shares_raw.sum()
hourly_trips = np.round(D_total * hour_shares).astype(int)

# ─── RESULTS TABLE ────────────────────────────────────────────────────────────
rows = [
    ("Population (residents)",  total_residents,      "WOKS 2023"),
    ("Workers in zone",         workers_in_zone,      "WOKS 2025"),
    ("Daily visitors",          visitors,             "MiD 2017 estimate"),
    ("D_total (trips/day)",     D_total,              "MiD 2017 formula"),
    ("D_internal (trips/day)",  D_internal,           "65% of D_total"),
    ("Car trips/day",           car_trips,            "MiD 2017"),
    ("Car vehicles/day",        car_vehicles_per_day, "MiD 2017"),
    ("Transit trips/day",       transit_trips,        "MiD 2017"),
    ("Walking trips/day",       walk_trips,           "MiD 2017"),
    ("Cycling trips/day",       cycling_trips,        "MiD 2017"),
]

df = pd.DataFrame(rows, columns=["Metric", "Value", "Source"])
df["Value"] = df["Value"].apply(lambda x: f"{x:,.0f}")

print("\n=== Modal Distribution Baseline - Wolfsburg City Centre ===\n")
print(df.to_string(index=False))

# Hourly detail
print("\n=== Hourly Trip Estimates ===\n")
hourly_df = pd.DataFrame({
    "Hour":  [f"{h:02d}:00" for h in range(24)],
    "Share": [f"{s:.1%}" for s in hour_shares],
    "Trips": [f"{t:,}" for t in hourly_trips],
})
print(hourly_df.to_string(index=False))

# ─── EXPORT ───────────────────────────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(out_dir, exist_ok=True)

df_export = pd.DataFrame(rows, columns=["Metric", "Value", "Source"])
df_export["Value"] = df_export["Value"].apply(lambda x: round(x, 2))
df_export.to_csv(os.path.join(out_dir, "results_baseline.csv"), index=False)

hourly_df.to_csv(os.path.join(out_dir, "hourly_distribution.csv"), index=False)

print(f"\nSaved -> {out_dir}\\results_baseline.csv")
print(f"Saved -> {out_dir}\\hourly_distribution.csv\n")
