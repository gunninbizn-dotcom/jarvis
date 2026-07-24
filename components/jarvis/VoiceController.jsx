'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Power, VolumeX, Settings } from 'lucide-react'
import { isPiperAvailable, speakPiper, stopPiper } from '@/lib/piper'
import { startWakeWordDetection, isWakeWordServerAvailable, startWakeWordServerDetection } from '@/lib/wakeword'

const PREFERRED_VOICES = [
  /daniel/i, /arthur/i, /oliver/i, /george/i, /english \(uk\)/i, /en-gb/i,
  /alex/i, /samantha/i, /google us english/i,
]

function pickVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null
  for (const pattern of PREFERRED_VOICES) {
    const match = voices.find((voice) => pattern.test(`${voice.name} ${voice.lang}`))
    if (match) return match
  }
  return voices[0]
}

function getAudioLevel(analyser) {
  if (!analyser) return 0
  const data = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const value = (data[i] - 128) / 128
    sum += value * value
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 2)
}

function VisualizerBars({ mode }) {
  const bars = useMemo(
    () => Array.from({ length: 18 }, (_, index) => ({
      delay: (index % 6) * 0.06 + index * 0.01,
      duration: 0.7 + (index % 4) * 0.04,
    })),
    []
  )
  const color = mode === 'speaking' ? '#00f0ff' : mode === 'listening' ? '#ff2a5f' : '#0891b2'

  return (
    <div className="visualizer-bars" style={{ '--visualizer-color': color }}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="visualizer-bar"
          style={{ animationDelay: `${bar.delay}s`, animationDuration: `${mode === 'idle' ? 1.6 : bar.duration}s` }}
        />
      ))}
    </div>
  )
}

