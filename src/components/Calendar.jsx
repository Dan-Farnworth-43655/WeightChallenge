import { useState } from 'react'

// Personal logging calendar — month grid showing logged / missed / future / pre-start days.
// Don't break the chain energy: visually addictive to keep the row of green.
export default function Calendar({ participant, stats }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  // Build lookup of logged weight + delta-vs-previous by date.
  // delta is positive = gained, negative = lost, 0 = flat. null = first log (no prior).
  const sortedLogs = [...(stats?.logs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const loggedByDate = {}
  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i]
    const prev = i > 0 ? sortedLogs[i - 1] : null
    const delta = prev ? log.weight - prev.weight : null
    loggedByDate[log.date] = { weight: log.weight, delta }
  }

  // First log date — anything before this is "pre-start", dimmed not punished
  const firstLogDate = sortedLogs.length > 0 ? sortedLogs[0].date : null

  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay   = new Date(year, month, 1)
  const lastDay    = new Date(year, month + 1, 0)
  const startDow   = firstDay.getDay() // 0 = Sun
  const daysInMonth = lastDay.getDate()
  const monthStr   = String(month + 1).padStart(2, '0')

  // Cells: leading nulls then day objects
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${monthStr}-${dd}`
    const dt = new Date(year, month, d)
    dt.setHours(0, 0, 0, 0)
    const entry = loggedByDate[dateStr]
    cells.push({
      day: d,
      dateStr,
      isToday:       dt.getTime() === today.getTime(),
      isFuture:      dt.getTime() > today.getTime(),
      isBeforeFirst: !!firstLogDate && dateStr < firstLogDate,
      weight:        entry?.weight ?? null,
      delta:         entry?.delta ?? null,
    })
  }

  const monthLogs = (stats?.logs ?? []).filter(l => l.date.startsWith(`${year}-${monthStr}`))
  const monthCount = monthLogs.length

  // Month nav
  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1))
  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: participant.color + '33', color: participant.color }}
          >
            {participant.initials}
          </span>
          <h2 className="font-semibold">{participant.name}'s Calendar</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>🗓️ <span className="text-white font-semibold tabular-nums">{monthCount}</span> logged in {viewMonth.toLocaleDateString('en-US', { month: 'short' })}</span>
          {stats?.logStreak >= 2 && (
            <span className={stats.logStreakAtRisk ? 'text-amber-300' : 'text-sky-300'}>
              🔥 <span className="font-semibold tabular-nums">{stats.logStreak}</span>-day streak{stats.logStreakAtRisk ? ' (at risk!)' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
          aria-label="Previous month"
        >
          ◀
        </button>
        <h3 className="text-base font-bold">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      {/* Day of week labels */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wider text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          // Future or pre-start days: just the day number, dimmed
          if (c.isFuture || c.isBeforeFirst) {
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs text-slate-700 ${c.isToday ? 'ring-2 ring-white/60' : ''}`}
              >
                {c.day}
              </div>
            )
          }
          // Logged day: colored by delta vs previous log (green = lost, red = gained, neutral = flat / first log)
          if (c.weight != null) {
            const lost     = c.delta != null && c.delta < 0
            const gained   = c.delta != null && c.delta > 0
            const flat     = c.delta != null && c.delta === 0
            const baseline = c.delta == null // first ever log
            // Tailwind colors:
            //   emerald = lost / first log baseline (neutral-positive)
            //   red     = gained
            //   slate   = exactly flat
            const cls = gained
              ? 'bg-red-500/25 border-red-500/70 text-red-200'
              : lost
                ? 'bg-emerald-500/25 border-emerald-500/70 text-emerald-200'
                : flat
                  ? 'bg-slate-700/40 border-slate-500/70 text-slate-200'
                  : 'bg-sky-500/20 border-sky-400/60 text-sky-200' // baseline / first log
            const deltaLabel = c.delta == null
              ? 'first log'
              : c.delta === 0
                ? 'flat'
                : `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)}`
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center border ${cls} ${c.isToday ? 'ring-2 ring-white' : ''}`}
                title={`${c.dateStr}: ${c.weight} lbs (${deltaLabel})`}
              >
                <span className="text-[11px] font-bold leading-none">{c.day}</span>
                <span className="text-[9px] tabular-nums mt-0.5">{c.weight}</span>
              </div>
            )
          }
          // Missed: past day with no log
          return (
            <div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs text-slate-500 bg-slate-900 border border-red-500/20 ${c.isToday ? 'ring-2 ring-white' : ''}`}
              title="Missed"
            >
              {c.day}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500/25 border border-emerald-500/70" />
          <span>Lost</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/25 border border-red-500/70" />
          <span>Gained</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-700/40 border border-slate-500/70" />
          <span>Flat</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-900 border border-red-500/20" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-white" />
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
