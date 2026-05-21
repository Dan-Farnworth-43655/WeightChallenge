import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { formatDate } from '../utils/calculations'
import { deleteLog, postLog } from '../api'

const DANCING_GIFS = [
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif',
  'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif',
  'https://media.giphy.com/media/xT9IgG50Lg7rusXIaQ/giphy.gif',
]

function GoalModal({ participant, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-yellow-400/80 rounded-3xl p-6 mx-4 max-w-sm w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-8xl mb-3 animate-bounce">🥇</div>
        <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: participant.color }}>
          GOAL ACHIEVED!
        </h2>
        <p className="text-yellow-300 font-bold text-lg mb-2">Congratulations!</p>
        <p className="text-slate-300 text-sm mb-6">
          <span className="font-bold" style={{ color: participant.color }}>{participant.name}</span>
          {' '}hit their goal weight. All that hard work paid off — this is what it feels like to WIN. 🏆
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {DANCING_GIFS.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="celebration"
              className="w-full h-28 object-cover rounded-xl"
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-xl font-black text-lg transition-colors active:scale-95"
          style={{ backgroundColor: participant.color, color: '#000' }}
        >
          I AM A CHAMPION 🥇
        </button>
      </div>
    </div>
  )
}

function JavinTauntModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-6 mx-4 max-w-xs w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-3">😤</div>
        <h2 className="text-2xl font-black text-purple-400 mb-2 tracking-tight">Dan will beat you.</h2>
        <p className="text-slate-400 text-sm mb-6">Just thought you should know. 💜</p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-base bg-purple-600 hover:bg-purple-500 text-white transition-colors active:scale-95"
        >
          We'll see about that 😤
        </button>
      </div>
    </div>
  )
}

function playOink() {
  try {
    if (!window.speechSynthesis) return
    // Speech synthesis is far more reliable than Web Audio on iOS Safari
    window.speechSynthesis.cancel() // clear any queued speech
    const u = new SpeechSynthesisUtterance('oink oink')
    u.pitch  = 2     // max pitch — high and squealy
    u.rate   = 1.3   // a bit fast
    u.volume = 1
    window.speechSynthesis.speak(u)
  } catch (e) { /* silently ignore */ }
}

function GainModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-red-500/60 rounded-3xl p-6 mx-4 max-w-xs w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-3">😡</div>
        <h2 className="text-2xl font-black text-red-400 mb-2 tracking-tight">Do better, fatty!</h2>
        <p className="text-slate-400 text-sm mb-6">The scale doesn't lie. Get it together! 🥗</p>
        <button
          onClick={onClose}
          className="flex flex-col items-center gap-2 mx-auto group active:scale-95 transition-transform"
        >
          <div className="w-28 h-28 rounded-full bg-red-950 border-2 border-red-500/40 group-hover:border-red-400 transition-colors flex items-center justify-center text-7xl">
            🐷
          </div>
          <span className="text-xs text-red-400 group-hover:text-red-300 transition-colors font-semibold">
            Tap to admit you're a total loser.
          </span>
        </button>
      </div>
    </div>
  )
}

const MILESTONE_CONFIG = {
  10: {
    header: '🎉🎊🎉',
    title: '10 LBS DOWN!',
    subtitle: 'is officially 10 pounds lighter. The boys are celebrating!',
    button: "LET'S GOOO! 🔥",
  },
  15: {
    header: '🔥💪🔥',
    title: '15 LBS DOWN!',
    subtitle: 'just dropped 15 pounds. That\'s a whole Thanksgiving turkey!',
    button: "KEEP GRINDING! 💪",
  },
  20: {
    header: '👑🏆👑',
    title: '20 LBS DOWN!',
    subtitle: 'lost 20 POUNDS. That is absolutely unreal. Legend status.',
    button: "ABSOLUTE UNIT! 🏆",
  },
}

function MilestoneModal({ participant, lbs, onClose }) {
  const cfg = MILESTONE_CONFIG[lbs] ?? MILESTONE_CONFIG[10]
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 mx-4 max-w-sm w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-5xl mb-2">{cfg.header}</div>
        <h2 className="text-3xl font-black text-amber-400 mb-1 tracking-tight">{cfg.title}</h2>
        <p className="text-slate-300 text-sm mb-5">
          <span className="font-bold" style={{ color: participant.color }}>{participant.name}</span>
          {' '}{cfg.subtitle} 💪
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {DANCING_GIFS.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="dancing celebration"
              className="w-full h-28 object-cover rounded-xl"
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-base bg-amber-400 hover:bg-amber-300 text-black transition-colors active:scale-95"
        >
          {cfg.button}
        </button>
      </div>
    </div>
  )
}

