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

function MilestoneList({ milestones, color, currentWeight }) {
  if (!milestones?.length) return null
  // Find index of next un-hit milestone
  const nextIdx = milestones.findIndex(m => !m.hit)
  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Milestones</p>
      <div className="flex flex-col gap-1.5">
        {milestones.map((m, i) => {
          const isNext = i === nextIdx
          return (
            <div
              key={i}
              className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 ${
                m.hit
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : isNext
                    ? 'bg-slate-800 border border-slate-600'
                    : 'bg-slate-800/50 border border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-base leading-none ${m.hit ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {m.hit ? '✓' : '○'}
                </span>
                <span className={`font-bold tabular-nums ${m.hit ? 'text-emerald-300 line-through opacity-75' : 'text-white'}`}>
                  {m.weight} lbs
                </span>
                {m.date && (
                  <span className="text-slate-500">
                    by {formatDate(m.dateStr)}
                  </span>
                )}
                {isNext && (
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '22' }}>
                    Next
                  </span>
                )}
              </div>
              {m.hit && m.hitDate && (
                <span className="text-[10px] text-emerald-400/80">hit {formatDate(m.hitDate)}</span>
              )}
              {!m.hit && isNext && m.remaining != null && (
                <span className="text-[10px] text-slate-400 tabular-nums">
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
    weighIns, streak,
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
          {streak >= 2 && (
            <span className="text-xs font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5">
              🔥 {streak}
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

      {/* Milestones */}
      <MilestoneList milestones={milestones} color={p.color} currentWeight={current} />
    </div>
  )
}

export default function Dashboard({ ranked, allStats, logs, prs = [], activeUser }) {
  const hasData = logs.length > 0
  const today = todayStr()

  // PRs set today (Central Time) — banner expires at midnight CT
  const recentPRs = prs.filter(pr => pr.date === today)
  const prByParticipant = Object.fromEntries(recentPRs.map(pr => [pr.participant, pr]))

  // Achievement banners: PR today, or active streak of 2+ with a log today
  const banners = []
  for (const s of allStats) {
    const pr = prByParticipant[s.participant.id]
    const loggedToday = s.logs.some(l => l.date === today)
    const hasStreak = s.streak >= 2 && loggedToday
    if (pr || hasStreak) {
      banners.push({ participant: s.participant, pr, streak: hasStreak ? s.streak : 0 })
    }
  }

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
                {both ? 'New PR + Hot Streak!' : pr ? 'New Personal Record!' : `${streak}-Day Loss Streak! 🔥`}
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
                    <span className="font-bold text-orange-300">{streak} days</span> losing in a row 🔥
                  </>
                )}
                {!pr && streak > 0 && (
                  <>
                    {' '}is on a{' '}
                    <span className="font-bold text-orange-300">{streak}-day</span> loss streak. Don't break the chain! 🔥
                  </>
                )}
              </p>
            </div>
          </div>
        )
      })}

      {/* Group progress table — accountability view, not competition */}
      {hasData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="font-semibold text-sm text-slate-300">Group Progress</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-3 py-2">Name</th>
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
                    title={missingToday ? "Hasn't logged today" : undefined}
                  >
                    <td className="px-3 py-3">
                      <span className="font-bold" style={{ color: s.participant.color }}>{s.participant.initials}</span>
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

      {hasData && <Verse reference="Psalm 144:1" text="Praise be to the LORD my Rock, who trains my hands for war, my fingers for battle." />}

      {/* Weight trend chart */}
      {hasData && (
        <>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Weight Over Time</h2>
            <WeightChart logs={logs} participants={PARTICIPANTS} />
          </div>
          <Verse reference="Ecclesiastes 4:9-10" text="Two are better than one... if either of them falls down, one can help the other up." />
        </>
      )}

      {/* Lbs lost chart */}
      {hasData && (
        <>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Total Lbs Lost</h2>
            <LbsLostChart logs={logs} participants={PARTICIPANTS} />
          </div>
          <Verse reference="1 Thessalonians 5:11" text="Therefore encourage one another and build each other up." />
        </>
      )}

      {/* % Lost chart */}
      {hasData && (
        <>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Cumulative % Lost</h2>
            <PctLostChart logs={logs} participants={PARTICIPANTS} />
          </div>
          <Verse reference="Colossians 3:23" text="Whatever you do, work at it with all your heart, as working for the Lord." />
        </>
      )}

      {/* Individual stat cards */}
      {hasData && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-sm text-slate-300">Individual Stats</h2>
          {ranked.map(stats => (
            <div key={stats.participant.id} className="flex flex-col gap-2">
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
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
