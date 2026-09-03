import { useState } from 'react'
import { computeStats, formatDate } from '../utils/calculations'

// Each person's next checkpoint: their next un-hit milestone, or their final
// goal once milestones run out. Read live off computeStats (which already
// folds in Redis goal-editor overrides) so this never goes stale the way a
// hardcoded snapshot would the moment someone edits their own milestone.
function nextCheckpoint(s) {
  if (s.nextMilestone) return { weight: s.nextMilestone.weight, date: s.nextMilestone.date }
  if (s.goal != null) return { weight: s.goal, date: s.goalDate }
  return null
}

// Each person's existing next goal is the finish, and 8 lbs above that goal is
// the starting gate. Placement never depends on the last-place racer.
const RACE_DISTANCE_LBS = 8

function checkpointProgress(s) {
  const cp = nextCheckpoint(s)
  if (!cp || s.current == null) return null
  const remaining = Math.max(0, s.current - cp.weight)
  const pct = Math.max(0, Math.min(1, 1 - remaining / RACE_DISTANCE_LBS))
  return { remaining, target: cp.weight, pct }
}

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
    let value
    if (metric === 'lost') value = snap.pctLost
    else if (metric === 'nextgoal') {
      const cp = nextCheckpoint(snap)
      value = (cp != null && snap.current != null) ? cp.weight - snap.current : null
    } else value = snap.pctToGoal
    return { id: s.participant.id, value }
  })
  const ranked = snapshots.filter(s => s.value != null).sort((a, b) => b.value - a.value)
  const map = {}
  ranked.forEach((s, i) => { map[s.id] = i + 1 })
  return map
}

// Missing 2+ days in a row sinks a person to the bottom of the leaderboard,
// below every active logger, regardless of how good their metric looks.
// Keeps someone from coasting at #1 on stale data.
const STALE_DAYS = 2
function isStale(s) {
  return (s.daysSinceLastLog ?? 0) >= STALE_DAYS
}

function Chip({ tone, children }) {
  const tones = {
    pr:     'text-amber-300 bg-amber-400/10 border-amber-400/30',
    streak: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    log:    'text-sky-300 bg-sky-500/10 border-sky-500/30',
    logRisk:'text-amber-300 bg-amber-500/10 border-amber-500/30',
    stale:  'text-red-300 bg-red-500/10 border-red-500/30',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  )
}

// Bump this to reset everyone's saved tab back to the current default — people
// who already had a preference stored from before "Next Goal" existed would
// otherwise never see the new default, since it only fills in when nothing's saved.
const METRIC_DEFAULT_VERSION = '2'

