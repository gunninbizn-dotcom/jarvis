'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Zap, Radio, Cpu, Shield, Satellite, Thermometer,
  Send, Power, Mic, Wifi, Clock, Globe, AlertTriangle, Lock, Radar as RadarIcon
} from 'lucide-react'
import Radar from '@/components/jarvis/Radar'
import Waveform from '@/components/jarvis/Waveform'
import StatPanel from '@/components/jarvis/StatPanel'
import BootSequence from '@/components/jarvis/BootSequence'
import MissionFeed from '@/components/jarvis/MissionFeed'
import MiniCalendar from '@/components/jarvis/MiniCalendar'

const Core3D = dynamic(() => import('@/components/jarvis/Core3D'), { ssr: false })
const Globe3D = dynamic(() => import('@/components/jarvis/Globe3D'), { ssr: false })

function Clockface() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="text-right">
      <div className="font-display text-2xl md:text-3xl text-cyan-300 text-glow tracking-widest">
        {now.toLocaleTimeString('en-US', { hour12: false })}
      </div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/80">
        {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
      </div>
    </div>
  )
}

function HUDPanel({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`hud-frame p-3 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-cyan-400">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span className="text-[10px] uppercase tracking-[0.25em] font-display">{title}</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-cyan-400 blink" />
          <div className="w-1 h-1 rounded-full bg-cyan-600" />
        </div>
      </div>
      {children}
    </div>
  )
}

function DataStream() {
  const chars = 'ABCDEF0123456789█▓▒░'.split('')
  const [rows, setRows] = useState([])
  useEffect(() => {
    const gen = () => {
      setRows(Array.from({ length: 8 }, () =>
        Array.from({ length: 22 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      ))
    }
    gen()
    const i = setInterval(gen, 150)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="font-mono text-[10px] leading-[1.1] text-cyan-500/80 space-y-0.5">
      {rows.map((r, i) => (
        <div key={i} className="truncate">{r}</div>
      ))}
    </div>
  )
}

function App() {
  const [booted, setBooted] = useState(false)
  const [telemetry, setTelemetry] = useState({
    cpu: 42, memory: 61, network: 850, power: 92, threats: 0, temp: 36, satellites: 11,
  })
  const [messages, setMessages] = useState([
    { role: 'jarvis', text: 'Good evening, Sir. All systems are operational and awaiting your command.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const sessionIdRef = useRef(null)
  const chatEndRef = useRef(null)

  // Poll telemetry
  useEffect(() => {
    if (!booted) return
    const fetchTel = async () => {
      try {
        const r = await fetch('/api/status')
        const d = await r.json()
        setTelemetry(d)
      } catch {}
    }
    fetchTel()
    const i = setInterval(fetchTel, 2500)
    return () => clearInterval(i)
  }, [booted])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text }])
    setSending(true)
    setSpeaking(true)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      })
      const d = await r.json()
      sessionIdRef.current = d.sessionId
      // Simulate typing
      await new Promise(res => setTimeout(res, 500))
      setMessages(m => [...m, { role: 'jarvis', text: d.reply }])
      // Try to speak using browser TTS
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance(d.reply)
          u.rate = 1
          u.pitch = 0.85
          u.volume = 0.9
          const voices = window.speechSynthesis.getVoices()
          const brit = voices.find(v => /uk|british|daniel|arthur/i.test(v.name + v.lang))
          if (brit) u.voice = brit
          u.onend = () => setSpeaking(false)
          window.speechSynthesis.speak(u)
        } else { setSpeaking(false) }
      } catch { setSpeaking(false) }
    } catch (e) {
      setMessages(m => [...m, { role: 'jarvis', text: 'Connection to core disrupted. Retrying...' }])
      setSpeaking(false)
    } finally {
      setSending(false)
    }
  }

  const quickCmds = ['System status', 'Radar scan', 'Weather report', 'Tell me a joke', 'Who are you?']

  // Voice recognition
  const startListening = () => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setMessages(m => [...m, { role: 'jarvis', text: 'Voice input is not supported in this browser, Sir. Try Chrome or Edge.' }])
      return
    }
    try { window.speechSynthesis?.cancel() } catch {}
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    let started = false
    let startTimer = null
    const showUnavailable = (reason) => {
      const msg = reason === 'not-allowed' || reason === 'permission-denied'
        ? 'Microphone permission is blocked, Sir. Please allow microphone access in your browser settings.'
        : 'Voice input is unavailable in this environment, Sir. Try opening the app in Chrome or Edge with microphone permission granted.'
      setMessages(m => [...m, { role: 'jarvis', text: msg }])
    }
    rec.onstart = () => {
      started = true
      if (startTimer) { clearTimeout(startTimer); startTimer = null }
      setListening(true)
    }
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      setInput((finalText || interim).trim())
    }
    rec.onerror = (e) => {
      setListening(false)
      if (startTimer) { clearTimeout(startTimer); startTimer = null }
      showUnavailable(e?.error)
    }
    rec.onend = () => {
      setListening(false)
      if (startTimer) { clearTimeout(startTimer); startTimer = null }
      const t = (finalText || '').trim()
      if (t) { setInput(t); setTimeout(send, 100) }
    }
    recognitionRef.current = rec
    try {
      rec.start()
      // If onstart never fires within 1.5s, surface a fallback message
      startTimer = setTimeout(() => {
        if (!started) {
          setListening(false)
          showUnavailable()
          try { rec.abort && rec.abort() } catch {}
        }
      }, 1500)
    } catch (err) {
      setListening(false)
      showUnavailable(err?.name)
    }
  }

  const stopListening = () => {
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
  }

  return (
    <div className="min-h-screen w-full bg-black text-cyan-100 relative overflow-hidden scanlines crt">
      {!booted && <BootSequence onDone={() => setBooted(true)} />}

      {/* Ambient background grid */}
      <div className="fixed inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

      <AnimatePresence>
        {booted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            {/* Top Bar */}
            <div className="px-4 md:px-8 pt-4 pb-3 border-b border-cyan-500/20 flex items-center justify-between backdrop-blur-sm bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center pulse-glow">
                  <Zap className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <div className="font-display text-xl text-cyan-300 text-glow tracking-[0.3em] glitch">J.A.R.V.I.S.</div>
                  <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-500/70">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6 text-[10px] uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">UPLINK</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-400">SECURE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Satellite className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-400">SAT × {telemetry.satellites || 11}</span>
                </div>
              </div>

              <Clockface />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-12 gap-4 p-4 md:p-6">
              {/* LEFT COLUMN */}
              <div className="col-span-12 lg:col-span-3 space-y-4">
                <HUDPanel title="System Vitals" icon={Cpu}>
                  <div className="space-y-3">
                    <StatPanel label="CPU Load" value={telemetry.cpu?.toFixed(1)} unit="%" percent={telemetry.cpu} />
                    <StatPanel label="Memory" value={telemetry.memory?.toFixed(1)} unit="%" percent={telemetry.memory} />
                    <StatPanel label="Network" value={telemetry.network?.toFixed(0)} unit="MB/s" percent={(telemetry.network / 1200) * 100} color="green" />
                    <StatPanel label="Core Temp" value={telemetry.temp?.toFixed(1)} unit="°C" percent={(telemetry.temp / 100) * 100} color="amber" />
                  </div>
                </HUDPanel>

                <HUDPanel title="Arc Reactor" icon={Zap}>
                  <div className="flex items-center justify-center py-2">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="rgba(34,211,238,0.15)" strokeWidth="4" fill="none" />
                        <circle cx="50" cy="50" r="45" stroke="#22d3ee" strokeWidth="4" fill="none"
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 * (1 - (telemetry.power || 92) / 100)}
                          strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 8px #22d3ee)', transition: 'stroke-dashoffset 0.8s ease' }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="font-display text-3xl text-cyan-300 text-glow font-bold">{(telemetry.power || 92).toFixed(0)}</div>
                        <div className="text-[9px] uppercase tracking-widest text-cyan-500">Output %</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-cyan-500 uppercase tracking-widest mt-1">Palladium: Stable</div>
                </HUDPanel>

                <HUDPanel title="Tactical Calendar" icon={Clock}>
                  <MiniCalendar />
                </HUDPanel>
              </div>

              {/* CENTER COLUMN */}
              <div className="col-span-12 lg:col-span-6 space-y-4">
                <div className="hud-frame relative h-[420px] md:h-[500px] overflow-hidden">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-cyan-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.3em] font-display">Neural Core Online</span>
                  </div>
                  <div className="absolute top-3 right-3 z-10 text-right">
                    <div className="text-[10px] uppercase tracking-widest text-cyan-500">Threat Level</div>
                    <div className="font-display text-lg font-bold text-emerald-400 text-glow">MINIMAL</div>
                  </div>
                  <div className="absolute inset-0">
                    <Core3D speaking={speaking} />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-10">
                    <Waveform active={speaking} />
                  </div>
                </div>

                {/* Chat / Command console */}
                <div className="hud-frame p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Radio className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase tracking-[0.25em] font-display">Command Console</span>
                    </div>
                    <span className="text-[10px] text-cyan-500/70 uppercase tracking-widest">Session Active</span>
                  </div>

                  <div className="h-48 overflow-y-auto space-y-2 pr-2 mb-3 text-sm">
                    {messages.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {m.role === 'jarvis' && (
                          <span className="text-cyan-500 text-[10px] mt-1 font-display">JARVIS &gt;</span>
                        )}
                        <div className={`max-w-[85%] px-3 py-2 rounded-sm ${
                          m.role === 'user'
                            ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-100'
                            : 'bg-black/40 border border-cyan-500/30 text-cyan-200 text-glow-sm'
                        }`}>
                          {m.text}
                        </div>
                        {m.role === 'user' && (
                          <span className="text-cyan-500 text-[10px] mt-1 font-display">&lt; SIR</span>
                        )}
                      </motion.div>
                    ))}
                    {sending && (
                      <div className="flex items-center gap-2 text-cyan-400 text-xs">
                        <span className="text-cyan-500 font-display">JARVIS &gt;</span>
                        <span className="flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick commands */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {quickCmds.map(q => (
                      <button key={q}
                        onClick={() => { setInput(q); setTimeout(send, 50) }}
                        className="text-[10px] uppercase tracking-widest px-2 py-1 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/15 hover:text-cyan-200 transition rounded-sm">
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-cyan-500 font-display text-sm">&gt;</span>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && send()}
                      placeholder={listening ? 'Listening...' : 'Speak, Sir...'}
                      className="flex-1 bg-black/40 border border-cyan-500/30 focus:border-cyan-400 outline-none px-3 py-2 text-sm text-cyan-100 rounded-sm placeholder:text-cyan-700 tracking-wide"
                    />
                    <button
                      onClick={listening ? stopListening : startListening}
                      className={`px-3 py-2 border rounded-sm transition flex items-center gap-2 ${
                        listening
                          ? 'bg-red-500/25 border-red-400 text-red-200 animate-pulse'
                          : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/25'
                      }`}
                      title={listening ? 'Stop listening' : 'Voice command'}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={send}
                      disabled={sending}
                      className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400 text-cyan-200 text-glow-sm rounded-sm transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase tracking-widest">Send</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="col-span-12 lg:col-span-3 space-y-4">
                <HUDPanel title="Global Uplink" icon={Globe}>
                  <div className="h-[200px] w-full">
                    <Globe3D />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-300" style={{ boxShadow: '0 0 6px #22d3ee' }} />
                      <span className="text-cyan-400">Node Link</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
                      <span className="text-red-400">Asset Pin</span>
                    </div>
                  </div>
                </HUDPanel>

                <HUDPanel title="Perimeter Scan" icon={RadarIcon}>
                  <Radar />
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-300" style={{ boxShadow: '0 0 6px #22d3ee' }} />
                      <span className="text-cyan-400">Friendly</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
                      <span className="text-red-400">Unknown</span>
                    </div>
                  </div>
                </HUDPanel>

                <HUDPanel title="Mission Feed" icon={AlertTriangle}>
                  <MissionFeed />
                </HUDPanel>
              </div>
            </div>

            {/* Footer status */}
            <div className="border-t border-cyan-500/20 px-6 py-2 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-cyan-500/70 backdrop-blur-sm bg-black/40">
              <div className="flex items-center gap-4">
                <span>&copy; Stark Industries</span>
                <span>Build 1.0.0</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-emerald-400">● ALL SYSTEMS NOMINAL</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
