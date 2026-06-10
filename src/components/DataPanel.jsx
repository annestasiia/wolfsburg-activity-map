import React, { useState } from 'react'

// ─── BASELINE DATA (MiD 2017 · WOKS 2023/2025) ───────────────────────────────
const DISTRICT_POP = {
  'Stadtmitte':    2800,
  'Schillerteich': 2100,
  'Hellwinkel':    1900,
  'Heßlingen':     2200,
  'Rothenfelde':   1800,
  'Köhlerberg':    1400,
  'Alt-Wolfsburg': 2600,
  'Sandkamp':      1100,
  'Hochenstein':   1500,
}

const WORKERS         = 18000
const T_RESIDENT      = 3.2
const T_WORKER        = 2.1
const T_VISITOR       = 1.5
const VISITOR_SHARE   = 0.20
const CAR_OCCUPANCY   = 1.3

const MODAL = {
  private_car:    { share: 0.62, label: 'Private car',    color: '#E63946' },
  public_transit: { share: 0.10, label: 'Public transit', color: '#1D70B8' },
  walking:        { share: 0.20, label: 'Walking',        color: '#2D6A4F' },
  cycling:        { share: 0.08, label: 'Cycling',        color: '#FF8C42' },
}

// Hour shares (MiD 2017 weekday profile, normalised)
const HOUR_RAW = [
  0.005, 0.003, 0.002, 0.002, 0.005, 0.015,
  0.040, 0.075, 0.085, 0.065, 0.055, 0.060,
  0.060, 0.055, 0.055, 0.065, 0.075, 0.080,
  0.065, 0.045, 0.030, 0.020, 0.015, 0.008,
]
const HOUR_SUM   = HOUR_RAW.reduce((a, b) => a + b, 0)
const HOUR_SHARE = HOUR_RAW.map(s => s / HOUR_SUM)

// ─── CALCULATIONS ─────────────────────────────────────────────────────────────
const total_residents    = Object.values(DISTRICT_POP).reduce((a, b) => a + b, 0)
const visitors           = (total_residents + WORKERS) * VISITOR_SHARE
const D_total            = total_residents * T_RESIDENT + WORKERS * T_WORKER + visitors * T_VISITOR
const D_internal         = D_total * 0.65
const car_trips          = D_total * MODAL.private_car.share
const transit_trips      = D_total * MODAL.public_transit.share
const walk_trips         = D_total * MODAL.walking.share
const cycling_trips      = D_total * MODAL.cycling.share
const car_vehicles_per_day = car_trips / CAR_OCCUPANCY

const fmt = n => Math.round(n).toLocaleString('de-DE')

const RESULTS = [
  { metric: 'Population (residents)',  value: total_residents,      source: 'WOKS 2023' },
  { metric: 'Workers in zone',         value: WORKERS,              source: 'WOKS 2025' },
  { metric: 'Daily visitors',          value: visitors,             source: 'MiD 2017 estimate' },
  { metric: 'D_total (trips/day)',     value: D_total,              source: 'MiD 2017 formula' },
  { metric: 'D_internal (trips/day)',  value: D_internal,           source: '65 % of D_total' },
  { metric: 'Car trips/day',           value: car_trips,            source: 'MiD 2017' },
  { metric: 'Car vehicles/day',        value: car_vehicles_per_day, source: 'MiD 2017' },
  { metric: 'Transit trips/day',       value: transit_trips,        source: 'MiD 2017' },
  { metric: 'Walking trips/day',       value: walk_trips,           source: 'MiD 2017' },
  { metric: 'Cycling trips/day',       value: cycling_trips,        source: 'MiD 2017' },
]

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '16px 18px',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginTop: 5 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '18px 20px',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function ModalShareChart() {
  const maxShare = 0.62
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(MODAL).map(([key, { share, label, color }]) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#1D1D1F' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{(share * 100).toFixed(0)} %</span>
          </div>
          <div style={{ height: 8, background: '#E8E8ED', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${(share / maxShare) * 100}%`,
              height: '100%',
              background: color,
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 3 }}>
            {fmt(D_total * share)} trips/day
          </div>
        </div>
      ))}
    </div>
  )
}

function DistrictChart() {
  const maxPop  = Math.max(...Object.values(DISTRICT_POP))
  const sorted  = Object.entries(DISTRICT_POP).sort(([, a], [, b]) => b - a)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {sorted.map(([name, pop]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 100, fontSize: 12, color: '#3D3D3F', flexShrink: 0 }}>{name}</div>
          <div style={{ flex: 1, height: 7, background: '#E8E8ED', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(pop / maxPop) * 100}%`,
              height: '100%',
              background: '#0071E3',
              borderRadius: 3,
            }} />
          </div>
          <div style={{ fontSize: 12, color: '#6E6E73', width: 42, textAlign: 'right', flexShrink: 0 }}>
            {pop.toLocaleString('de-DE')}
          </div>
        </div>
      ))}
    </div>
  )
}

