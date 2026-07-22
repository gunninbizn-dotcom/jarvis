'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LINES = [
  'INITIALIZING J.A.R.V.I.S. CORE...',
  'LOADING NEURAL NETWORK... [OK]',
  'CALIBRATING QUANTUM PROCESSORS... [OK]',
  'ESTABLISHING SATELLITE UPLINK... [OK]',
  'ARC REACTOR SYNC... 100%',
  'BIOMETRIC AUTHENTICATION... VERIFIED',
  'WELCOME BACK, SIR.',
]

export default function BootSequence({ onDone }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (step < LINES.length) {
      const t = setTimeout(() => setStep(step + 1), 380)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => { setDone(true); onDone && onDone() }, 700)
      return () => clearTimeout(t)
    }
  }, [step, onDone])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center scanlines"
        >
          <div className="w-full max-w-xl px-6 space-y-3 font-mono">
            <div className="font-display text-3xl md:text-5xl text-cyan-300 text-glow text-center mb-8 tracking-widest">
              J.A.R.V.I.S.
            </div>
            {LINES.slice(0, step).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-cyan-400 text-sm tracking-wider"
              >
                <span className="text-cyan-600">&gt;</span> {line}
              </motion.div>
            ))}
            {step < LINES.length && (
              <div className="text-cyan-500 text-sm">
                <span className="blink">█</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
