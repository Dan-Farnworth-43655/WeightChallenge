import { useState, useEffect } from 'react'
import { formatDate, formatLongDate, formatProjectedFinish, todayStr, PARTICIPANTS, aggregateLogs } from '../utils/calculations'
import WeightChart from './WeightChart'
import PctLostChart from './PctLostChart'
import LbsLostChart from './LbsLostChart'
import RegressionChart from './RegressionChart'
import GoalEditor from './GoalEditor'
import BadgeWall from './BadgeWall'
import BadgeUnlockToast from './BadgeUnlockToast'
import { BADGES, earnedBadges } from '../utils/badges'

// Rotating verses — picked deterministically by day-of-year so the same verse
// shows for the entire day across page reloads, but rotates each day.
const VERSES = [
  { reference: 'Ecclesiastes 4:9-10', text: 'Two are better than one... if either of them falls down, one can help the other up.' },
  { reference: 'Proverbs 27:17',      text: 'As iron sharpens iron, so one person sharpens another.' },
  { reference: '1 Thessalonians 5:11', text: 'Therefore encourage one another and build each other up.' },
  { reference: 'Colossians 3:23',     text: 'Whatever you do, work at it with all your heart, as working for the Lord.' },
  { reference: 'Hebrews 12:1',        text: 'Let us run with perseverance the race marked out for us.' },
  { reference: 'Philippians 4:13',    text: 'I can do all this through him who gives me strength.' },
  { reference: 'Galatians 6:9',       text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.' },
]

function todaysVerse() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now - start) / 86400000)
  return VERSES[dayOfYear % VERSES.length]
}