function HourlyChart() {
  const maxShare = Math.max(...HOUR_SHARE)
  const PEAK_RANGES = [[7, 9], [16, 18]]
  const isPeak = h => PEAK_RANGES.some(([a, b]) => h >= a && h <= b)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {HOUR_SHARE.map((s, h) => (
          <div
            key={h}
            title={`${h}:00 — ${(s * 100).toFixed(1)} % — ${fmt(D_total * s)} trips`}
            style={{
              flex: 1,
              height: `${(s / maxShare) * 100}%`,
              background: isPeak(h) ? '#E63946' : '#0071E3',
              borderRadius: '3px 3px 0 0',
              opacity: 0.85,
              cursor: 'default',
            }}
          />
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 4, paddingTop: 4,
        borderTop: '1px solid #E8E8ED',
      }}>
        {[0, 4, 8, 12, 16, 20, 23].map(h => (
          <span key={h} style={{ fontSize: 10, color: '#AEAEB2' }}>{h}h</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, background: '#E63946', borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: '#6E6E73' }}>Peak hours (7–9h, 16–18h)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, background: '#0071E3', borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: '#6E6E73' }}>Off-peak</span>
        </div>
      </div>
    </div>
  )
}

function ResultsTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E8ED' }}>
            {['Metric', 'Value', 'Source'].map(h => (
              <th key={h} style={{
                textAlign: h === 'Value' ? 'right' : 'left',
                padding: '8px 10px', fontWeight: 600,
                color: '#6E6E73', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESULTS.map(({ metric, value, source }, i) => (
            <tr key={metric} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
              <td style={{ padding: '9px 10px', color: '#1D1D1F' }}>{metric}</td>
              <td style={{ padding: '9px 10px', color: '#1D1D1F', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(value)}
              </td>
              <td style={{ padding: '9px 10px', color: '#AEAEB2' }}>{source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────
export default function DataPanel() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(245,245,247,0.97)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 32px 72px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, fontWeight: 600, color: '#AEAEB2',
            letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px',
          }}>
            Urban Data Analysis · Wolfsburg
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1D1D1F', margin: 0, letterSpacing: '-0.025em' }}>
            Modal Distribution Baseline
          </h1>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 6, lineHeight: 1.5 }}>
            9 central districts · {fmt(total_residents)} residents · {fmt(D_total)} estimated trips/day
          </p>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <KPICard label="Residents"       value={fmt(total_residents)}      sub="9 districts · WOKS 2023"  color="#0071E3" />
          <KPICard label="Workers in zone" value={fmt(WORKERS)}              sub="WOKS Arbeitsmarkt 2025"   color="#7C3AED" />
          <KPICard label="Daily visitors"  value={fmt(visitors)}             sub="MiD 2017 estimate"        color="#2D6A4F" />
          <KPICard label="Total trips/day" value={fmt(D_total)}              sub="MiD 2017 formula"         color="#E63946" />
        </div>

        {/* Two-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Section title="Modal Share" subtitle="Share of daily trips · MiD 2017 + KBA 2023">
            <ModalShareChart />
          </Section>
          <Section title="District Population" subtitle="Residents per district · WOKS 2023">
            <DistrictChart />
          </Section>
        </div>

        {/* Hourly — full width */}
        <div style={{ marginBottom: 16 }}>
          <Section title="Hourly Trip Distribution" subtitle="Estimated weekday pattern · MiD 2017 · hover bars for detail">
            <HourlyChart />
          </Section>
        </div>

        {/* Results table */}
        <Section title="Baseline Results Table" subtitle="All figures derived from open statistical data">
          <ResultsTable />
        </Section>

        {/* Secondary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
          <KPICard label="D_internal (intra-zone)" value={fmt(D_internal)}          sub="65 % of D_total · MiD 2017"     color="#6E6E73" />
          <KPICard label="Car vehicles/day"         value={fmt(car_vehicles_per_day)} sub={`occupancy ${CAR_OCCUPANCY}× · MiD 2017`} color="#E63946" />
          <KPICard label="Transit + Walk + Cycle"   value={fmt(transit_trips + walk_trips + cycling_trips)} sub="Combined sustainable modes"  color="#2D6A4F" />
        </div>

        {/* Sources note */}
        <div style={{
          marginTop: 24, padding: '14px 18px',
          background: 'rgba(0,0,0,0.03)', borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: 12, color: '#AEAEB2', margin: 0, lineHeight: 1.7 }}>
            <strong style={{ color: '#6E6E73' }}>Data sources:</strong>{' '}
            MiD 2017 (Mobilität in Deutschland, BMVI) ·
            WOKS Wolfsburg 2023/2025 (Wolfsburg Statistik) ·
            KBA Kraftfahrtbundesamt 2023 · District populations are planning estimates —
            replace stubs with WOKS figures before production use.
            Python script: <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 3 }}>analysis/modal_distribution.py</code>
          </p>
        </div>

      </div>
    </div>
  )
}
