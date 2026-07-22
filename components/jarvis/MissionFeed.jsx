'use client'

import { useEffect, useState } from 'react'

const SEED_FEED = [
  { tag: 'INTEL', msg: 'HYDRA cell dispersed near Sokovia. Coordinates locked.', level: 'amber' },
  { tag: 'NEWS',  msg: 'Stark Industries Q3 earnings exceed projections by 22.4%.', level: 'cyan' },
  { tag: 'ALERT', msg: 'Unidentified aircraft breached exclusion zone — P-13.', level: 'red' },
  { tag: 'SAT',   msg: 'Satellite VII realigned to sector 4-Delta.', level: 'cyan' },
  { tag: 'CIV',   msg: 'Malibu perimeter secure. Housekeeping cycle complete.', level: 'green' },
  { tag: 'INTEL', msg: 'Encrypted transmission intercepted — decryption in progress.', level: 'amber' },
  { tag: 'RD',    msg: 'Nano-material composite lab test successful.', level: 'cyan' },
  { tag: 'MIL',   msg: 'S.H.I.E.L.D. requests conference call at 21:00.', level: 'cyan' },
  { tag: 'ENG',   msg: 'Mark XLIII repair sequence complete. Ready for deployment.', level: 'green' },
  { tag: 'ALERT', msg: 'Solar flare inbound. Communications may degrade briefly.', level: 'red' },
  { tag: 'MED',   msg: 'Palladium blood level: 3.2%, within safe threshold.', level: 'green' },
  { tag: 'INTEL', msg: 'Tracking anomalous energy signature — Antarctica.', level: 'amber' },
]

const COLORS = {
  cyan: 'text-cyan-400 border-cyan-500/50',
  green: 'text-emerald-400 border-emerald-500/50',
  amber: 'text-amber-400 border-amber-500/50',
  red: 'text-red-400 border-red-500/50',
}

function randomTime() {
  const h = String(Math.floor(Math.random() * 24)).padStart(2, '0')
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0')
  return `${h}:${m}`
}

export default function MissionFeed() {
  const [items, setItems] = useState(() =>
    SEED_FEED.slice(0, 5).map(f => ({ ...f, time: randomTime(), id: Math.random() }))
  )

  useEffect(() => {
    const i = setInterval(() => {
      const f = SEED_FEED[Math.floor(Math.random() * SEED_FEED.length)]
      setItems(prev => [{ ...f, time: randomTime(), id: Math.random() }, ...prev].slice(0, 6))
    }, 4500)
    return () => clearInterval(i)
  }, [])

  return (
    <ul className="space-y-1.5 text-[11px] max-h-[220px] overflow-hidden">
      {items.map(it => (
        <li key={it.id} className={`border-l-2 pl-2 py-0.5 ${COLORS[it.level]}`}
          style={{ animation: 'fadeIn 0.6s ease' }}>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest opacity-80">
            <span className="font-display">{it.tag}</span>
            <span className="text-cyan-600">|</span>
            <span>{it.time}</span>
          </div>
          <div className="text-cyan-200 text-[11px] leading-snug">{it.msg}</div>
        </li>
      ))}
    </ul>
  )
}
