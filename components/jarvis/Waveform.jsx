'use client'

const BAR_COUNT = 48

export default function Waveform({ active = false }) {
  const bars = Array.from({ length: BAR_COUNT }, (_, index) => ({
    delay: (index % 6) * 0.08 + (index * 0.02),
  }))

  return (
    <div className="waveform-container flex items-center justify-center gap-[2px] h-16 w-full">
      {bars.map((bar, i) => (
        <div key={i}
          className="waveform-bar w-1 rounded-sm"
          style={{
            animationDuration: active ? '0.8s' : '1.6s',
            animationDelay: `${bar.delay}s`,
          }} />
      ))}
    </div>
  )
}
