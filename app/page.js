'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const Constellation3D = dynamic(() => import('@/components/jarvis/Constellation3D'), { ssr: false })

// -------- Callout Card --------
function Callout({ style, label, value, sub, accent = 'cyan', anchor, connectorFrom }) {
  const colors = {
    cyan:  { border: 'border-cyan-400', text: 'text-cyan-300', glow: 'glow-cyan' },
    amber: { border: 'border-amber-400', text: 'text-amber-300', glow: 'glow-amber' },
    red:   { border: 'border-red-500', text: 'text-red-300', glow: 'glow-red' },
  }
  const c = colors[accent] || colors.cyan
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.7 }}
      className={`absolute z-20 pointer-events-none`}
      style={style}
    >
      <div className={`corner-brackets ${c.glow} bg-black/50 backdrop-blur-sm border ${c.border} px-3 py-2 min-w-[190px]`}>
        <span className="cb-tr" /><span className="cb-bl" />
        <div className={`text-[9px] uppercase tracking-[0.25em] ${c.text} opacity-80`}>{label}</div>
        <div className={`font-display text-2xl font-bold ${c.text} text-glow-sm leading-tight`}>{value}</div>
        {sub && <div className="text-[9px] uppercase tracking-widest text-cyan-500/70 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  )
}

// -------- Connector lines from cards to sphere center --------
function Connectors({ items, centerX = '50%', centerY = '50%' }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {items.map((it, i) => (
        <g key={i}>
          <line
            x1={it.x} y1={it.y}
            x2={it.tx} y2={it.ty}
            stroke={it.color || '#00f0ff'}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.6"
            className="dash-anim"
          />
          {/* End dot on sphere side */}
          <circle cx={it.tx} cy={it.ty} r="3" fill={it.color || '#00f0ff'}>
            <animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  )
}

// -------- Terminal Feed --------
const FEED_LINES = [
  'Overnight 1,142 people visited your website. Your automation handled 206 conversations without hesitation.',
  '19 inappropriate comments were auto-filtered before reaching human moderation queues.',
  'Detected 4 high-intent leads. Revenue opportunity forecasted at $1,710 for the next 24 hours.',
  'Neural cortex synchronized. Attention layer weights re-calibrated. Sentiment index: 0.87 positive.',
  'Standing by for your directive, Sir. All subsystems nominal. Awaiting further input.',
]

function TerminalFeed() {
  const [lineIndex, setLineIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let charIndex = 0
    const current = FEED_LINES[lineIndex]
    setDisplayed('')
    const typer = setInterval(() => {
      charIndex++
      setDisplayed(current.slice(0, charIndex))
      if (charIndex >= current.length) {
        clearInterval(typer)
        setTimeout(() => setLineIndex((lineIndex + 1) % FEED_LINES.length), 3200)
      }
    }, 22)
    return () => clearInterval(typer)
  }, [lineIndex])

  return (
    <div className="corner-brackets bg-black/60 backdrop-blur-sm border border-cyan-500/50 px-5 py-3">
      <span className="cb-tr" /><span className="cb-bl" />
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70 font-display shrink-0">SYS.LOG</span>
        <span className="text-cyan-100 text-sm md:text-base leading-relaxed caret">{displayed}</span>
      </div>
    </div>
  )
}

// -------- Live Clock --------
function LiveClock() {
  const [t, setT] = useState(null)
  useEffect(() => {
    setT(new Date())
    const i = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  if (!t) return <div className="text-right"><div className="font-display text-lg text-cyan-300 text-glow-sm tracking-widest">--:--:--</div><div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500/70">&nbsp;</div></div>
  return (
    <div className="text-right">
      <div className="font-display text-lg text-cyan-300 text-glow-sm tracking-widest">
        {t.toLocaleTimeString('en-US', { hour12: false })}
      </div>
      <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500/70">
        {t.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black text-cyan-100 overflow-hidden vignette">
      {/* Grid background */}
      <div className="absolute inset-0 hud-grid pointer-events-none" />

      {/* 3D Constellation Canvas */}
      <div className="absolute inset-0">
        <Constellation3D />
      </div>

      {/* ============ HUD OVERLAY ============ */}

      {/* TOP LEFT — Brand */}
      <motion.div
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}
        className="absolute top-6 left-6 z-30"
      >
        <div className="flex items-center gap-3">
          <div className="font-display text-2xl md:text-3xl font-bold text-cyan-300 text-glow tracking-[0.35em]">
            R.A.D.A.R.
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 text-emerald-400 ping-dot" />
          <span>System Online</span>
          <span className="text-cyan-700">|</span>
          <span className="text-cyan-500">Neural Core v3.14</span>
        </div>
      </motion.div>

      {/* TOP RIGHT — Status badges + clock */}
      <motion.div
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
        className="absolute top-6 right-6 z-30 flex flex-col items-end gap-3"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <div className="corner-brackets bg-red-500/10 border border-red-500/70 glow-red px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-red-300 font-display">
            <span className="cb-tr" /><span className="cb-bl" />
            [ Overnight Summary ]
          </div>
          <div className="corner-brackets bg-amber-500/10 border border-amber-400/70 glow-amber px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-300 font-display">
            <span className="cb-tr" /><span className="cb-bl" />
            [ Automation Active ]
          </div>
          <div className="corner-brackets bg-cyan-500/10 border border-cyan-400/70 glow-cyan px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-display">
            <span className="cb-tr" /><span className="cb-bl" />
            [ Uplink Secure ]
          </div>
        </div>
        <LiveClock />
      </motion.div>

      {/* CONNECTOR LINES (SVG) */}
      <Connectors
        items={[
          // Card corner -> sphere edge
          { x: '17%', y: '32%', tx: '43%', ty: '42%', color: '#00f0ff' },   // Top-left card
          { x: '84%', y: '28%', tx: '58%', ty: '40%', color: '#ffb700' },  // Top-right card
          { x: '15%', y: '68%', tx: '42%', ty: '58%', color: '#ff2a5f' }, // Bottom-left card
          { x: '86%', y: '72%', tx: '58%', ty: '60%', color: '#00f0ff' }, // Bottom-right card
        ]}
      />

      {/* FLOATING CALLOUT CARDS */}
      <Callout
        style={{ top: '26%', left: '4%' }}
        label="Site Visits"
        value="1,142"
        sub="▲ 12.4% vs. yesterday"
        accent="cyan"
      />
      <Callout
        style={{ top: '22%', right: '4%' }}
        label="Conversations Handled"
        value="206"
        sub="Automation · 24hr"
        accent="amber"
      />
      <Callout
        style={{ bottom: '20%', left: '4%' }}
        label="Comments Filtered"
        value="19"
        sub="Inappropriate · auto-removed"
        accent="red"
      />
      <Callout
        style={{ bottom: '16%', right: '4%' }}
        label="Revenue Opportunity"
        value="$1,710"
        sub="Forecast · 24hr"
        accent="cyan"
      />

      {/* BOTTOM — Terminal Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute bottom-6 left-6 right-6 z-30 max-w-5xl mx-auto"
      >
        <TerminalFeed />
      </motion.div>

      {/* CORNER TICKS (top-left / top-right etc as HUD flair) */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-cyan-400/60 z-30 pointer-events-none" />

      {/* SIDE HUD MARKS */}
      <div className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-30 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="text-[8px] text-cyan-500/60 tracking-widest">{String(i * 30).padStart(3, '0')}°</div>
        ))}
      </div>
      <div className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-30 pointer-events-none items-end">
        {['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'].map((s, i) => (
          <div key={i} className="text-[8px] text-cyan-500/60 tracking-widest">{s} · 0{i + 1}</div>
        ))}
      </div>
    </div>
  )
}

export default App
