'use client'

import { useEffect, useState } from 'react'

export default function Waveform({ active = false }) {
  const [bars, setBars] = useState(Array(48).fill(0.1))

  useEffect(() => {
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => {
        const base = active ? 0.4 + Math.random() * 0.6 : 0.05 + Math.random() * 0.15
        return base
      }))
    }, active ? 80 : 200)
    return () => clearInterval(interval)
  }, [active])

  return (
    <div className="flex items-center justify-center gap-[2px] h-16 w-full">
      {bars.map((v, i) => (
        <div key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${v * 100}%`,
            background: `linear-gradient(to top, #0891b2, #22d3ee, #67e8f9)`,
            boxShadow: '0 0 6px #22d3ee',
            transition: 'height 80ms ease-out',
          }} />
      ))}
    </div>
  )
}
