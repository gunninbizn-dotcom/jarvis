'use client'

import { useMemo } from 'react'

export default function MiniCalendar() {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  const { days, monthName, firstDow, totalDays } = useMemo(() => {
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    return {
      days: last.getDate(),
      monthName: first.toLocaleString('en-US', { month: 'long' }).toUpperCase(),
      firstDow: first.getDay(),
      totalDays: last.getDate(),
    }
  }, [y, m])

  // Deterministic "events" so it doesn't jump
  const events = useMemo(() => {
    const list = []
    const seed = y * 100 + m
    for (let i = 0; i < 4; i++) {
      const day = ((seed * (i + 7)) % totalDays) + 1
      list.push(day)
    }
    return list
  }, [y, m, totalDays])

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let i = 1; i <= days; i++) cells.push(i)

  const dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-cyan-300 text-glow-sm tracking-widest text-sm">{monthName}</span>
        <span className="text-[10px] text-cyan-500 tracking-widest">{y}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dowLabels.map((l, i) => (
          <div key={i} className="text-[9px] uppercase tracking-widest text-cyan-600">{l}</div>
        ))}
        {cells.map((n, i) => {
          const isToday = n === d
          const hasEvent = n && events.includes(n)
          return (
            <div key={i} className={`aspect-square flex items-center justify-center text-[10px] rounded-sm relative
              ${!n ? '' : isToday ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-100 text-glow-sm font-bold'
                : 'text-cyan-400/80 hover:bg-cyan-500/10'}
            `}>
              {n || ''}
              {hasEvent && !isToday && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400" style={{ boxShadow: '0 0 4px #fbbf24' }} />
              )}
            </div>
          )
        })}
      </div>
      <div className="pt-1 border-t border-cyan-500/20">
        <div className="text-[9px] uppercase tracking-widest text-cyan-600 mb-1">Upcoming Directives</div>
        <ul className="space-y-0.5 text-[10px] text-cyan-300">
          <li className="flex justify-between"><span>Board Briefing</span><span className="text-cyan-500">15:00</span></li>
          <li className="flex justify-between"><span>Suit Diagnostic</span><span className="text-cyan-500">17:30</span></li>
          <li className="flex justify-between"><span>Pepper · Dinner</span><span className="text-amber-400">20:00</span></li>
        </ul>
      </div>
    </div>
  )
}
