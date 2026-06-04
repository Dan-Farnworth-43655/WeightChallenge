import { useState, useEffect, useCallback } from 'react'
import { fetchLogs, postLog, fetchPRs } from './api'
import { PARTICIPANTS, computeStats, sortByGoalProgress, todayStr } from './utils/calculations'
import NameSelector from './components/NameSelector'
import Dashboard from './components/Dashboard'
import LogWeight from './components/LogWeight'

const POLL_INTERVAL = 30000 // refresh every 30s

export default function App() {
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem('wt_user') || null)
  const [logs, setLogs] = useState([])
  const [prs, setPrs] = useState([])
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

  const allStats = PARTICIPANTS.map(p => computeStats(p, logs))
  const ranked = sortByGoalProgress(allStats)
  const activeParticipant = PARTICIPANTS.find(p => p.id === activeUser)
  const myStats = allStats.find(s => s.participant.id === activeUser)

  if (!activeUser) {
    return <NameSelector onSelect={setActiveUser} />
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">Accountability Tracker</h1>
            {myStats?.current != null ? (
              <p className="text-xs text-slate-400 truncate">
                <span className="text-slate-200 font-semibold tabular-nums">{myStats.current.toFixed(1)} lbs</span>
                {myStats.nextMilestone && !myStats.goalHit ? (
                  <>
                    {' '}·{' '}
                    <span className="text-slate-300">
                      {Math.max(0, myStats.current - myStats.nextMilestone.weight).toFixed(1)}
                    </span>
                    {' '}to {myStats.nextMilestone.weight}
                  </>
                ) : myStats.goal != null && !myStats.goalHit ? (
                  <>
                    {' '}·{' '}
                    <span className="text-slate-300">
                      {Math.max(0, myStats.current - myStats.goal).toFixed(1)}
                    </span>
                    {' '}to goal 🎯
                  </>
                ) : myStats.goalHit ? (
                  <> · <span className="text-emerald-400 font-semibold">✓ At goal</span></>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-slate-400">One day at a time</p>
            )}
          </div>
          <button
            onClick={() => setActiveUser(null)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors shrink-0 ml-3"
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: activeParticipant?.color }}
            >
              {activeParticipant?.initials}
            </span>
            <span>{activeParticipant?.name}</span>
          </button>
        </div>
        <div className="text-center mt-2">
          <p className="text-xs text-slate-500 whitespace-nowrap">⚔️ 🛡️ &nbsp;As iron sharpens iron, so one man sharpens another&nbsp; 🛡️ ⚔️</p>
          <p className="text-xs text-slate-600">Proverbs 27:17</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
        ) : tab === 'dashboard' ? (
          <Dashboard ranked={ranked} allStats={allStats} logs={logs} prs={prs} activeUser={activeUser} />
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
