import { useState } from 'react'
import { computeStats } from '../utils/calculations'

// Date string for the Sunday that ended the last fully-completed calendar week.
function lastCompletedSunday() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1)
  return lastSun.toISOString().split('T')[0]
}

// Re-derives each participant's rank as of last Sunday by truncating their
// logs to that date and recomputing the same metric — no extra storage needed,
// it's fully derivable from history. Returns { [participantId]: rankNumber }.
// Participants with zero logs by that date are left out (no "last week" rank).
function lastWeekRanks(allStats, metric) {
  const cutoff = lastCompletedSunday()
  const snapshots = allStats.map(s => {
    const truncated = s.logs.filter(l => l.date <= cutoff)
    if (truncated.length === 0) return { id: s.participant.id, value: null }
    const snap = computeStats(s.participant, truncated)
    return { id: s.participant.id, value: metric === 'lost' ? snap.pctLost : snap.pctToGoal }
  })
  const ranked = snapshots.filter(s => s.value != null).sort((a, b) => b.value - a.value)
  const map = {}
  ranked.forEach((s, i) => { map[s.id] = i + 1 })
  return map
}

function Chip({ tone, children }) {
  const tones = {
    pr:     'text-amber-300 bg-amber-400/10 border-amber-400/30',
    streak: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    log:    'text-sky-300 bg-sky-500/10 border-sky-500/30',
    logRisk:'text-amber-300 bg-amber-500/10 border-amber-500/30',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function Leaderboard({ allStats, prByParticipant }) {
  const [metric, setMetric] = useState(() => {
    try { return localStorage.getItem('leaderboardMetric') || 'goal' } catch (e) { return 'goal' }
  })
  const setAndSaveMetric = (m) => {
    setMetric(m)
    try { localStorage.setItem('leaderboardMetric', m) } catch (e) {}
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const rows = [...allStats].sort((a, b) => {
    const av = metric === 'lost' ? (a.pctLost ?? 0) : (a.pctToGoal ?? 0)
    const bv = metric === 'lost' ? (b.pctLost ?? 0) : (b.pctToGoal ?? 0)
    return bv - av
  })

  const lastWeekMap = lastWeekRanks(allStats, metric)

  const totalWeighIns = allStats.reduce((s, st) => s + st.weighIns, 0)
  const totalLost = allStats.reduce((s, st) => s + Math.max(0, st.lost ?? 0), 0)

  const medal = (i) => i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">🏆 Leaderboard</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {metric === 'lost' ? 'Ranked by lifetime % lost' : 'Ranked by % to goal — fair across different starting weights'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-full p-0.5 flex text-[10px] uppercase tracking-wider font-bold shrink-0">
          <button
            onClick={() => setAndSaveMetric('goal')}
            className={`px-2.5 py-1 rounded-full transition-colors ${metric === 'goal' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Goal
          </button>
          <button
            onClick={() => setAndSaveMetric('lost')}
            className={`px-2.5 py-1 rounded-full transition-colors ${metric === 'lost' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Lost
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        {rows.map((s, i) => {
          const p = s.participant
          const isLead = i === 0
          const value = metric === 'lost' ? (s.pctLost ?? 0) : (s.pctToGoal ?? 0)
          const pct = Math.round(Math.max(0, value) * 100)
          const loggedToday = s.logs.some(l => l.date === today)
          const missingToday = s.logs.length > 0 && !loggedToday
          const pr = prByParticipant[p.id]

          // Daily delta: current vs the log immediately before it (most recent change)
          const lastTwo = s.logs.slice(-2)
          const dailyDelta = lastTwo.length === 2 ? lastTwo[1].weight - lastTwo[0].weight : null

          // Rank movement vs last completed week
          const lastRank = lastWeekMap[p.id]
          const thisRank = i + 1
          const movement = lastRank != null ? lastRank - thisRank : null // positive = moved up

          return (
            <div
              key={p.id}
              className={`relative flex items-center gap-3 px-4 ${isLead ? 'py-4 bg-gradient-to-r from-amber-300/10 to-transparent' : 'py-3 border-t border-slate-800/60'}`}
            >
              {isLead && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-300" />}

              <div className={`shrink-0 text-center font-extrabold text-slate-400 tabular-nums ${isLead ? 'w-7 text-xl' : 'w-5 text-sm'}`}>
                {medal(i)}
              </div>

              <div className="relative shrink-0">
                <div
                  className={`rounded-full flex items-center justify-center font-black ${isLead ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'}`}
                  style={{ backgroundColor: p.color + '2e', color: p.color }}
                >
                  {p.initials}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${loggedToday ? 'bg-emerald-400' : 'bg-slate-600 opacity-70'}`}
                  title={loggedToday ? 'Logged today' : (s.daysSinceLastLog > 1 ? `Hasn't logged in ${s.daysSinceLastLog} days` : "Hasn't logged today")}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 flex-wrap font-bold text-slate-100 ${isLead ? 'text-[15px]' : 'text-[13px]'}`}>
                  <span>{p.name}</span>
                  {pr && <Chip tone="pr">🏆 PR</Chip>}
                  {s.streak >= 1 && <Chip tone="streak">🔥 {s.streak}w</Chip>}
                  {s.logStreak >= 2 && (
                    <Chip tone={s.logStreakAtRisk ? 'logRisk' : 'log'}>🗓️ {s.logStreak}d{s.logStreakAtRisk ? '!' : ''}</Chip>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{s.current != null ? `${s.current.toFixed(1)} lbs` : '—'}</span>
                  {dailyDelta != null && Math.abs(dailyDelta) >= 0.05 && (
                    <span className={dailyDelta < 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {dailyDelta < 0 ? '▼' : '▲'}{Math.abs(dailyDelta).toFixed(1)} last log
                    </span>
                  )}
                  {missingToday && s.daysSinceLastLog > 1 && (
                    <span className="text-slate-600 italic">· {s.daysSinceLastLog}d since log</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 min-w-[52px]">
                <div className={`font-extrabold tabular-nums ${isLead ? 'text-2xl' : 'text-lg'}`} style={{ color: p.color }}>
                  {pct}%
                </div>
                <div className="text-[8px] uppercase tracking-wide text-slate-500">
                  {metric === 'lost' ? 'lost' : 'to goal'}
                </div>
                {movement != null && movement !== 0 && (
                  <div className={`text-[10px] font-bold tabular-nums mt-0.5 ${movement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {movement > 0 ? '▲' : '▼'}{Math.abs(movement)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
        <span>Together: <span className="font-bold text-slate-200 tabular-nums">{totalLost.toFixed(1)} lbs</span> lost</span>
        <span><span className="font-bold text-slate-200 tabular-nums">{totalWeighIns}</span> weigh-ins logged</span>
      </div>
    </div>
  )
}
