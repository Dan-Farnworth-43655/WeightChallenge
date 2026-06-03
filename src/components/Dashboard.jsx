import { useState } from 'react'
import { formatDate, formatLongDate, formatProjectedFinish, todayStr, PARTICIPANTS } from '../utils/calculations'
import WeightChart from './WeightChart'
import PctLostChart from './PctLostChart'
import LbsLostChart from './LbsLostChart'
import RegressionChart from './RegressionChart'

function Verse({ reference, text }) {
  return (
    <div className="text-center px-4 py-1">
      <p className="text-xs text-slate-500 italic">"{text}"</p>
      <p className="text-xs text-slate-600 mt-0.5">{reference}</p>
    </div>
  )
}

function ProgressBar({ pct, color }) {
  const clamped = Math.min(1, Math.max(0, pct))
  return (
    <div className="relative w-full bg-slate-800 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${clamped * 100}%`, backgroundColor: color }}
      />
    </div>
  )
}

function MilestoneList({ milestones, color, goal, goalDate, goalHit, goalRemaining, daysToGoalDate }) {
  // Build combined list = milestones + goal as final entry
  const items = [...(milestones ?? [])]
  if (goal != null) {
    items.push({
      weight: goal,
      date: goalDate,
      dateStr: goalDate ? goalDate.toISOString().split('T')[0] : null,
      hit: goalHit,
      hitDate: null,
      daysToTarget: daysToGoalDate,
      remaining: goalRemaining,
      isGoal: true,
    })
  }
  if (!items.length) return null

  // Find index of next un-hit item
  const nextIdx = items.findIndex(m => !m.hit)

  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Milestones</p>
      <div className="flex flex-col gap-1.5">
        {items.map((m, i) => {
          const isNext = i === nextIdx
          return (
            <div
              key={i}
              className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 ${
                m.hit
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : m.isGoal
                    ? `bg-amber-500/10 border ${isNext ? 'border-amber-400/70' : 'border-amber-500/30'}`
                    : isNext
                      ? 'bg-slate-800 border border-slate-600'
                      : 'bg-slate-800/50 border border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-base leading-none ${
                  m.hit ? 'text-emerald-400' : m.isGoal ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {m.hit ? '✓' : m.isGoal ? '🎯' : '○'}
                </span>
                <span className={`font-bold tabular-nums ${
                  m.hit ? 'text-emerald-300 line-through opacity-75'
                       : m.isGoal ? 'text-amber-200' : 'text-white'
                }`}>
                  {m.weight} lbs
                </span>
                {m.date && (
                  <span className={m.isGoal ? 'text-amber-400/80' : 'text-slate-500'}>
                    by {formatDate(m.dateStr)}
                  </span>
                )}
                {m.isGoal && !m.hit && (
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded text-amber-300 bg-amber-500/20">
                    Final Goal
                  </span>
                )}
                {!m.isGoal && isNext && (
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '22' }}>
                    Next
                  </span>
                )}
              </div>
              {m.hit && m.hitDate && (
                <span className="text-[10px] text-emerald-400/80">hit {formatDate(m.hitDate)}</span>
              )}
              {!m.hit && isNext && m.remaining != null && (
                <span className={`text-[10px] tabular-nums ${m.isGoal ? 'text-amber-300' : 'text-slate-400'}`}>
                  {m.remaining.toFixed(1)} to go{m.daysToTarget != null ? ` · ${m.daysToTarget}d` : ''}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ stats }) {
  const {
    participant: p, current, goal, goalDate, goalHit, lost, pctLost, remaining, pctToGoal,
    daysToGoalDate, paceNeeded, milestones, pace, projectedFinish, projectedGoalDateWeight,
    weighIns, streak, logStreak, logStreakAtRisk,
  } = stats
  const isGaining = lost < 0

  return (
    <div className="rounded-2xl p-4 border border-slate-800 bg-slate-900">
      {/* Name + streak */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: p.color + '33', color: p.color }}
          >
            {p.initials}
          </span>
          <span className="font-semibold">{p.name}</span>
          {logStreak >= 2 && (
            <span
              className={`text-xs font-bold rounded-full px-2 py-0.5 border ${
                logStreakAtRisk
                  ? 'text-amber-300 bg-amber-500/10 border-amber-500/40'
                  : 'text-sky-300 bg-sky-500/10 border-sky-500/30'
              }`}
              title={logStreakAtRisk ? 'Log today to save your streak!' : 'Consecutive days logged'}
            >
              🗓️ {logStreak}{logStreakAtRisk ? '!' : ''}
            </span>
          )}
          {streak >= 2 && (
            <span className="text-xs font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5" title={`${streak}-week loss streak (weekly average down)`}>
              🔥 {streak}wk
            </span>
          )}
        </div>
        {goalHit && (
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded-full px-2 py-0.5">
            ✓ AT GOAL
          </span>
        )}
      </div>

      {/* Goal progress */}
      {goal != null && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Goal progress</span>
            <span style={{ color: isGaining ? '#f87171' : p.color }}>
              {Math.round(pctToGoal * 100)}%
            </span>
          </div>
          <ProgressBar pct={pctToGoal} color={p.color} />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{current?.toFixed(1)} lbs</span>
            <span>Goal: {goal.toFixed(1)} lbs</span>
          </div>
        </div>
      )}

      {/* Goal date + pace summary */}
      {goalDate && !goalHit && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-800 px-3 py-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400">Goal by</div>
              <div className="font-bold text-white">{formatLongDate(goalDate)}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Days left</div>
              <div className="font-bold text-white tabular-nums">{daysToGoalDate ?? '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Pace needed</div>
              <div className="font-bold tabular-nums" style={{ color: p.color }}>
                {paceNeeded > 0 ? `${paceNeeded.toFixed(2)}/day` : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">Lost</div>
          <div className={`font-bold text-sm ${isGaining ? 'text-red-400' : 'text-white'}`}>
            {isGaining ? '+' : ''}{Math.abs(lost).toFixed(1)} lbs
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">% lost</div>
          <div className={`font-bold text-sm ${isGaining ? 'text-red-400' : 'text-emerald-400'}`}>
            {isGaining ? '+' : ''}{(pctLost * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">Pace</div>
          <div className="font-bold text-sm">{pace !== null ? `${pace.toFixed(2)}/day` : '—'}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">Remaining</div>
          <div className="font-bold text-sm">
            {goalHit ? '✓' : remaining != null ? `${remaining.toFixed(1)} lbs` : '—'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">Weigh-ins</div>
          <div className="font-bold text-sm">{weighIns}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <div className="text-xs text-slate-400">Forecast</div>
          <div className="font-bold text-sm">{formatProjectedFinish(projectedFinish)}</div>
        </div>
      </div>

      {/* Milestones + final goal */}
      <MilestoneList
        milestones={milestones}
        color={p.color}
        goal={goal}
        goalDate={goalDate}
        goalHit={goalHit}
        goalRemaining={remaining}
        daysToGoalDate={daysToGoalDate}
      />
    </div>
  )
}

function StatCardWithRegression({ stats }) {
  return (
    <div className="flex flex-col gap-2">
      <StatCard stats={stats} />
      {stats.regressionData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-3">21-day regression trend</p>
          <RegressionChart
            regressionData={stats.regressionData}
            color={stats.participant.color}
            goal={stats.goal}
            startWeight={stats.effectiveStart}
            goalDate={stats.goalDate}
            milestones={stats.milestones}
          />
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ ranked, allStats, logs, prs = [], activeUser }) {
  const hasData = logs.length > 0
  const today = todayStr()
  const [moreChartsOpen, setMoreChartsOpen] = useState(false)

  // PRs set today (Central Time) — banner expires at midnight CT
  const recentPRs = prs.filter(pr => pr.date === today)
  const prByParticipant = Object.fromEntries(recentPRs.map(pr => [pr.participant, pr]))

  // Achievement banners: PR today, or active weekly streak of 2+ weeks
  // with a recent log (within the last 7 days — no stale weekly streaks)
  const banners = []
  for (const s of allStats) {
    const pr = prByParticipant[s.participant.id]
    const recentlyActive = s.daysSinceLastLog != null && s.daysSinceLastLog <= 7
    const hasStreak = s.streak >= 2 && recentlyActive
    if (pr || hasStreak) {
      banners.push({ participant: s.participant, pr, streak: hasStreak ? s.streak : 0 })
    }
  }

  // Split the active user out of the ranked list so they go first
  const myStats     = allStats.find(s => s.participant.id === activeUser)
  const myLoggedToday = !!myStats?.logs?.some(l => l.date === today)
  const otherStats  = ranked.filter(s => s.participant.id !== activeUser)

  return (
    <div className="px-4 py-4 flex flex-col gap-6">
      {/* Achievement banners — PRs and active loss streaks */}
      {banners.map(({ participant: p, pr, streak }) => {
        const both = pr && streak
        const icon = pr ? '🏆' : '🔥'
        const titleColor = pr ? 'text-amber-300' : 'text-orange-300'
        const borderColor = pr ? 'border-amber-500/40 bg-amber-500/10' : 'border-orange-500/40 bg-orange-500/10'
        return (
          <div key={p.id} className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${borderColor}`}>
            <span className="text-3xl">{icon}</span>
            <div className="flex-1">
              <p className={`text-sm font-bold ${titleColor}`}>
                {both ? 'New PR + Hot Streak!' : pr ? 'New Personal Record!' : `${streak}-Week Loss Streak! 🔥`}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                <span className="font-semibold" style={{ color: p.color }}>{p.name}</span>
                {pr && (
                  <>
                    {' '}hit a new low —{' '}
                    <span className="font-bold text-white">{Number(pr.weight).toFixed(1)} lbs</span>
                    {' '}on {formatDate(pr.date)}
                  </>
                )}
                {pr && streak && (
                  <>
                    {' '}·{' '}
                    <span className="font-bold text-orange-300">{streak} weeks</span> trending down 🔥
                  </>
                )}
                {!pr && streak > 0 && (
                  <>
                    {' '}is on a{' '}
                    <span className="font-bold text-orange-300">{streak}-week</span> downtrend. Don't break the chain! 🔥
                  </>
                )}
              </p>
            </div>
          </div>
        )
      })}

      {/* Group progress table — top of the dashboard, the accountability anchor */}
      {hasData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="font-semibold text-sm text-slate-300">Group Progress</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-center px-1 py-2" title="Consecutive days logged">🗓️</th>
                <th className="text-right px-2 py-2">Cur</th>
                <th className="text-right px-2 py-2">Goal</th>
                <th className="text-right px-2 py-2">To Go</th>
                <th className="text-right px-2 py-2">%</th>
                <th className="text-right px-3 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const loggedToday = s.logs.some(l => l.date === today)
                const missingToday = s.logs.length > 0 && !loggedToday
                return (
                  <tr
                    key={s.participant.id}
                    className={`border-t border-slate-800 ${missingToday ? 'outline outline-1 outline-red-500/40 bg-red-500/5' : ''}`}
                    title={missingToday ? (s.daysSinceLastLog > 1 ? `Hasn't logged in ${s.daysSinceLastLog} days` : "Hasn't logged today") : undefined}
                  >
                    <td className="px-3 py-3">
                      <span className="font-bold" style={{ color: s.participant.color }}>{s.participant.initials}</span>
                    </td>
                    <td className="text-center px-1 py-3 tabular-nums">
                      {s.logStreak >= 2 ? (
                        <span
                          className={`text-xs font-bold ${s.logStreakAtRisk ? 'text-amber-300' : 'text-sky-300'}`}
                          title={s.logStreakAtRisk ? 'Streak at risk — must log today!' : `${s.logStreak}-day logging streak`}
                        >
                          {s.logStreak}{s.logStreakAtRisk ? '!' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right px-2 py-3 text-slate-300 tabular-nums">{s.current?.toFixed(1) ?? '—'}</td>
                    <td className="text-right px-2 py-3 text-slate-400 tabular-nums">{s.goal?.toFixed(1) ?? '—'}</td>
                    <td className="text-right px-2 py-3 font-medium tabular-nums">
                      {s.goalHit ? <span className="text-emerald-400">✓</span> : s.remaining != null ? s.remaining.toFixed(1) : '—'}
                    </td>
                    <td className="text-right px-2 py-3 font-bold tabular-nums" style={{ color: s.participant.color }}>
                      {Math.round((s.pctToGoal ?? 0) * 100)}%
                    </td>
                    <td className="text-right px-3 py-3 text-xs text-slate-400">
                      {s.goalDate ? formatDate(s.goalDate.toISOString().split('T')[0]) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* "You haven't logged today" call-to-action */}
      {hasData && myStats && !myLoggedToday && (
        <div className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-300">
              {myStats.logStreakAtRisk
                ? `You haven't logged today — your ${myStats.logStreak}-day streak is on the line!`
                : "You haven't logged today."}
            </p>
            <p className="text-xs text-slate-300 mt-0.5">Tap "Log Weight" at the bottom to keep showing up.</p>
          </div>
        </div>
      )}

      {/* Your own card */}
      {hasData && myStats && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-slate-300">Your Progress</h2>
          <StatCardWithRegression stats={myStats} />
        </div>
      )}

      {/* Anchor verse — one well-placed reminder of why we're doing this */}
      {hasData && (
        <Verse
          reference="Ecclesiastes 4:9-10"
          text="Two are better than one... if either of them falls down, one can help the other up."
        />
      )}

      {/* Group weight trend chart — the one most useful group chart */}
      {hasData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <h2 className="font-semibold text-sm text-slate-300 mb-4">Weight Over Time</h2>
          <WeightChart logs={logs} participants={PARTICIPANTS} />
        </div>
      )}

      {/* Teammates' individual stat cards (active user excluded — already shown above) */}
      {hasData && otherStats.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-slate-300">Everyone Else</h2>
          {otherStats.map(stats => (
            <StatCardWithRegression key={stats.participant.id} stats={stats} />
          ))}
        </div>
      )}

      {/* Collapsible additional charts — less critical day-to-day */}
      {hasData && (
        <div>
          <button
            onClick={() => setMoreChartsOpen(o => !o)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300 px-1 py-2 transition-colors"
          >
            <span className="font-semibold">More charts</span>
            <span className="text-base">{moreChartsOpen ? '▾' : '▸'}</span>
          </button>
          {moreChartsOpen && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <h2 className="font-semibold text-sm text-slate-300 mb-4">Total Lbs Lost</h2>
                <LbsLostChart logs={logs} participants={PARTICIPANTS} />
              </div>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <h2 className="font-semibold text-sm text-slate-300 mb-4">Cumulative % Lost</h2>
                <PctLostChart logs={logs} participants={PARTICIPANTS} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
