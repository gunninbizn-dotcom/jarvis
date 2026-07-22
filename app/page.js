'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Send, X } from 'lucide-react'

const Constellation3D = dynamic(() => import('@/components/jarvis/Constellation3D'), { ssr: false })

// --------- Constants ---------
const CARD_W = 200
const CARD_H = 84

const CARDS_INIT = [
  { id: 'visits',       label: 'Site Visits',           value: '1,142', sub: '▲ 12.4% vs. yesterday',       accent: 'cyan'  },
  { id: 'conversations',label: 'Conversations Handled', value: '206',   sub: 'Automation · 24hr',            accent: 'amber' },
  { id: 'filtered',     label: 'Comments Filtered',     value: '19',    sub: 'Inappropriate · auto-removed', accent: 'red'   },
  { id: 'revenue',      label: 'Revenue Opportunity',   value: '$1,710',sub: 'Forecast · 24hr',             accent: 'cyan'  },
]

const ACCENT_COLORS = {
  cyan:  { border: 'border-cyan-400',  text: 'text-cyan-300',  glow: 'glow-cyan',  stroke: '#00f0ff' },
  amber: { border: 'border-amber-400', text: 'text-amber-300', glow: 'glow-amber', stroke: '#ffb700' },
  red:   { border: 'border-red-500',   text: 'text-red-300',   glow: 'glow-red',   stroke: '#ff2a5f' },
}

function initialCardPositions(w, h) {
  return {
    visits:        { x: Math.max(20, w * 0.05),           y: Math.max(120, h * 0.26) },
    conversations: { x: Math.min(w - CARD_W - 20, w * 0.93 - CARD_W), y: Math.max(120, h * 0.22) },
    filtered:      { x: Math.max(20, w * 0.05),           y: Math.min(h - 200, h * 0.66) },
    revenue:       { x: Math.min(w - CARD_W - 20, w * 0.93 - CARD_W), y: Math.min(h - 200, h * 0.70) },
  }
}

// --------- Draggable Card ---------
function DraggableCard({ card, pos, onDragStart, onDrag, onDragEnd, dragging }) {
  const c = ACCENT_COLORS[card.accent] || ACCENT_COLORS.cyan
  const startDrag = (e) => {
    e.preventDefault()
    onDragStart(card.id, e.clientX, e.clientY)
  }
  return (
    <div
      onMouseDown={startDrag}
      onTouchStart={(e) => onDragStart(card.id, e.touches[0].clientX, e.touches[0].clientY)}
      className={`absolute z-20 select-none cursor-grab ${dragging ? 'cursor-grabbing' : ''}`}
      style={{ left: pos.x, top: pos.y, width: CARD_W, transition: dragging ? 'none' : 'left 0.2s ease, top 0.2s ease' }}
    >
      <div className={`corner-brackets ${c.glow} bg-black/60 backdrop-blur-sm border ${c.border} px-3 py-2`}>
        <span className="cb-tr" /><span className="cb-bl" />
        <div className={`text-[9px] uppercase tracking-[0.25em] ${c.text} opacity-80`}>{card.label}</div>
        <div className={`font-display text-2xl font-bold ${c.text} text-glow-sm leading-tight`}>{card.value}</div>
        {card.sub && <div className="text-[9px] uppercase tracking-widest text-cyan-500/70 mt-0.5">{card.sub}</div>}
      </div>
    </div>
  )
}