export default function VoiceController({ intensityRef, flashesRef, onCardHighlight, history = [], sessionId, onSessionId, onAddMessage }) {
  const [active, setActive] = useState(false)
  const [mode, setMode] = useState('idle')
  const [subtitle, setSubtitle] = useState("Say 'Open Jarvis' to activate.")
  const [micSupported, setMicSupported] = useState(true)
  const [recognitionError, setRecognitionError] = useState(null)
  const [speechReady, setSpeechReady] = useState(false)
  const [speechError, setSpeechError] = useState(null)

  const recognitionRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const micStreamRef = useRef(null)
  const speakingRef = useRef(false)
  const shouldListenRef = useRef(false)
  const sidRef = useRef(null)
  const rafRef = useRef(null)
  const usePiperRef = useRef(false)
  const [speechRate, setSpeechRate] = useState(1.0)
  const [ttsEngine, setTtsEngine] = useState('browser')
  const [wakeWordActive, setWakeWordActive] = useState(false)
  const wakeWordDetectorRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMicSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
    // Check if Piper TTS is available
    isPiperAvailable().then((available) => {
      usePiperRef.current = available
      setTtsEngine(available ? 'piper' : 'browser')
    })
    // Start wake word detection
    startWakeWordDetection(() => {
      if (!active) {
        setWakeWordActive(true)
        setSubtitle('Wake word detected. Activating...')
        handleActivate()
      }
    })
  }, [])

  useEffect(() => {
    const update = () => {
      const level = getAudioLevel(analyserRef.current)
      const base = speakingRef.current ? 0.6 : mode === 'listening' ? 0.4 : 0.08
      const next = Math.min(1, Math.max(level, base))
      intensityRef.current = next
      rafRef.current = requestAnimationFrame(update)
    }
    rafRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafRef.current)
  }, [mode, intensityRef])

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
  }

  const cleanupAudio = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch {}
      audioContextRef.current = null
    }
    analyserRef.current = null
  }

  const requestMicPermission = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not available')
    }
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  }

  const initSpeechSynthesis = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSpeechError('Speech synthesis is not supported by this browser.')
      return false
    }

    try {
      const utterance = new SpeechSynthesisUtterance('')
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      setSpeechReady(true)
      setSpeechError(null)
      return true
    } catch (error) {
      console.warn('Speech synthesis init failed:', error)
      setSpeechError('Speech synthesis is blocked or muted. Please unmute your browser.')
      return false
    }
  }

  useEffect(() => {
    if (sessionId) {
      sidRef.current = sessionId
    }
  }, [sessionId])

  const initAudioAnalyser = async () => {
    const stream = await requestMicPermission()
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    audioContextRef.current = context
    analyserRef.current = analyser
    micStreamRef.current = stream
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const speechQueueRef = useRef([])
  const activeSpeechUtteranceRef = useRef(null)
  const streamAbortRef = useRef(null)
  const pendingSpeechRef = useRef('')

  const pulseVisuals = (count, color) => {
    if (!flashesRef?.current) return
    for (let i = 0; i < count; i += 1) {
      flashesRef.current.push({
        index: Math.floor(Math.random() * 280),
        startTime: performance.now() + i * 40,
        duration: 1100 + Math.random() * 600,
        color,
        size: 0.22 + Math.random() * 0.28,
      })
    }
    if (typeof onCardHighlight === 'function') {
      onCardHighlight('conversations')
      setTimeout(() => onCardHighlight(null), 900)
    }
  }

  const enqueueSpeech = (text) => {
    if (!text || !text.trim()) return

    // Use Piper TTS if available (preferred), otherwise fall back to SpeechSynthesis
    if (usePiperRef.current) {
      speakingRef.current = true
      setMode('speaking')
      setSubtitle(text)
      speakPiper(text, { rate: speechRate })
        .then(() => {
          speakingRef.current = false
          if (active) setMode('idle')
        })
        .catch(() => {
          // Fallback to SpeechSynthesis if Piper fails
          usePiperRef.current = false
          setTtsEngine('browser')
          enqueueSpeech(text)
        })
      return
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (!speechReady && !initSpeechSynthesis()) {
      setSpeechError('Unable to play speech. Please interact with the page and unmute audio.')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = 1
    utterance.rate = speechRate
    utterance.volume = 1
    const selected = pickVoice()
    if (selected) utterance.voice = selected

    utterance.onstart = () => {
      speakingRef.current = true
      setMode('speaking')
      setSubtitle(text)
    }

    utterance.onend = () => {
      if (speechQueueRef.current.length > 0) {
        const next = speechQueueRef.current.shift()
        activeSpeechUtteranceRef.current = next
        window.speechSynthesis.speak(next)
      } else {
        activeSpeechUtteranceRef.current = null
        speakingRef.current = false
        if (active) setMode('idle')
      }
    }

    utterance.onerror = () => {
      if (speechQueueRef.current.length > 0) {
        const next = speechQueueRef.current.shift()
        activeSpeechUtteranceRef.current = next
        window.speechSynthesis.speak(next)
      } else {
        activeSpeechUtteranceRef.current = null
        speakingRef.current = false
        if (active) setMode('idle')
      }
    }

    speechQueueRef.current.push(utterance)
    if (!activeSpeechUtteranceRef.current) {
      const next = speechQueueRef.current.shift()
      activeSpeechUtteranceRef.current = next
      window.speechSynthesis.speak(next)
    }
  }

  const stopSpeech = () => {
    // Stop Piper TTS if active
    stopPiper()
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    } catch {}
    speakingRef.current = false
    speechQueueRef.current = []
    activeSpeechUtteranceRef.current = null
  }

  const createSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const recognizer = new SR()
    recognizer.lang = 'en-US'
    recognizer.interimResults = true
    recognizer.continuous = true
    recognizer.maxAlternatives = 1
    return recognizer
  }

  const startRecognition = () => new Promise(async (resolve) => {
    if (typeof window === 'undefined') {
      return resolve('__NOSR__')
    }

    const recognizer = createSpeechRecognition()
    if (!recognizer) {
      return resolve('__NOSR__')
    }

    recognitionRef.current = recognizer
    let finalTranscript = ''
    let interimTranscript = ''
    let started = false
    let settled = false
    let timeoutId
    let silenceTimer = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
    }

    const settle = (value) => {
      if (settled) return
      settled = true
      cleanup()
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
      recognitionRef.current = null
      resolve(value)
    }

    recognizer.onstart = () => {
      started = true
      if (speakingRef.current) {
        stopSpeech()
      }
      setMode('listening')
      setSubtitle('Listening... speak now')
    }

    recognizer.onresult = (event) => {
      interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }
      const shown = (finalTranscript || interimTranscript).trim()
      if (shown) {
        setSubtitle('> ' + shown)
        intensityRef.current = Math.min(1, Math.max(intensityRef.current || 0, 0.4))
        // Reset silence timer — speech is being detected
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (!settled && started) {
            const result = (finalTranscript || interimTranscript).trim()
            if (result) {
              setSubtitle('Processing...')
              settle(result)
            } else {
              setSubtitle('No speech detected. Try speaking again.')
              settle('')
            }
          }
        }, 3000)
      }
      if (finalTranscript.trim()) {
        settle(finalTranscript.trim())
      }
    }

    recognizer.onspeechend = () => {
      setSubtitle('Processing speech...')
    }

    recognizer.onnomatch = () => {
      setSubtitle('I did not catch that. Please speak clearly.')
    }

    recognizer.onerror = (event) => {
      setRecognitionError(event?.error || 'unknown')
      const err = event?.error || 'unknown'
      if (err === 'no-speech' || err === 'audio-capture') {
        setSubtitle('No voice detected. Please check your microphone.')
      } else {
        setSubtitle(`Recognition error: ${err}`)
      }
      settle('__ERR__')
    }

    recognizer.onend = () => {
      if (settled) return
      const result = (finalTranscript || interimTranscript).trim()
      if (!result) {
        setMode('idle')
      }
      settle(result)
    }

    try {
      recognizer.start()
    } catch (error) {
      setSubtitle('Recognition failed to start. Try refreshing.')
      return settle('__ERR__')
    }

    timeoutId = setTimeout(() => {
      if (!started && !settled) {
        setSubtitle('Microphone access not granted or recognition unavailable.')
        settle('__NOPERM__')
      }
    }, 8000)
  })

  const streamChatResponse = async (message) => {
    try {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
      }
      const controller = new AbortController()
      streamAbortRef.current = controller

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: sidRef.current, history }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error || 'Request failed')
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('Stream body unavailable')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let text = ''
      pendingSpeechRef.current = ''
      let firstSpeak = false

      const flushSpeech = (force = false) => {
        const chunk = pendingSpeechRef.current.trim()
        if (!chunk) return
        if (force || chunk.length >= 45) {
          enqueueSpeech(chunk)
          pendingSpeechRef.current = ''
          firstSpeak = true
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          let payload
          try {
            payload = JSON.parse(line)
          } catch {
            continue
          }

          if (payload.sessionId) {
            sidRef.current = payload.sessionId
            window.sessionStorage.setItem('jarvisSessionId', payload.sessionId)
            if (typeof onSessionId === 'function') onSessionId(payload.sessionId)
          }

          if (payload.delta) {
            text += payload.delta
            pendingSpeechRef.current += payload.delta
            if (!firstSpeak && pendingSpeechRef.current.length >= 22) {
              flushSpeech(true)
            } else {
              flushSpeech(false)
            }
          }

          if (payload.done) {
            flushSpeech(true)
            return text.trim()
          }
        }
      }

      if (buffer.trim()) {
        try {
          const payload = JSON.parse(buffer)
          if (payload.delta) {
            text += payload.delta
            pendingSpeechRef.current += payload.delta
          }
          if (payload.done) {
            flushSpeech(true)
          }
        } catch {}
      }

      flushSpeech(true)
      return text.trim()
    } catch (error) {
      if (error.name === 'AbortError') {
        return ''
      }
      setSubtitle('Network error. Please check your connection.')
      return 'I could not reach the assistant. Please check your connection.'
    }
  }

  const listenLoop = async () => {
    while (active && shouldListenRef.current) {
      const result = await startRecognition()
      if (!active || !shouldListenRef.current) break
      if (result === '__NOSR__') {
        setMode('idle')
        setSubtitle('Speech recognition unavailable. Use Chrome or Edge.')
        break
      }
      if (result === '__NOPERM__') {
        setMode('idle')
        setSubtitle('Microphone permission required.')
        break
      }
      if (result === '__ERR__') {
        setSubtitle('Recognition error. Retrying...')
        await delay(500)
        continue
      }
      if (!result) {
        await delay(300)
        continue
      }

      setMode('processing')
      setSubtitle('Processing request...')
      pulseVisuals(4, 0x00f0ff)
      if (typeof onAddMessage === 'function') {
        onAddMessage({ role: 'user', text: result })
      }
      const reply = await streamChatResponse(result)
      if (typeof onAddMessage === 'function') {
        onAddMessage({ role: 'jarvis', text: reply })
      }
      if (!active || !shouldListenRef.current) break
      setMode('idle')
      setSubtitle('Ready for your next command.')
      await delay(300)
    }
  }

  const handleActivate = async () => {
    if (active) return
    if (!micSupported) {
      setSubtitle('Voice recognition not supported in this browser.')
      return
    }

    initSpeechSynthesis()

    try {
      await initAudioAnalyser()
    } catch {
      // Continue even if analyser setup fails, recognition can still work.
      setSubtitle('Voice ready. Please allow microphone access if prompted.')
    }

    const stored = window.sessionStorage.getItem('jarvisSessionId')
    if (stored) {
      sidRef.current = stored
      if (typeof onSessionId === 'function') {
        onSessionId(stored)
      }
    }

    shouldListenRef.current = true
    setActive(true)
    setMode('idle')
    setSubtitle('Awaiting your voice command...')
    await delay(300)
    listenLoop()
  }

  const handleDeactivate = () => {
    shouldListenRef.current = false
    setActive(false)
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }
    stopRecognition()
    stopSpeech()
    cleanupAudio()
    setMode('idle')
    setSubtitle('Jarvis deactivated.')
  }

  return (
    <>
      <AnimatePresence>
        {subtitle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 w-[min(88vw,1000px)]"
          >
            <div className="corner-brackets bg-black/75 backdrop-blur-md border border-cyan-500/60 px-6 py-3">
              <span className="cb-tr" /><span className="cb-bl" />
              <div className="flex items-baseline gap-3">
                <span className={`text-[10px] uppercase tracking-[0.3em] font-display shrink-0 ${mode === 'listening' ? 'text-red-300' : mode === 'speaking' ? 'text-cyan-300' : mode === 'processing' ? 'text-amber-300' : 'text-cyan-500'}`}>
                  {mode.toUpperCase()}
                </span>
                <span className="text-cyan-100 text-base md:text-lg leading-relaxed text-glow-sm caret">{subtitle}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {speechError && (
        <div className="absolute bottom-64 left-1/2 -translate-x-1/2 z-40 rounded-3xl border border-red-500/40 bg-black/80 px-5 py-3 text-sm text-red-200 shadow-[0_0_30px_rgba(255,0,0,0.18)]">
          <div className="font-semibold uppercase tracking-[0.2em] text-red-300">Speech output blocked</div>
          <div className="mt-1 text-[11px] leading-snug text-red-200">{speechError}</div>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 pointer-events-auto">
        {active && (
          <div className="flex items-center gap-4">
            <VisualizerBars mode={mode} />
          </div>
        )}
        {!active ? (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleActivate}
            className="group relative flex items-center gap-3 px-8 py-3 border-2 border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-display text-sm md:text-base tracking-[0.35em] font-bold uppercase glow-cyan corner-brackets"
          >
            <span className="cb-tr" /><span className="cb-bl" />
            <Power className="w-4 h-4" />
            <span className="text-glow-sm">Activate Jarvis</span>
            <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-400 ping-dot" />
          </motion.button>
        ) : (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleDeactivate}
            className="group relative flex items-center gap-3 px-6 py-2 border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-200 font-display text-sm tracking-[0.35em] font-bold uppercase glow-red corner-brackets"
          >
            <span className="cb-tr" /><span className="cb-bl" />
            <VolumeX className="w-4 h-4" />
            <span className="text-glow-sm">Deactivate</span>
          </motion.button>
        )}
      </div>
    </>
  )
}