export default function Leaderboard({ allStats, prByParticipant }) {
  const [metric, setMetric] = useState(() => {
    try {
      if (localStorage.getItem('leaderboardMetricVersion') !== METRIC_DEFAULT_VERSION) return 'nextgoal'
      return localStorage.getItem('leaderboardMetric') || 'nextgoal'
    } catch (e) { return 'nextgoal' }
  })
  const setAndSaveMetric = (m) => {
    setMetric(m)
    try {
      localStorage.setItem('leaderboardMetric', m)
      localStorage.setItem('leaderboardMetricVersion', METRIC_DEFAULT_VERSION)
    } catch (e) {}
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  // Rank value where HIGHER always means better placement, regardless of metric:
  // % metrics are already higher-is-better; for the lbs-to-next-goal checkpoint,
  // "target minus current" turns being under the target weight into a positive value.
  const rankValue = (s) => {
    if (metric === 'lost') return s.pctLost ?? 0
    if (metric === 'nextgoal') {
      const cp = nextCheckpoint(s)
      return (cp != null && s.current != null) ? cp.weight - s.current : -Infinity
    }
    return s.pctToGoal ?? 0
  }

  const rows = [...allStats].sort((a, b) => {
    const aStale = isStale(a), bStale = isStale(b)
    if (aStale !== bStale) return aStale ? 1 : -1 // stale always sinks below active loggers
    return rankValue(b) - rankValue(a)
  })

  const lastWeekMap = lastWeekRanks(allStats, metric)

  const totalWeighIns = allStats.reduce((s, st) => s + st.weighIns, 0)
  const totalLost = allStats.reduce((s, st) => s + Math.max(0, st.lost ?? 0), 0)

  const medal = (i, stale) => stale ? '😴' : i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">🏆 Leaderboard</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {metric === 'lost'
              ? 'Ranked by lifetime % lost'
              : metric === 'nextgoal'
                ? "Ranked by lbs from each person's next milestone"
                : 'Ranked by % to goal — fair across different starting weights'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-full p-0.5 flex text-[10px] uppercase tracking-wider font-bold shrink-0">
          <button
            onClick={() => setAndSaveMetric('nextgoal')}
            className={`px-2.5 py-1 rounded-full transition-colors ${metric === 'nextgoal' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Next Goal
          </button>
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

      {/* Horse race — each finish is the person's next goal; the course starts
          8 lbs above it so everyone is measured on the same scale. */}
      {(() => {
        const races = allStats
          .map(s => ({ s, race: checkpointProgress(s) }))
          .filter(r => r.race != null)
        return (
          <div className="px-4 pt-3 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <span>🏁</span> Race to the Next Goal
              </h3>
              <span className="text-[9px] uppercase tracking-wider text-slate-500">Closest to target wins</span>
            </div>
            <div className="space-y-1.5">
              {races.map(({ s, race }) => {
                const hasWon = race.remaining <= 0
                return (
                  <div
                    key={s.participant.id}
                    className="flex items-center gap-2"
                    title={`${s.participant.name}: ${hasWon ? 'goal hit!' : `${race.remaining.toFixed(1)} lbs to go`}`}
                  >
                    <span
                      className="w-10 shrink-0 truncate text-[10px] font-bold text-right"
                      style={{ color: s.participant.color }}
                    >
                      {s.participant.name}
                    </span>
                    <div className="relative h-8 flex-1 rounded-full border border-slate-700 bg-slate-800/80 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full opacity-20 transition-all duration-500"
                        style={{ width: `${race.pct * 100}%`, backgroundColor: s.participant.color }}
                      />
                      {[25, 50, 75].map(mark => (
                        <span
                          key={mark}
                          className="absolute inset-y-1 border-l border-dashed border-slate-600/60"
                          style={{ left: `${mark}%` }}
                        />
                      ))}
                      <div className="absolute inset-y-0 right-0 w-3 border-l border-white/30 bg-[repeating-conic-gradient(#fff_0_25%,#334155_0_50%)] bg-[length:8px_8px] opacity-70" />
                      <div
                        className="absolute top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/80 text-xs shadow-lg transition-all duration-500"
                        style={{ left: `calc(${race.pct * 100}% - ${race.pct * 24}px)`, backgroundColor: s.participant.color }}
                      >
                        {hasWon ? '👑' : <span className="inline-block -scale-x-100">🐎</span>}
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right text-[9px] tabular-nums text-slate-500">
                      {hasWon ? 'Finished' : `${race.remaining.toFixed(1)} left`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="flex flex-col">
        {rows.map((s, i) => {
          const p = s.participant
          const stale = isStale(s)
          const isLead = i === 0 && !stale
          const checkpoint = nextCheckpoint(s)
          const nextGoalTarget = checkpoint?.weight ?? null
          const nextGoalRemaining = (nextGoalTarget != null && s.current != null) ? s.current - nextGoalTarget : null

          // Where the 21-day trend (same regression powering the trend chart) says
          // they'll actually be on the checkpoint date, not just where they are today.
          let projectedNextGoal = null
          if (s.regressionPace != null && s.current != null && s.logs.length > 0 && checkpoint?.date) {
            const windowLast = new Date(s.logs[s.logs.length - 1].date + 'T00:00:00')
            const daysToNextGoal = (checkpoint.date - windowLast) / 86400000
            projectedNextGoal = parseFloat((s.current - s.regressionPace * daysToNextGoal).toFixed(1))
          }
          const value = metric === 'lost' ? (s.pctLost ?? 0) : (s.pctToGoal ?? 0)
          const pct = Math.round(Math.max(0, value) * 100)
          const loggedToday = s.logs.some(l => l.date === today)
          const missingToday = s.logs.length > 0 && !loggedToday
          const pr = prByParticipant[p.id]

          // Daily delta: current vs the log immediately before it (most recent change)
          const lastTwo = s.logs.slice(-2)
          const dailyDelta = lastTwo.length === 2 ? lastTwo[1].weight - lastTwo[0].weight : null

          // Rank movement vs last completed week — suppressed for stale rows since
          // their position is driven by staleness, not real metric movement.
          const lastRank = lastWeekMap[p.id]
          const thisRank = i + 1
          const movement = (!stale && lastRank != null) ? lastRank - thisRank : null // positive = moved up

          return (
            <div
              key={p.id}
              className={`relative flex items-center gap-3 px-4 ${isLead ? 'py-4 bg-gradient-to-r from-amber-300/10 to-transparent' : 'py-3 border-t border-slate-800/60'} ${stale ? 'opacity-60' : ''}`}
            >
              {isLead && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-300" />}

              <div className={`shrink-0 text-center font-extrabold text-slate-400 tabular-nums ${isLead ? 'w-7 text-xl' : 'w-5 text-sm'}`}>
                {medal(i, stale)}
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
                  {stale ? (
                    <Chip tone="stale">😴 {s.daysSinceLastLog}d since log</Chip>
                  ) : (
                    <>
                      {pr && <Chip tone="pr">🏆 PR</Chip>}
                      {s.streak >= 1 && <Chip tone="streak">🔥 {s.streak}w</Chip>}
                      {s.logStreak >= 2 && (
                        <Chip tone={s.logStreakAtRisk ? 'logRisk' : 'log'}>🗓️ {s.logStreak}d{s.logStreakAtRisk ? '!' : ''}</Chip>
                      )}
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{s.current != null ? `${s.current.toFixed(1)} lbs` : '—'}</span>
                  {dailyDelta != null && Math.abs(dailyDelta) >= 0.05 && (
                    <span className={dailyDelta < 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {dailyDelta < 0 ? '▼' : '▲'}{Math.abs(dailyDelta).toFixed(1)} last log
                    </span>
                  )}
                </div>
                {projectedNextGoal != null && (
                  <div className={`text-[9px] tabular-nums mt-0.5 ${nextGoalTarget != null && projectedNextGoal <= nextGoalTarget ? 'text-emerald-500/80' : 'text-slate-600'}`}>
                    trending to {projectedNextGoal.toFixed(1)} lbs by {formatDate(checkpoint.date)}
                  </div>
                )}
              </div>

              <div className="text-right shrink-0 min-w-[52px]">
                {metric === 'nextgoal' ? (
                  <>
                    <div className={`font-extrabold tabular-nums ${isLead ? 'text-2xl' : 'text-lg'}`} style={{ color: p.color }}>
                      {nextGoalRemaining == null ? '—' : nextGoalRemaining <= 0 ? '✓' : nextGoalRemaining.toFixed(1)}
                    </div>
                    <div className="text-[8px] uppercase tracking-wide text-slate-500">
                      {nextGoalRemaining != null && nextGoalRemaining <= 0 ? 'goal hit' : 'lbs to go'}
                    </div>
                    {checkpoint?.date && (
                      <div className="text-[8px] text-slate-600">by {formatDate(checkpoint.date)}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={`font-extrabold tabular-nums ${isLead ? 'text-2xl' : 'text-lg'}`} style={{ color: p.color }}>
                      {pct}%
                    </div>
                    <div className="text-[8px] uppercase tracking-wide text-slate-500">
                      {metric === 'lost' ? 'lost' : 'to goal'}
                    </div>
                  </>
                )}
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