// --------- Connectors ---------
function Connectors({ positions, center }) {
  const items = CARDS_INIT.map(card => {
    const p = positions[card.id]
    const cx = p.x + CARD_W / 2
    const cy = p.y + CARD_H / 2
    // Endpoint on sphere edge (offset from center toward card)
    const dx = cx - center.x, dy = cy - center.y
    const dist = Math.hypot(dx, dy) || 1
    const R = Math.min(center.x, center.y) * 0.5
    const tx = center.x + (dx / dist) * R
    const ty = center.y + (dy / dist) * R
    return { id: card.id, x: cx, y: cy, tx, ty, color: ACCENT_COLORS[card.accent].stroke }
  })
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
      {items.map((it, i) => (
        <g key={it.id}>
          <line
            x1={it.x} y1={it.y} x2={it.tx} y2={it.ty}
            stroke={it.color} strokeWidth="1" strokeDasharray="3 3"
            opacity="0.6" className="dash-anim"
          />
          <circle cx={it.tx} cy={it.ty} r="3" fill={it.color}>
            <animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  )
}

// --------- Terminal Feed ---------
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
    let ci = 0
    const current = FEED_LINES[lineIndex]
    setDisplayed('')
    const t = setInterval(() => {
      ci++
      setDisplayed(current.slice(0, ci))
      if (ci >= current.length) { clearInterval(t); setTimeout(() => setLineIndex((lineIndex + 1) % FEED_LINES.length), 3200) }
    }, 22)
    return () => clearInterval(t)
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

// --------- Clock ---------
function LiveClock() {
  const [t, setT] = useState(null)
  useEffect(() => { setT(new Date()); const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  if (!t) return <div className="text-right"><div className="font-display text-lg text-cyan-300 text-glow-sm tracking-widest">--:--:--</div><div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500/70">&nbsp;</div></div>
  return (
    <div className="text-right">
      <div className="font-display text-lg text-cyan-300 text-glow-sm tracking-widest">{t.toLocaleTimeString('en-US', { hour12: false })}</div>
      <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500/70">{t.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
    </div>
  )
}

// --------- Node Detail Panel ---------
function NodeDetail({ node, onClose }) {
  if (!node) return null
  const w = typeof window !== 'undefined' ? window.innerWidth : 1920
  const h = typeof window !== 'undefined' ? window.innerHeight : 900
  // Clamp to screen
  const left = Math.min(Math.max(20, node.x + 16), w - 280)
  const top = Math.min(Math.max(20, node.y - 40), h - 220)
  const nodeName = `NODE-${String(node.index).padStart(4, '0')}`
  const signal = 60 + (node.index % 40)
  const sector = String.fromCharCode(65 + (node.index % 26)) + (node.index % 9 + 1)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="absolute z-40 pointer-events-auto"
      style={{ left, top, width: 260 }}
    >
      <div className="corner-brackets bg-black/85 backdrop-blur-md border border-cyan-400 glow-cyan px-4 py-3">
        <span className="cb-tr" /><span className="cb-bl" />
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500">Node Selected</div>
            <div className="font-display text-base text-cyan-200 text-glow-sm">{nodeName}</div>
          </div>
          <button onClick={onClose} className="text-cyan-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-cyan-500/80">Sector</span><span className="text-cyan-200 font-display">{sector}</span></div>
          <div className="flex justify-between"><span className="text-cyan-500/80">Signal</span><span className="text-cyan-200 font-display">{signal.toFixed(0)}%</span></div>
          <div className="flex justify-between"><span className="text-cyan-500/80">Radius</span><span className="text-cyan-200 font-display">{node.r.toFixed(2)} AU</span></div>
          <div className="flex justify-between"><span className="text-cyan-500/80">Color</span><span className="font-display" style={{ color: `#${node.color}` }}>#{node.color}</span></div>
          <div className="flex justify-between"><span className="text-cyan-500/80">Status</span><span className="text-emerald-400 font-display">ACTIVE</span></div>
        </div>
      </div>
    </motion.div>
  )
}

// --------- Voice Command Bar ---------
function VoiceBar() {
  const [text, setText] = useState('')
  const [reply, setReply] = useState(null)
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const sidRef = useRef(null)

  const send = async (msg) => {
    const m = (msg ?? text).trim()
    if (!m || sending) return
    setText('')
    setSending(true)
    setReply({ user: m, jarvis: '...' })
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: m, sessionId: sidRef.current }),
      })
      const d = await r.json()
      sidRef.current = d.sessionId
      setReply({ user: m, jarvis: d.reply })
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance(d.reply)
          u.rate = 1; u.pitch = 0.85; u.volume = 0.9
          const voices = window.speechSynthesis.getVoices()
          const brit = voices.find(v => /uk|british|daniel|arthur/i.test(v.name + v.lang))
          if (brit) u.voice = brit
          window.speechSynthesis.speak(u)
        }
      } catch {}
      setTimeout(() => setReply(null), 10000)
    } catch {
      setReply({ user: m, jarvis: 'Connection to core disrupted.' })
    } finally { setSending(false) }
  }

  const startListening = () => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setReply({ user: '', jarvis: 'Voice input unavailable. Try Chrome or Edge.' }); setTimeout(() => setReply(null), 5000); return }
    try { window.speechSynthesis?.cancel() } catch {}
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false
    let finalT = ''; let started = false; let timer = null
    const unavailable = (why) => {
      const msg = why === 'not-allowed' || why === 'permission-denied'
        ? 'Microphone blocked. Please allow mic access.'
        : 'Voice input unavailable in this environment.'
      setReply({ user: '', jarvis: msg }); setTimeout(() => setReply(null), 5000)
    }
    rec.onstart = () => { started = true; if (timer) clearTimeout(timer); setListening(true) }
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalT += r[0].transcript; else interim += r[0].transcript
      }
      setText((finalT || interim).trim())
    }
    rec.onerror = (e) => { setListening(false); if (timer) clearTimeout(timer); unavailable(e?.error) }
    rec.onend = () => {
      setListening(false); if (timer) clearTimeout(timer)
      const t = (finalT || '').trim(); if (t) send(t)
    }
    recRef.current = rec
    try {
      rec.start()
      timer = setTimeout(() => { if (!started) { setListening(false); unavailable(); try { rec.abort && rec.abort() } catch {} } }, 1500)
    } catch (err) { setListening(false); unavailable(err?.name) }
  }

  const stopListening = () => { try { recRef.current?.stop() } catch {}; setListening(false) }

  return (
    <div className="relative">
      <AnimatePresence>
        {reply && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-full mb-3 left-0 right-0 corner-brackets bg-black/85 backdrop-blur-md border border-cyan-400 glow-cyan px-4 py-2"
          >
            <span className="cb-tr" /><span className="cb-bl" />
            {reply.user && <div className="text-[10px] uppercase tracking-widest text-cyan-500/70">&gt; {reply.user}</div>}
            <div className="text-cyan-200 text-sm text-glow-sm">{reply.jarvis}</div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="corner-brackets bg-black/70 backdrop-blur-sm border border-cyan-500/60 flex items-center gap-2 px-3 py-2">
        <span className="cb-tr" /><span className="cb-bl" />
        <span className="text-cyan-500 font-display text-sm">&gt;</span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={listening ? 'Listening...' : 'Command R.A.D.A.R.'}
          className="flex-1 bg-transparent outline-none px-1 text-sm text-cyan-100 placeholder:text-cyan-700 tracking-wide min-w-0"
        />
        <button
          onClick={listening ? stopListening : startListening}
          className={`p-2 border rounded-sm transition ${listening ? 'bg-red-500/25 border-red-400 text-red-200 animate-pulse' : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/25'}`}
          title={listening ? 'Stop' : 'Voice'}
        ><Mic className="w-3.5 h-3.5" /></button>
        <button
          onClick={() => send()}
          disabled={sending}
          className="p-2 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400 text-cyan-200 rounded-sm transition disabled:opacity-50"
          title="Send"
        ><Send className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function App() {
  const [selectedNode, setSelectedNode] = useState(null)
  const [positions, setPositions] = useState({})
  const [center, setCenter] = useState({ x: 960, y: 450 })
  const [dragging, setDragging] = useState(null)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  // Initialize positions on mount
  useEffect(() => {
    const w = window.innerWidth, h = window.innerHeight
    setPositions(initialCardPositions(w, h))
    setCenter({ x: w / 2, y: h / 2 })
    const onResize = () => {
      const w2 = window.innerWidth, h2 = window.innerHeight
      setCenter({ x: w2 / 2, y: h2 / 2 })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Drag handling
  const onDragStart = (id, cx, cy) => {
    const p = positions[id]
    dragOffset.current = { dx: cx - p.x, dy: cy - p.y }
    setDragging(id)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const nx = Math.max(0, Math.min(window.innerWidth - CARD_W, cx - dragOffset.current.dx))
      const ny = Math.max(0, Math.min(window.innerHeight - CARD_H, cy - dragOffset.current.dy))
      setPositions(p => ({ ...p, [dragging]: { x: nx, y: ny } }))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging])

  const handleNodeClick = useCallback((node) => setSelectedNode(node), [])

  const hasPositions = Object.keys(positions).length > 0

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black text-cyan-100 overflow-hidden vignette">
      <div className="absolute inset-0 hud-grid pointer-events-none" />

      <div className="absolute inset-0">
        <Constellation3D onNodeClick={handleNodeClick} />
      </div>

      {/* TOP LEFT */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="absolute top-6 left-6 z-30">
        <div className="font-display text-2xl md:text-3xl font-bold text-cyan-300 text-glow tracking-[0.35em]">R.A.D.A.R.</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 text-emerald-400 ping-dot" />
          <span>System Online</span>
          <span className="text-cyan-700">|</span>
          <span className="text-cyan-500">Neural Core v3.14</span>
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-widest text-cyan-600">TIP: Click a particle · Drag any card</div>
      </motion.div>

      {/* TOP RIGHT */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="absolute top-6 right-6 z-30 flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          <div className="corner-brackets bg-red-500/10 border border-red-500/70 glow-red px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-red-300 font-display"><span className="cb-tr" /><span className="cb-bl" />[ Overnight Summary ]</div>
          <div className="corner-brackets bg-amber-500/10 border border-amber-400/70 glow-amber px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-300 font-display"><span className="cb-tr" /><span className="cb-bl" />[ Automation Active ]</div>
          <div className="corner-brackets bg-cyan-500/10 border border-cyan-400/70 glow-cyan px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-display"><span className="cb-tr" /><span className="cb-bl" />[ Uplink Secure ]</div>
        </div>
        <LiveClock />
      </motion.div>

      {/* Connectors and Cards */}
      {hasPositions && (
        <>
          <Connectors positions={positions} center={center} />
          {CARDS_INIT.map(card => (
            <DraggableCard
              key={card.id}
              card={card}
              pos={positions[card.id]}
              dragging={dragging === card.id}
              onDragStart={onDragStart}
              onDrag={() => {}}
              onDragEnd={() => {}}
            />
          ))}
        </>
      )}

      {/* Node detail panel */}
      <AnimatePresence>
        {selectedNode && <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </AnimatePresence>

      {/* BOTTOM — Terminal Feed + Voice Bar */}
      <div className="absolute bottom-6 left-6 right-6 z-30 max-w-6xl mx-auto flex flex-col md:flex-row gap-3 items-end">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="flex-1 w-full">
          <TerminalFeed />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="w-full md:w-96">
          <VoiceBar />
        </motion.div>
      </div>

      {/* Corner ticks */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-cyan-400/60 z-30 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-cyan-400/60 z-30 pointer-events-none" />

      {/* Side HUD marks */}
      <div className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-30 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="text-[8px] text-cyan-500/60 tracking-widest">{String(i * 30).padStart(3, '0')}°</div>))}
      </div>
      <div className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-30 pointer-events-none items-end">
        {['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'].map((s, i) => (<div key={i} className="text-[8px] text-cyan-500/60 tracking-widest">{s} · 0{i + 1}</div>))}
      </div>
    </div>
  )
}

export default App