export default function LogWeight({ participant, stats, onLog, onRefresh, todayStr }) {
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayStr)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingDate, setEditingDate] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [deletingDate, setDeletingDate] = useState(null)
  const [modalQueue, setModalQueue] = useState([]) // ordered list of modals to show

  const todayEntry = stats?.logs?.find(l => l.date === date)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!weight || isNaN(parseFloat(weight))) return

    const w = parseFloat(weight)
    const effectiveStart = stats?.effectiveStart
    const priorLost = stats?.lost ?? 0
    const newLost = effectiveStart != null ? effectiveStart - w : 0
    const MILESTONES = [20, 15, 10]
    const hitMilestone = MILESTONES.find(m => newLost >= m && priorLost < m) ?? null
    const hitGoal = stats?.goal != null && stats?.current != null
      && w <= stats.goal && stats.current > stats.goal
    const gainedWeight = stats?.current != null && stats.logs.length > 0 && w > stats.current

    // Play oink synchronously BEFORE the await — any async gap kills iOS gesture context
    if (gainedWeight && !hitMilestone && !hitGoal) playOink()

    setSaving(true)
    const result = await onLog(participant.id, date, w)
    setSaving(false)
    setSaved(true)
    setWeight('')

    if (result?.isPR) {
      confetti({ particleCount: 80, angle: 60,  spread: 55, origin: { x: 0, y: 0.7 }, colors: [participant.color, '#fbbf24', '#ffffff'] })
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: [participant.color, '#fbbf24', '#ffffff'] })
    }

    // Build the modal queue in priority order
    const queue = []

    if (hitGoal) {
      const gold = ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', participant.color]
      confetti({ particleCount: 200, angle: 60,  spread: 80,  origin: { x: 0,   y: 0.5 }, colors: gold })
      confetti({ particleCount: 200, angle: 120, spread: 80,  origin: { x: 1,   y: 0.5 }, colors: gold })
      confetti({ particleCount: 150, angle: 90,  spread: 100, origin: { x: 0.5, y: 0   }, colors: gold })
      queue.push('goal')
    }

    if (hitMilestone && !hitGoal) {
      const colors = [participant.color, '#fbbf24', '#f472b6', '#34d399', '#ffffff']
      const count = hitMilestone === 20 ? 180 : hitMilestone === 15 ? 150 : 120
      confetti({ particleCount: count, angle: 60,  spread: 70, origin: { x: 0,   y: 0.6 }, colors })
      confetti({ particleCount: count, angle: 120, spread: 70, origin: { x: 1,   y: 0.6 }, colors })
      confetti({ particleCount: 80,   angle: 90,  spread: 90, origin: { x: 0.5, y: 0.3 }, colors })
      queue.push(`milestone-${hitMilestone}`)
    }

    if (gainedWeight && !hitMilestone && !hitGoal) queue.push('gain')
    if (participant.id === 'javin') queue.push('javin')

    if (queue.length > 0) setModalQueue(queue)

    setTimeout(() => setSaved(false), 2500)
  }

  async function handleEditSave(log) {
    if (!editWeight || isNaN(parseFloat(editWeight))) return
    await postLog(participant.id, log.date, parseFloat(editWeight))
    await onLog(participant.id, log.date, parseFloat(editWeight))
    setEditingDate(null)
    setEditWeight('')
  }

  async function handleDelete(log) {
    setDeletingDate(log.date)
    await deleteLog(participant.id, log.date)
    await onRefresh()
    setDeletingDate(null)
  }

  const dismissModal = () => setModalQueue(q => q.slice(1))

  const sortedLogs = [...(stats?.logs ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="px-4 py-4 flex flex-col gap-6">
      {/* Modal queue — always shows only the first item; dismiss advances to the next */}
      {modalQueue[0] === 'goal'      && <GoalModal      participant={participant} onClose={dismissModal} />}
      {modalQueue[0] === 'gain'      && <GainModal      onClose={dismissModal} />}
      {modalQueue[0]?.startsWith('milestone') && (
        <MilestoneModal participant={participant} lbs={parseInt(modalQueue[0].split('-')[1])} onClose={dismissModal} />
      )}
      {modalQueue[0] === 'javin'     && <JavinTauntModal onClose={dismissModal} />}

      {/* Log form */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: participant.color + '33', color: participant.color }}
          >
            {participant.initials}
          </span>
          <h2 className="font-semibold">Log Weight — {participant.name}</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setSaved(false) }}
              min="2026-04-01"
              max="2026-06-01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Weight (lbs)
              {todayEntry && <span className="text-amber-400 ml-2">· Currently logged: {todayEntry.weight} lbs (will overwrite)</span>}
            </label>
            <input
              type="number"
              step="0.1"
              placeholder={todayEntry ? todayEntry.weight.toString() : 'e.g. 195.4'}
              value={weight}
              onChange={e => { setWeight(e.target.value); setSaved(false) }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-2xl font-bold focus:outline-none focus:border-sky-500"
              inputMode="decimal"
            />
          </div>

          <button
            type="submit"
            disabled={!weight || saving}
            className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: saved ? '#34d399' : participant.color }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Log Weight'}
          </button>
        </form>
      </div>

      {/* History */}
      {sortedLogs.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="font-semibold text-sm text-slate-300">My Weigh-in History</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {sortedLogs.map((log, i) => {
              const prev = sortedLogs[i + 1]
              const delta = prev ? log.weight - prev.weight : null
              const isEditing = editingDate === log.date
              const isDeleting = deletingDate === log.date

              return (
                <div key={log.date} className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm w-16 shrink-0">{formatDate(log.date)}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editWeight}
                        onChange={e => setEditWeight(e.target.value)}
                        className="flex-1 bg-slate-800 border border-sky-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                        inputMode="decimal"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(log)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingDate(null); setEditWeight('') }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">{formatDate(log.date)}</span>
                      <div className="flex items-center gap-3">
                        {delta !== null && (
                          <span className={`text-xs font-medium ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                        <span className="font-bold">{log.weight.toFixed(1)} lbs</span>
                        <button
                          onClick={() => { setEditingDate(log.date); setEditWeight(log.weight.toString()) }}
                          className="text-slate-500 hover:text-sky-400 transition-colors p-1"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(log)}
                          disabled={isDeleting}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
