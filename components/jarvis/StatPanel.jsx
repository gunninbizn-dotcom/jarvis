'use client'

export default function StatPanel({ label, value, unit, percent, color = 'cyan' }) {
  const colorMap = {
    cyan: { fg: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
    green: { fg: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
    amber: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
    red: { fg: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  }
  const c = colorMap[color] || colorMap.cyan

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-widest">
        <span className="text-cyan-500/80">{label}</span>
        <span className="font-display font-bold text-glow-sm" style={{ color: c.fg }}>
          {value}<span className="text-[9px] ml-0.5 opacity-70">{unit}</span>
        </span>
      </div>
      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(34,211,238,0.1)' }}>
        <div className="h-full transition-all duration-700 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: c.fg, boxShadow: `0 0 8px ${c.fg}` }} />
      </div>
    </div>
  )
}
