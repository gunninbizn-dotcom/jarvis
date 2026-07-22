'use client'

import { useEffect, useState } from 'react'

export default function Radar() {
  const [blips, setBlips] = useState([])

  useEffect(() => {
    const gen = () => {
      const arr = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        friendly: Math.random() > 0.3,
        id: Math.random(),
      }))
      setBlips(arr)
    }
    gen()
    const i = setInterval(gen, 3500)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="relative w-full aspect-square rounded-full overflow-hidden border border-cyan-500/50">
      {/* Grid */}
      <div className="absolute inset-0 rounded-full" style={{
        background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, rgba(0,0,0,0.9) 70%)'
      }} />
      {/* Concentric rings */}
      {[25, 50, 75, 100].map(s => (
        <div key={s}
          className="absolute rounded-full border border-cyan-500/30"
          style={{ width: `${s}%`, height: `${s}%`, top: `${(100 - s) / 2}%`, left: `${(100 - s) / 2}%` }} />
      ))}
      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-500/30" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-500/30" />

      {/* Sweep */}
      <div className="absolute inset-0 sweep">
        <div className="absolute top-1/2 left-1/2 origin-left w-1/2 h-px"
          style={{
            background: 'linear-gradient(to right, rgba(34,211,238,0.9), transparent)',
            boxShadow: '0 0 12px rgba(34,211,238,0.8)',
          }} />
        <div className="absolute top-1/2 left-1/2 origin-left w-1/2"
          style={{
            height: '60%',
            transform: 'translateY(-50%)',
            background: 'conic-gradient(from 0deg at 0% 50%, rgba(34,211,238,0.25), transparent 40deg)',
          }} />
      </div>

      {/* Blips */}
      {blips.map(b => (
        <div key={b.id}
          className={`absolute w-1.5 h-1.5 rounded-full ${b.friendly ? 'bg-cyan-300' : 'bg-red-500'}`}
          style={{
            left: `${b.x}%`, top: `${b.y}%`,
            boxShadow: `0 0 8px ${b.friendly ? '#67e8f9' : '#ef4444'}`,
            animation: 'pulseGlow 2s ease-in-out infinite',
          }} />
      ))}

      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-300" style={{ boxShadow: '0 0 12px #22d3ee' }} />
    </div>
  )
}
