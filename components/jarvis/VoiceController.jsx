'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Volume2, Power, VolumeX } from 'lucide-react'

// Greeting segments — each segment plays sequentially, may highlight a card
const GREETING = [
  { text: 'Good morning, sir. Systems back online.', card: null },
  { text: 'While you slept, I kept everything running.', card: null },
  { text: 'Overnight, 1,142 people visited your website.', card: 'visits', keyword: '1,142' },
  { text: 'Your automation handled 206 conversations without hesitation.', card: 'conversations', keyword: '206' },
  { text: '19 inappropriate comments were auto-filtered.', card: 'filtered', keyword: '19' },
  { text: 'I detected four high-intent leads with an estimated revenue opportunity of $1,710 in the next 24 hours.', card: 'revenue', keyword: '$1,710' },
  { text: 'All subsystems nominal. I am standing by for your directive.', card: null },
]

function pickVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null
  const preferred = [
    /daniel/i, /arthur/i, /oliver/i, /george/i, /english \(uk\)/i, /en-gb/i,
    /alex/i, /samantha/i, /google us english/i,
  ]
  for (const p of preferred) {
    const v = voices.find(v => p.test(v.name + ' ' + v.lang))
    if (v) return v
  }
  return voices[0]
}

// ------- Listening Visualizer Bars -------
function VisualizerBars({ mode }) {
  const bars = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    delay: (index % 6) * 0.08 + index * 0.025,
    duration: 0.8 + (index % 4) * 0.05,
  })), [])
  const color = mode === 'speaking' ? '#00f0ff' : mode === 'listening' ? '#ff2a5f' : '#0891b2'
  return (
    <div className={`visualizer-bars ${mode}`} style={{ '--visualizer-color': color }}>
      {bars.map((bar, i) => (
        <div key={i} className="visualizer-bar"
          style={{
            animationDelay: `${bar.delay}s`,
            animationDuration: `${bar.duration}s`,
          }} />
      ))}
    </div>
  )
}

