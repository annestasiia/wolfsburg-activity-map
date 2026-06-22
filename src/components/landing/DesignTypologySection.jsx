import React from 'react'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export default function DesignTypologySection() {
  return (
    <section style={{
      display: 'flex',
      height: '100vh',
      background: '#fff',
      borderTop: '2px solid #111',
      overflow: 'hidden',
    }}>
      {/* Left — header */}
      <div style={{
        width: '40%', flexShrink: 0,
        padding: '64px 48px',
        borderRight: '1px solid #E8E8E8',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 12 }}>
          06 — Design Development
        </div>
        <h2 style={{ fontFamily: F, fontSize: 'clamp(20px, 1.8vw, 28px)', fontWeight: 700, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 20px' }}>
          Design Elements<br />and Typology
        </h2>
        <p style={{ fontFamily: F, fontSize: 12, color: '#888', lineHeight: 1.7, maxWidth: 360 }}>
          The next phase of the project develops architectural and urban design proposals
          for hub typologies — from large intermodal terminals to small neighbourhood
          interchange nodes.
        </p>
      </div>

      {/* Right — placeholder content area */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F8F8F6',
      }}>
        <div style={{
          fontFamily: F, fontSize: 11, color: '#CCCCCC',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Content coming soon
        </div>
      </div>
    </section>
  )
}