function GroupWeeklyRecap({ allStats }) {
  // Use any participant's recap to detect "it's Monday and someone has data"
  const anyRecap = allStats.find(s => s.recap)?.recap
  const [hidden, setHidden] = useState(() => {
    try { return anyRecap && localStorage.getItem(anyRecap.dismissKey) === '1' } catch (e) { return false }
  })
  if (!anyRecap || hidden) return null

  // Sort by delta ascending so biggest losers appear first (kindest reading)
  const rows = [...allStats]
    .filter(s => !s.participant.observer)
    .sort((a, b) => {
      const ad = a.recap ? a.recap.delta : Infinity
      const bd = b.recap ? b.recap.delta : Infinity
      return ad - bd
    })

  const dismiss = () => {
    try { localStorage.setItem(anyRecap.dismissKey, '1') } catch (e) {}
    setHidden(true)
  }

  return (
    <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/10 to-slate-900 px-4 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-sky-300 font-bold">📅 Last week's recap</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            How everyone did
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-white text-lg leading-none px-2"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(s => {
          const p = s.participant
          const r = s.recap
          const lost   = r && r.delta != null && r.delta < -0.05
          const gained = r && r.delta != null && r.delta >  0.05
          const flat   = r && r.delta != null && Math.abs(r.delta) <= 0.05
          return (
            <div key={p.id} className="flex items-center justify-between text-sm py-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ backgroundColor: p.color + '33', color: p.color }}
                >
                  {p.initials}
                </span>
                <span className="text-slate-200 truncate">{p.name}</span>
              </div>
              {r ? (
                <div className="flex items-baseline gap-2 tabular-nums shrink-0">
                  <span className="text-[10px] text-slate-500">{r.count}/7d</span>
                  <span className="text-slate-300 text-xs" title="Last week's average">
                    {r.lastAvg.toFixed(1)}
                  </span>
                  {r.firstTrackedWeek ? (
                    <span className="text-[10px] text-slate-500 italic">first week</span>
                  ) : flat ? (
                    <span className="font-bold text-slate-400 text-xs">flat</span>
                  ) : lost ? (
                    <span className="font-bold text-emerald-300 text-sm">{r.delta.toFixed(1)} 🎯</span>
                  ) : gained ? (
                    <span className="font-bold text-red-300 text-sm">+{r.delta.toFixed(1)}</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic shrink-0">no logs</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    weighIns, streak, logStreak, logStreakAtRisk, nextProjection, dowAnalysis, weekOverWeek,
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
              title={logStreakAtRisk ? 'Log today to save your streak!' : `${logStreak} consecutive days logged`}
            >
              🗓️ {logStreak}d{logStreakAtRisk ? '!' : ''}
            </span>
          )}
          {streak >= 1 && (
            <span className="text-xs font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5" title={`${streak}-week loss streak (weekly avg holding at or below the streak's low point)`}>
              🔥 {streak}w
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
              {Math.round(Math.min(1, pctToGoal) * 100)}%
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

      {/* Insight: projection for the next milestone (or final goal if all hit) */}
      {nextProjection && nextProjection.status !== 'hit' && (
        <div className="mt-3 rounded-xl border px-3 py-2 text-xs flex items-center gap-2"
          style={{
            backgroundColor: nextProjection.status === 'on-pace' ? 'rgba(16,185,129,0.08)'
                           : nextProjection.status === 'behind'  ? 'rgba(245,158,11,0.08)'
                           : 'rgba(239,68,68,0.08)',
            borderColor:     nextProjection.status === 'on-pace' ? 'rgba(16,185,129,0.4)'
                           : nextProjection.status === 'behind'  ? 'rgba(245,158,11,0.4)'
                           : 'rgba(239,68,68,0.4)',
          }}
        >
          <span className="text-base leading-none">
            {nextProjection.status === 'on-pace' ? '📈' : nextProjection.status === 'behind' ? '⏳' : '⚠️'}
          </span>
          <div className="flex-1 leading-tight">
            {nextProjection.status === 'not-on-pace' ? (
              <span className="text-red-300">
                Not trending toward <span className="font-bold">{nextProjection.target.weight} lbs</span> at current pace.
              </span>
            ) : (
              <>
                <span className="text-slate-300">
                  At current pace, hits <span className="font-bold text-white">{nextProjection.target.weight} lbs</span>{' '}
                  on <span className="font-bold text-white">{formatDate(nextProjection.projectedHitDate.toISOString().split('T')[0])}</span>
                </span>
                {' '}—{' '}
                <span className={`font-bold ${nextProjection.status === 'on-pace' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {nextProjection.daysOff <= 0
                    ? `${Math.abs(nextProjection.daysOff)} ${Math.abs(nextProjection.daysOff) === 1 ? 'day' : 'days'} early 🎉`
                    : `${nextProjection.daysOff} ${nextProjection.daysOff === 1 ? 'day' : 'days'} late`}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Insight: best & worst day-of-week */}
      {dowAnalysis && (dowAnalysis.best || dowAnalysis.worst) && (
        <div className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">📊</span>
          <div className="flex-1 leading-tight text-slate-300 space-y-0.5">
            {dowAnalysis.best && (
              <div>
                Best day: <span className="font-bold text-sky-300">{dowAnalysis.best.name}s</span>
                {' '}(avg{' '}
                <span className={`font-semibold tabular-nums ${dowAnalysis.best.avg <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {dowAnalysis.best.avg > 0 ? '+' : ''}{dowAnalysis.best.avg.toFixed(2)} lbs
                </span>)
              </div>
            )}
            {dowAnalysis.worst && dowAnalysis.worst.dow !== dowAnalysis.best?.dow && (
              <div>
                Worst day: <span className="font-bold text-red-300">{dowAnalysis.worst.name}s</span>
                {' '}(avg{' '}
                <span className={`font-semibold tabular-nums ${dowAnalysis.worst.avg > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                  {dowAnalysis.worst.avg > 0 ? '+' : ''}{dowAnalysis.worst.avg.toFixed(2)} lbs
                </span>)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Week-over-week comparison — smooths daily noise */}
      {weekOverWeek && (
        <div className="mt-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs flex items-center gap-2">
          <span className="text-base leading-none">📈</span>
          <div className="flex-1 leading-tight">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">
              {weekOverWeek.isCurrentWeek ? 'Week avg (so far)' : 'Week avg (last completed)'}
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-slate-400 tabular-nums">{weekOverWeek.lastAvg.toFixed(1)}</span>
              <span className="text-slate-500 text-[10px]">→</span>
              <span className="font-bold text-white tabular-nums">{weekOverWeek.thisAvg.toFixed(1)}</span>
              <span className={`font-bold tabular-nums ${
                weekOverWeek.delta < -0.05 ? 'text-emerald-300'
                : weekOverWeek.delta >  0.05 ? 'text-red-300'
                : 'text-slate-400'
              }`}>
                ({weekOverWeek.delta > 0 ? '+' : ''}{weekOverWeek.delta.toFixed(1)})
              </span>
            </div>
          </div>
        </div>
      )}

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

export default function Dashboard({ ranked, allStats, logs, prs = [], activeUser, onGoalsChanged }) {
  const hasData = logs.length > 0
  const today = todayStr()
  const [editingGoals, setEditingGoals] = useState(false)
  const [unlockQueue, setUnlockQueue] = useState([])
  const [viewedStatsId, setViewedStatsId] = useState(activeUser)
  // 'lifetime' | 'next' — group progress table view
  const [groupView, setGroupView] = useState(() => {
    try { return localStorage.getItem('groupView') || 'lifetime' } catch (e) { return 'lifetime' }
  })
  const switchGroupView = (v) => {
    setGroupView(v)
    try { localStorage.setItem('groupView', v) } catch (e) {}
  }
  // 'daily' | 'weekly' | 'monthly' — bottom chart granularity
  const [chartGran, setChartGran] = useState(() => {
    try { return localStorage.getItem('chartGran') || 'daily' } catch (e) { return 'daily' }
  })
  const switchChartGran = (v) => {
    setChartGran(v)
    try { localStorage.setItem('chartGran', v) } catch (e) {}
  }
  const chartLogs = aggregateLogs(logs, chartGran)

  // Detect newly earned badges for the active user and queue toasts.
  // The "seen" set is monotonic — once a badge has toasted we never forget it,
  // so each achievement is celebrated exactly once. Badge checks are also
  // earned-forever now, but a goal/milestone edit can still un-earn one; the
  // union below guarantees that even then it never re-fires the same toast.
  useEffect(() => {
    if (!activeUser) return
    const me = allStats.find(s => s.participant.id === activeUser)
    if (!me) return
    const earned = earnedBadges(me)
    const key = `seen_badges_${activeUser}`
    let seen = []
    try { seen = JSON.parse(localStorage.getItem(key) ?? '[]') } catch (e) { seen = [] }
    const newly = earned.filter(id => !seen.includes(id))
    if (newly.length > 0) {
      const newBadges = newly.map(id => BADGES.find(b => b.id === id)).filter(Boolean)
      setUnlockQueue(newBadges)
      // Add the newly-earned ids to "seen" (union) — never remove on un-earn.
      const merged = [...new Set([...seen, ...earned])]
      try { localStorage.setItem(key, JSON.stringify(merged)) } catch (e) {}
    }
  }, [activeUser, allStats])

  const dismissUnlock = () => setUnlockQueue(q => q.slice(1))

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

      {/* Weekly recap banner — Mondays only, group-wide, dismissible */}
      <GroupWeeklyRecap allStats={allStats} />

      {/* Streaks scoreboard — everyone's logging + downtrend streaks at a glance */}
      {hasData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Streaks</h3>
            <span className="text-[10px] text-slate-600">🗓️ days · 🔥 weeks</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ranked.map(s => {
              const p = s.participant
              return (
                <div key={p.id} className="flex flex-col items-center gap-1.5 py-1">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{ backgroundColor: p.color + '33', color: p.color }}
                  >
                    {p.initials}
                  </span>
                  <div className="flex flex-col items-center gap-0.5 leading-tight tabular-nums">
                    <span
                      className={`text-xs font-bold ${
                        s.logStreak >= 2
                          ? (s.logStreakAtRisk ? 'text-amber-300' : 'text-sky-300')
                          : 'text-slate-700'
                      }`}
                      title={
                        s.logStreak >= 2
                          ? (s.logStreakAtRisk
                              ? 'Streak at risk — log today!'
                              : `${s.logStreak}-day logging streak`)
                          : 'No logging streak yet'
                      }
                    >
                      🗓️ {s.logStreak >= 2 ? `${s.logStreak}d${s.logStreakAtRisk ? '!' : ''}` : '—'}
                    </span>
                    <span
                      className={`text-xs font-bold ${s.streak >= 1 ? 'text-orange-300' : 'text-slate-700'}`}
                      title={s.streak >= 1 ? `${s.streak}-week downtrend` : 'No weekly downtrend streak'}
                    >
                      🔥 {s.streak >= 1 ? `${s.streak}w` : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Group progress table — top of the dashboard, the accountability anchor */}
      {hasData && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm text-slate-300">Group Progress</h2>
            {/* Lifetime / Next Up toggle pill */}
            <div className="bg-slate-800 rounded-full p-0.5 flex text-[10px] uppercase tracking-wider font-bold">
              <button
                onClick={() => switchGroupView('lifetime')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  groupView === 'lifetime' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Lifetime
              </button>
              <button
                onClick={() => switchGroupView('next')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  groupView === 'next' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Next Up
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-right px-2 py-2">Cur</th>
                {groupView === 'lifetime' ? (
                  <>
                    <th className="text-right px-2 py-2">Goal</th>
                    <th className="text-right px-2 py-2">To Go</th>
                    <th className="text-right px-2 py-2">Lost</th>
                    <th className="text-right px-3 py-2">Prev</th>
                  </>
                ) : (
                  <>
                    <th className="text-right px-2 py-2">→ Next</th>
                    <th className="text-right px-2 py-2">Days</th>
                    <th className="text-right px-3 py-2">Prev</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const isGaining = s.lost < 0
                const prevLog = s.logs.length >= 2 ? s.logs[s.logs.length - 2] : null
                const prevDelta = prevLog ? s.current - prevLog.weight : null
                const loggedToday = s.logs.some(l => l.date === today)
                const missingToday = s.logs.length > 0 && !loggedToday
                // Next-target derivation: next un-hit milestone, or final goal as fallback
                const nextTarget = s.nextMilestone
                  ? { weight: s.nextMilestone.weight, date: s.nextMilestone.date, isGoal: false }
                  : (s.goal != null ? { weight: s.goal, date: s.goalDate, isGoal: true } : null)
                const lbsToNext = nextTarget && s.current != null
                  ? Math.max(0, s.current - nextTarget.weight)
                  : null
                const daysToNext = nextTarget?.date
                  ? Math.max(0, Math.ceil((nextTarget.date - new Date()) / 86400000))
                  : null
                return (
                  <tr
                    key={s.participant.id}
                    className={`border-t border-slate-800 transition-opacity ${missingToday ? 'opacity-60' : ''}`}
                    title={
                      missingToday
                        ? (s.daysSinceLastLog > 1 ? `Hasn't logged in ${s.daysSinceLastLog} days` : "Hasn't logged today")
                        : 'Logged today ✓'
                    }
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            loggedToday ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                          aria-label={loggedToday ? 'logged today' : 'not logged today'}
                        />
                        <span className="font-bold" style={{ color: s.participant.color }}>{s.participant.initials}</span>
                      </div>
                    </td>
                    <td className="text-right px-2 py-3 text-slate-300 tabular-nums">{s.current?.toFixed(1) ?? '—'}</td>
                    {groupView === 'lifetime' ? (
                      <>
                        <td className="text-right px-2 py-3 text-slate-400 tabular-nums">{s.goal?.toFixed(1) ?? '—'}</td>
                        <td className="text-right px-2 py-3 font-medium tabular-nums">
                          {s.goalHit ? (
                            <span className="text-emerald-400">✓</span>
                          ) : s.remaining != null ? (
                            <span className="text-slate-200">{s.remaining.toFixed(1)}</span>
                          ) : '—'}
                        </td>
                        <td className={`text-right px-2 py-3 font-medium tabular-nums ${isGaining ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isGaining ? '+' : '-'}{Math.abs(s.lost).toFixed(1)}
                        </td>
                        <td className={`text-right px-3 py-3 text-xs tabular-nums ${prevDelta === null ? 'text-slate-600' : prevDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {prevDelta === null ? '—' : `${prevDelta > 0 ? '+' : ''}${prevDelta.toFixed(1)}`}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-right px-2 py-3 tabular-nums">
                          {s.goalHit ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : lbsToNext != null && nextTarget ? (
                            <span>
                              <span className="font-medium">{lbsToNext.toFixed(1)}</span>
                              <span className={`text-[10px] ml-1 ${nextTarget.isGoal ? 'text-amber-400/80' : 'text-slate-500'}`}>
                                →{nextTarget.weight}{nextTarget.isGoal ? '🎯' : ''}
                              </span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="text-right px-2 py-3 text-slate-400 tabular-nums">
                          {daysToNext != null ? `${daysToNext}d` : '—'}
                        </td>
                        <td className={`text-right px-3 py-3 text-xs tabular-nums ${prevDelta === null ? 'text-slate-600' : prevDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {prevDelta === null ? '—' : `${prevDelta > 0 ? '+' : ''}${prevDelta.toFixed(1)}`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Group totals — collective achievement footer */}
          {(() => {
            const totalWeighIns = allStats.reduce((s, st) => s + st.weighIns, 0)
            const totalLost = allStats.reduce((s, st) => s + Math.max(0, st.lost ?? 0), 0)
            return (totalWeighIns > 0 || totalLost > 0) ? (
              <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
                <span>Together: <span className="font-bold text-slate-200 tabular-nums">{totalLost.toFixed(1)} lbs</span> lost</span>
                <span><span className="font-bold text-slate-200 tabular-nums">{totalWeighIns}</span> weigh-ins logged</span>
              </div>
            ) : null
          })()}
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

      {/* Stats with participant switcher — defaults to active user, tap to see others */}
      {hasData && (() => {
        const viewedStats = ranked.find(s => s.participant.id === viewedStatsId) ?? myStats
        if (!viewedStats) return null
        const isViewingSelf = viewedStats.participant.id === activeUser
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm text-slate-300">Individual Stats</h2>
              {isViewingSelf && (
                <button
                  onClick={() => setEditingGoals(true)}
                  className="text-xs text-slate-500 hover:text-sky-400 transition-colors font-semibold"
                >
                  ⚙️ Edit goal
                </button>
              )}
            </div>

            {/* Participant pills */}
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {ranked.map(s => {
                const p = s.participant
                const active = p.id === viewedStats.participant.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setViewedStatsId(p.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      active ? 'shadow-md' : 'opacity-50 hover:opacity-100'
                    }`}
                    style={
                      active
                        ? { backgroundColor: p.color, color: '#000' }
                        : { backgroundColor: p.color + '22', color: p.color, border: `1px solid ${p.color}44` }
                    }
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-black/20">
                      {p.initials}
                    </span>
                    {p.name}
                  </button>
                )
              })}
            </div>

            <StatCardWithRegression stats={viewedStats} />
          </div>
        )
      })()}

      {/* Badge unlock toast — fires when active user newly earns one */}
      {unlockQueue.length > 0 && myStats && (
        <BadgeUnlockToast
          badge={unlockQueue[0]}
          participant={myStats.participant}
          queueLength={unlockQueue.length}
          onClose={dismissUnlock}
        />
      )}

      {/* Goal editor modal — for the active user only */}
      {editingGoals && myStats && (
        <GoalEditor
          participant={myStats.participant}
          currentGoal={myStats.participant.goal}
          currentMilestones={myStats.participant.milestones ?? []}
          onClose={() => setEditingGoals(false)}
          onSaved={() => { onGoalsChanged?.(); setEditingGoals(false) }}
        />
      )}

      {/* Anchor verse — rotates daily through a set of accountability-themed verses */}
      {hasData && (() => {
        const v = todaysVerse()
        return <Verse reference={v.reference} text={v.text} />
      })()}

      {/* Group trend charts — granularity toggle smooths daily noise */}
      {hasData && (
        <>
          {/* Daily / Weekly / Monthly toggle */}
          <div className="flex items-center justify-between gap-2 -mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Group Trends</h2>
            <div className="bg-slate-900 rounded-full p-0.5 flex text-[10px] uppercase tracking-wider font-bold border border-slate-800">
              {['daily', 'weekly', 'monthly'].map(g => (
                <button
                  key={g}
                  onClick={() => switchChartGran(g)}
                  className={`px-2.5 py-1 rounded-full transition-colors ${
                    chartGran === g ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Weight Over Time</h2>
            <WeightChart logs={chartLogs} participants={PARTICIPANTS} />
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Total Lbs Lost</h2>
            <LbsLostChart logs={chartLogs} participants={PARTICIPANTS} />
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <h2 className="font-semibold text-sm text-slate-300 mb-4">Cumulative % Lost</h2>
            <PctLostChart logs={chartLogs} participants={PARTICIPANTS} />
          </div>
        </>
      )}

      {/* Wall of Fame — at the very bottom */}
      {hasData && <BadgeWall allStats={allStats} />}
    </div>
  )
}