export default function VoiceController({ intensityRef, flashesRef, onCardHighlight, onSpeakEnd }) {
  const [unmuted, setUnmuted] = useState(false)
  const [mode, setMode] = useState('idle') // 'idle' | 'speaking' | 'listening' | 'processing'
  const [subtitle, setSubtitle] = useState('')
  const [voiceReady, setVoiceReady] = useState(false)
  const modeRef = useRef('idle')
  const stoppedRef = useRef(false)
  const recRef = useRef(null)
  const sidRef = useRef(null)
  const decayRafRef = useRef(null)

  useEffect(() => { modeRef.current = mode }, [mode])

  // Load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const check = () => { setVoiceReady(true) }
    check()
    window.speechSynthesis.onvoiceschanged = check
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // Intensity decay loop — always running to smoothly relax intensity
  useEffect(() => {
    const step = () => {
      const target = modeRef.current === 'speaking' ? 0.45
        : modeRef.current === 'listening' ? 0.30
        : 0
      const cur = intensityRef.current || 0
      const next = cur + (target - cur) * 0.06
      intensityRef.current = next
      decayRafRef.current = requestAnimationFrame(step)
    }
    decayRafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(decayRafRef.current)
  }, [intensityRef])

  // ------ Core speak helper ------
  const speak = (text, opts = {}) => new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return }
    try { window.speechSynthesis.cancel() } catch {}
    const u = new SpeechSynthesisUtterance(text)
    u.pitch = 0.95
    u.rate = 1.05
    u.volume = 1
    const v = pickVoice(); if (v) u.voice = v

    let boundaryFired = false
    let fallbackTimer = null
    const totalDur = Math.max(1200, text.length * 55)
    const startAt = performance.now()
    const prefix = opts.prefix || ''

    u.onstart = () => {
      setMode('speaking')
      // trigger initial burst
      intensityRef.current = Math.min(1, (intensityRef.current || 0) + 0.5)
    }
    u.onboundary = (e) => {
      boundaryFired = true
      if (e.name === 'word' || e.name === 'sentence' || !e.name) {
        const idx = (e.charIndex || 0) + (e.charLength || 0)
        setSubtitle(prefix + text.slice(0, idx))
        // pulse intensity on each word
        intensityRef.current = Math.min(1, (intensityRef.current || 0) + 0.25)
        // keyword flash for card highlight is handled by segment prewarming
      }
    }
    // Fallback progressive reveal (some browsers don't fire boundary reliably)
    fallbackTimer = setInterval(() => {
      if (boundaryFired) return
      const p = Math.min(1, (performance.now() - startAt) / totalDur)
      setSubtitle(prefix + text.slice(0, Math.floor(p * text.length)))
      // Also pulse intensity mildly
      if (Math.random() < 0.35) intensityRef.current = Math.min(1, (intensityRef.current || 0) + 0.12)
    }, 60)
    u.onend = () => {
      if (fallbackTimer) clearInterval(fallbackTimer)
      setSubtitle(prefix + text)
      resolve()
    }
    u.onerror = () => {
      if (fallbackTimer) clearInterval(fallbackTimer)
      resolve()
    }
    window.speechSynthesis.speak(u)
  })

  // Trigger a set of random constellation flashes
  const triggerFlashes = (count = 4, color = 0x00f0ff) => {
    if (!flashesRef?.current) return
    for (let i = 0; i < count; i++) {
      flashesRef.current.push({
        index: Math.floor(Math.random() * 280),
        startTime: performance.now() + i * 60,
        duration: 1600,
        color,
        size: 0.4 + Math.random() * 0.3,
      })
    }
  }

  // ------ Continuous listen ------
  const startListen = () => new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(''); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { resolve('__NOSR__'); return }
    try { window.speechSynthesis?.cancel() } catch {}
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    recRef.current = rec
    let finalText = ''
    let started = false
    let startTimer = null

    rec.onstart = () => {
      started = true
      if (startTimer) clearTimeout(startTimer)
      setMode('listening')
    }
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      const shown = (finalText || interim).trim()
      if (shown) setSubtitle('> ' + shown)
      // Pulse intensity on new speech input detected
      intensityRef.current = Math.min(1, (intensityRef.current || 0) + 0.15)
    }
    rec.onerror = () => {
      if (startTimer) clearTimeout(startTimer)
      resolve('__ERR__')
    }
    rec.onend = () => {
      if (startTimer) clearTimeout(startTimer)
      resolve((finalText || '').trim())
    }
    try {
      rec.start()
      startTimer = setTimeout(() => {
        if (!started) { try { rec.abort && rec.abort() } catch {}; resolve('__NOPERM__') }
      }, 1500)
    } catch { resolve('__ERR__') }
  })

  // ------ Main sequence ------
  const playGreeting = async () => {
    stoppedRef.current = false
    setSubtitle('')
    let accumulated = ''
    triggerFlashes(6, 0x00f0ff)
    for (const seg of GREETING) {
      if (stoppedRef.current) return
      if (seg.card) {
        onCardHighlight && onCardHighlight(seg.card)
        // Card-specific flash color
        const colorMap = { visits: 0x00f0ff, conversations: 0xffb700, filtered: 0xff2a5f, revenue: 0x00f0ff }
        triggerFlashes(5, colorMap[seg.card] || 0x00f0ff)
      } else {
        onCardHighlight && onCardHighlight(null)
      }
      await speak(seg.text, { prefix: accumulated })
      accumulated += seg.text + ' '
      if (stoppedRef.current) return
    }
    onCardHighlight && onCardHighlight(null)
    if (onSpeakEnd) onSpeakEnd()
    // Now enter listening loop
    listenLoop()
  }

  const listenLoop = async () => {
    while (!stoppedRef.current) {
      setSubtitle('') // Clear before each listen
      setMode('listening')
      const result = await startListen()
      if (stoppedRef.current) return
      if (result === '__NOSR__') {
        await speak('Voice recognition is unavailable in this browser, sir. Try Chrome or Edge.')
        setMode('idle'); return
      }
      if (result === '__NOPERM__') {
        await speak('Microphone permission is required, sir. Please enable it and try again.')
        setMode('idle'); return
      }
      if (result === '__ERR__' || !result) {
        // Silence — gentle prompt and loop
        await new Promise(r => setTimeout(r, 400))
        continue
      }
      // Send to /api/chat
      setMode('processing')
      setSubtitle('> ' + result)
      try {
        const r = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: result, sessionId: sidRef.current }),
        })
        const d = await r.json()
        sidRef.current = d.sessionId
        triggerFlashes(3, 0x00f0ff)
        await speak(d.reply || 'I did not catch that, sir.')
      } catch (e) {
        await speak('Connection to core disrupted, sir.')
      }
    }
  }

  const handleUnmute = async () => {
    if (unmuted) return
    setUnmuted(true)
    // Warm up SpeechSynthesis with a silent utterance (user-gesture requirement)
    try {
      const warm = new SpeechSynthesisUtterance(' ')
      warm.volume = 0
      window.speechSynthesis.speak(warm)
    } catch {}
    await new Promise(r => setTimeout(r, 120))
    playGreeting()
  }

  const handleMute = () => {
    stoppedRef.current = true
    try { window.speechSynthesis?.cancel() } catch {}
    try { recRef.current?.abort && recRef.current.abort() } catch {}
    setMode('idle')
    setSubtitle('')
    setUnmuted(false)
    onCardHighlight && onCardHighlight(null)
  }

  // Modes displayed
  const modeLabel = {
    idle: 'STANDBY',
    speaking: 'SPEAKING',
    listening: 'LISTENING',
    processing: 'PROCESSING',
  }[mode]

  const modeColor = {
    idle: 'text-cyan-500',
    speaking: 'text-cyan-300',
    listening: 'text-red-300',
    processing: 'text-amber-300',
  }[mode]

  return (
    <>
      {/* Subtitle bar (top of bottom UI, above the unmute button) */}
      <AnimatePresence>
        {unmuted && subtitle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 w-[min(88vw,1000px)]"
          >
            <div className="corner-brackets bg-black/75 backdrop-blur-md border border-cyan-500/60 px-6 py-3">
              <span className="cb-tr" /><span className="cb-bl" />
              <div className="flex items-baseline gap-3">
                <span className={`text-[10px] uppercase tracking-[0.3em] font-display shrink-0 ${modeColor}`}>
                  {modeLabel}
                </span>
                <span className="text-cyan-100 text-base md:text-lg leading-relaxed text-glow-sm caret">{subtitle}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centered Unmute / Status button */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 pointer-events-auto">
        {unmuted && (
          <div className="flex items-center gap-4">
            <VisualizerBars mode={mode} />
          </div>
        )}
        {!unmuted ? (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={handleUnmute}
            className="group relative flex items-center gap-3 px-8 py-3 border-2 border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-display text-sm md:text-base tracking-[0.35em] font-bold uppercase glow-cyan corner-brackets"
          >
            <span className="cb-tr" /><span className="cb-bl" />
            <Power className="w-4 h-4" />
            <span className="text-glow-sm">Unmute · Start System</span>
            <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-400 text-emerald-400 ping-dot" />
          </motion.button>
        ) : (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={handleMute}
            className="group relative flex items-center gap-3 px-6 py-2 border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-200 font-display text-sm tracking-[0.35em] font-bold uppercase glow-red corner-brackets"
          >
            <span className="cb-tr" /><span className="cb-bl" />
            <VolumeX className="w-4 h-4" />
            <span className="text-glow-sm">Mute · Shutdown</span>
          </motion.button>
        )}
      </div>
    </>
  )
}
