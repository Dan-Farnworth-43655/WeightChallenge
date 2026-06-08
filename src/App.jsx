import { useState, useEffect, useCallback } from 'react'
import { fetchLogs, postLog, fetchPRs, fetchGoals } from './api'
import { PARTICIPANTS, applyGoalOverride, computeStats, sortByGoalProgress, todayStr } from './utils/calculations'
import NameSelector from './components/NameSelector'
import Dashboard from './components/Dashboard'
import Calendar from './components/Calendar'
import LogWeight from './components/LogWeight'

const POLL_INTERVAL = 30000 // refresh every 30s

export default function App() {
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem('wt_user') || null)
  const [logs, setLogs] = useState([])
  const [prs, setPrs] = useState([])
  const [goalOverrides, setGoalOverrides] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

  useEffect(() => {
    if (activeUser) localStorage.setItem('wt_user', activeUser)
    else localStorage.removeItem('wt_user')
  }, [activeUser])

  const loadLogs = useCallback(async () => {
    // Load logs and PRs independently — a failure in PRs must NOT block logs
    try {
      const data = await fetchLogs()
      setLogs(data)
    } catch (e) {
      console.error('fetchLogs failed:', e)
    }
    try {
      const prData = await fetchPRs()
      setPrs(prData)
    } catch (e) {
      console.error('fetchPRs failed:', e)
    }
    try {
      const goalsData = await fetchGoals()
      setGoalOverrides(goalsData)
    } catch (e) {
      console.error('fetchGoals failed:', e)
    }
    setLoading(false)
  }, [])

  // Initial load + polling
  useEffect(() => {
    loadLogs()
    const id = setInterval(loadLogs, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [loadLogs])

  // Refresh when tab regains focus
  useEffect(() => {
    const onFocus = () => loadLogs()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadLogs])

  async function logWeight(participant, date, weight) {
    const result = await postLog(participant, date, parseFloat(weight))
    await loadLogs()
    return result // passes { ok, isPR } back to LogWeight for confetti
  }

  const allStats = PARTICIPANTS.map(p => computeStats(applyGoalOverride(p, goalOverrides), logs))
  const ranked = sortByGoalProgress(allStats)
  const activeParticipant = PARTICIPANTS.find(p => p.id === activeUser)
  const myStats = allStats.find(s => s.participant.id === activeUser)

  if (!activeUser) {
    return <NameSelector onSelect={setActiveUser} />
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        {/* Top row: small title + sign-out */}
        <div className="flex items-center justify-between mb-2.5">
          <h1 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">Accountability Tracker</h1>
          <button
            onClick={() => setActiveUser(null)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
          >
            Switch user
          </button>
        </div>

        {/* Main row: avatar with progress ring + weight + streaks */}
        <div className="flex items-center gap-3">
          {/* Avatar with conic-gradient progress ring */}
          <div
            className="w-12 h-12 rounded-full shrink-0 relative"
            style={{
              background: activeParticipant
                ? `conic-gradient(${activeParticipant.color} 0deg ${Math.max(0, Math.min(1, myStats?.pctToGoal ?? 0)) * 360}deg, ${activeParticipant.color}22 0deg)`
                : '#1e293b',
            }}
            title={`${Math.round((myStats?.pctToGoal ?? 0) * 100)}% to goal`}
          >
            <div
              className="absolute inset-[3px] rounded-full bg-slate-950 flex items-center justify-center text-xs font-black"
              style={{ color: activeParticipant?.color }}
            >
              {activeParticipant?.initials}
            </div>
          </div>

          {/* Weight + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              {myStats?.current != null ? (
                <span className="text-2xl font-black tabular-nums leading-none">{myStats.current.toFixed(1)}</span>
              ) : (
                <span className="text-2xl font-black text-slate-600 leading-none">—</span>
              )}
              <span className="text-xs text-slate-500">lbs</span>
              <span className="ml-1 text-xs text-slate-400 truncate">· {activeParticipant?.name}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-1 leading-tight">
              {myStats?.goalHit ? (
                <span className="text-emerald-400 font-semibold">✓ At goal</span>
              ) : myStats?.nextMilestone ? (
                <>
                  <span className="text-slate-300 font-semibold tabular-nums">
                    {Math.max(0, myStats.current - myStats.nextMilestone.weight).toFixed(1)}
                  </span> to{' '}
                  <span className="font-semibold" style={{ color: activeParticipant?.color }}>
                    {myStats.nextMilestone.weight}
                  </span>
                </>
              ) : myStats?.goal != null ? (
                <>
                  <span className="text-slate-300 font-semibold tabular-nums">
                    {Math.max(0, myStats.current - myStats.goal).toFixed(1)}
                  </span> to goal 🎯
                </>
              ) : (
                <span>One day at a time</span>
              )}
            </div>
          </div>

          {/* Streak badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {myStats?.logStreak >= 2 && (
              <span
                className={`text-[10px] font-bold rounded-full px-2 py-0.5 border whitespace-nowrap ${
                  myStats.logStreakAtRisk
                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/40'
                    : 'text-sky-300 bg-sky-500/10 border-sky-500/30'
                }`}
                title={myStats.logStreakAtRisk ? 'Log today to save your streak!' : 'Consecutive days logged'}
              >
                🗓️ {myStats.logStreak}d
              </span>
            )}
            {myStats?.streak >= 1 && (
              <span
                className="text-[10px] font-bold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5 whitespace-nowrap"
                title={`${myStats.streak}-week downtrend`}
              >
                🔥 {myStats.streak}w
              </span>
            )}
          </div>
        </div>

        {/* Verse footer */}
        <div className="text-center mt-3 pt-2 border-t border-slate-800/60">
          <p className="text-xs text-slate-500 whitespace-nowrap">⚔️ 🛡️ &nbsp;As iron sharpens iron, so one man sharpens another&nbsp; 🛡️ ⚔️</p>
          <p className="text-[10px] text-slate-600">Proverbs 27:17</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
        ) : tab === 'dashboard' ? (
          <Dashboard ranked={ranked} allStats={allStats} logs={logs} prs={prs} activeUser={activeUser} onGoalsChanged={loadLogs} />
        ) : tab === 'calendar' ? (
          <Calendar allStats={allStats} initialParticipantId={activeUser} />
        ) : (
          <LogWeight
            participant={activeParticipant}
            stats={allStats.find(s => s.participant.id === activeUser)}
            onLog={logWeight}
            onRefresh={loadLogs}
            todayStr={todayStr()}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-slate-900 border-t border-slate-800 flex">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
            tab === 'dashboard' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Dashboard
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
            tab === 'calendar' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </button>
        <button
          onClick={() => setTab('log')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
            tab === 'log' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Log Weight
        </button>
      </nav>
    </div>
  )
}
