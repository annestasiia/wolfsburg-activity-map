import React, { useRef, useEffect, useState } from 'react'

const FONT  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = FONT
const SANS  = FONT
const C = { bg: '#FFFFFF', card: '#FFFFFF', border: '#E8E8E8', text1: '#111111', text2: '#444444', text3: '#888888' }

const CSS_ANIM = `
.sp-a{opacity:0;transform:translateY(20px);transition:opacity 650ms cubic-bezier(.4,0,.2,1),transform 650ms cubic-bezier(.4,0,.2,1)}
.sp-a.sp-v{opacity:1;transform:translateY(0)}
`

const PILLARS = [
  {
    num: '01',
    title: 'Shared by default',
    body: 'Every vehicle in the city belongs to the network. No one owns a car — they access mobility as a service, on demand, from any point in the zone.',
  },
  {
    num: '02',
    title: 'Autonomous & electric',
    body: 'Five complementary modes — e-bikes, autonomous pods, shuttles, buses, and car-share EVs — cover every trip type from the last 200 metres to the city boundary.',
  },
  {
    num: '03',
    title: 'Hub-structured',
    body: 'Three tiers of mobility hubs (L, M, S) replace parking lots and garages. Fleet is stored, charged, and dispatched from these nodes. No vehicle sits idle on the street.',
  },
  {
    num: '04',
    title: 'Equitable access',
    body: 'The system is designed so that not owning a car is never a disadvantage. Frequency, coverage, and affordability are built into the operating model from the start.',
  },
]

function Block({ children }) {
  return (
    <div className="sp-a" style={{ marginBottom: 40 }}>
      {children}
    </div>
  )
}

export default function StrategyPanel() {
  const scrollRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setProgress(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const timer = setTimeout(() => {
      const obs = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sp-v') }),
        { threshold: 0.12, root: el }
      )
      el.querySelectorAll('.sp-a').forEach(n => obs.observe(n))
      return () => obs.disconnect()
    }, 60)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'var(--nav-w)', right: 0, zIndex: 10, background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{CSS_ANIM}</style>

      {/* Progress */}
      <div style={{ height: 3, background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', background: C.text1, width: `${progress * 100}%`, transition: 'width 80ms linear' }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '72px 56px 120px' }}>

          <Block>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 400, color: C.text3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
              Post-Car Strategy · Wolfsburg 2026
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 400, color: C.text1, lineHeight: 1.05, letterSpacing: '-0.5px', margin: '0 0 28px', maxWidth: 600 }}>
              A City Where Car Ownership Becomes Obsolete
            </h1>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 520 }}>
              Wolfsburg is an unlikely candidate for a post-car experiment.
              Built by and for Volkswagen, it is one of Germany's most car-dependent cities —
              with more registered vehicles per resident than almost anywhere else in the country.
              That is precisely why it matters.
            </p>
          </Block>

          <div style={{ height: 1, background: C.border, margin: '8px 0 48px' }} />

          <Block>
            <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px' }}>
              The Premise
            </h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 18px', maxWidth: 540 }}>
              This is not a car-free city in the traditional sense of banning vehicles.
              It is a city where car <em>ownership</em> itself becomes obsolete —
              replaced by a system that is more convenient, more equitable, and more efficient
              than private ownership ever was.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 540 }}>
              All mobility is shared, electric, autonomous, and on-demand.
              Vehicles do not sit parked for 23 hours a day.
              They circulate — serving the next trip, the next person, the next district.
            </p>
          </Block>

          <Block>
            <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px' }}>
              Why Wolfsburg
            </h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 18px', maxWidth: 540 }}>
              The city's identity is inseparable from the car — Volkswagen's main plant employs
              tens of thousands of people within the zone. The paradox of the car city going post-car
              is not a contradiction; it is an argument. If it can work here, it can work anywhere.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 540 }}>
              The project focuses on the 4 km² city centre — nine central districts with 17,500 residents,
              18,000 daily workers, and an estimated 4,000 visitors per day.
              This is where car dependency is most visible, and where the gains from eliminating it are largest.
            </p>
          </Block>

          <div style={{ height: 1, background: C.border, margin: '8px 0 48px' }} />

          <Block>
            <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: C.text1, margin: '0 0 28px', letterSpacing: '-0.02em' }}>
              Four Pillars
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {PILLARS.map(({ num, title, body }) => (
                <div key={num} style={{ display: 'flex', gap: 24, padding: '24px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.text3, letterSpacing: '0.14em', width: 24, paddingTop: 3, flexShrink: 0 }}>{num}</div>
                  <div>
                    <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 400, color: C.text1, marginBottom: 8, letterSpacing: '-0.3px' }}>{title}</div>
                    <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 460 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Block>

          <div style={{ height: 1, background: C.border, margin: '8px 0 48px' }} />

          <Block>
            <h2 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: C.text1, margin: '0 0 20px', letterSpacing: '-0.5px' }}>
              What Changes
            </h2>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: '0 0 18px', maxWidth: 540 }}>
              Parking lots become parks, plazas, or housing. Streets narrow.
              The acoustic texture of the city changes — less engine noise, more pedestrian space.
              The 49,000 private vehicles that currently enter the zone each day are replaced
              by a shared fleet of roughly 1,300 vehicles and bikes.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 15, color: C.text1, lineHeight: 1.75, margin: 0, maxWidth: 540 }}>
              One shared vehicle replaces approximately 38 private cars in daily circulation.
              The land freed from parking and road infrastructure becomes the urban dividend —
              returned to residents, greenery, and public life.
            </p>
          </Block>

          <div style={{ padding: '24px 28px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, marginTop: 8 }}>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.text3, margin: 0, lineHeight: 1.9 }}>
              <strong style={{ color: C.text2 }}>Status:</strong> This section is in development — quantitative analysis, policy proposals, and scenario modelling will follow.<br />
              <strong style={{ color: C.text2 }}>See also:</strong> Capacity Analysis for fleet sizing calculations · Hub System for spatial network · Geo-Data Analysis for baseline data.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
