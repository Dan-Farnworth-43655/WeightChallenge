import { useState } from 'react'
import { saveGoals } from '../api'

// Modal for editing one participant's goal + milestones. Calls onSave when
// done so the parent can refetch and the dashboard updates.
export default function GoalEditor({ participant, currentGoal, currentMilestones = [], onClose, onSaved }) {
  const [goalWeight,  setGoalWeight]  = useState(currentGoal?.weight != null ? String(currentGoal.weight) : '')
  const [goalDate,    setGoalDate]    = useState(currentGoal?.date ?? '')
  const [milestones,  setMilestones]  = useState(
    currentMilestones.map(m => ({ weight: String(m.weight), date: m.date ?? '' }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  function setMilestone(i, key, value) {
    setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, [key]: value } : m))
  }
  function addMilestone()    { setMilestones(ms => [...ms, { weight: '', date: '' }]) }
  function removeMilestone(i) { setMilestones(ms => ms.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    setError(null)
    const gw = parseFloat(goalWeight)
    if (!isFinite(gw)) { setError('Goal weight is required'); return }
    if (!goalDate)     { setError('Goal date is required');   return }

    // Build clean milestone list — skip empties, validate
    const cleanMilestones = []
    for (const m of milestones) {
      if (!m.weight && !m.date) continue
      const w = parseFloat(m.weight)
      if (!isFinite(w)) { setError('Milestone weight invalid'); return }
      cleanMilestones.push({ weight: w, date: m.date || null })
    }
    // Sort milestones by date (or weight desc if no date)
    cleanMilestones.sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date)
      return b.weight - a.weight
    })

    setSaving(true)
    try {
      await saveGoals(participant.id, { weight: gw, date: goalDate }, cleanMilestones)
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm overflow-y-auto py-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mx-4 max-w-md w-full shadow-2xl my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Edit Goal &amp; Milestones</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" aria-label="Close">✕</button>
        </div>

        {/* Final Goal */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 mb-4">
          <p className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-2">🎯 Final Goal</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">Goal weight (lbs)</label>
              <input
                type="number" step="0.1" value={goalWeight}
                onChange={e => setGoalWeight(e.target.value)}
                placeholder="e.g. 185"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                inputMode="decimal"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">By date</label>
              <input
                type="date" value={goalDate}
                onChange={e => setGoalDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Milestones</p>
            <button onClick={addMilestone} className="text-xs font-semibold text-sky-400 hover:text-sky-300">+ Add</button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No milestones yet — tap "+ Add" to set checkpoints.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1">Weight</label>
                    <input
                      type="number" step="0.1" value={m.weight}
                      onChange={e => setMilestone(i, 'weight', e.target.value)}
                      placeholder="lbs"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1">By date (optional)</label>
                    <input
                      type="date" value={m.date}
                      onChange={e => setMilestone(i, 'date', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    onClick={() => removeMilestone(i)}
                    className="text-slate-500 hover:text-red-400 p-1.5 mb-0.5"
                    aria-label="Remove"
                    title="Remove"
                  >🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: participant.color, color: '#000' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
