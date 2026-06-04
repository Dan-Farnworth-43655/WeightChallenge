import { useState } from 'react'
import { BADGES, earnedBadges } from '../utils/badges'
import BadgeDetailsModal from './BadgeDetailsModal'

const CATEGORY_LABELS = {
  consistency: 'Consistency',
  progress:    'Progress',
  goals:       'Goals',
  commitment:  'Commitment',
  resilience:  'Resilience',
}

// Group-wide badge gallery. Each badge shows who has earned it via small
// colored initials. Locked badges are dimmed silhouettes.
export default function BadgeWall({ allStats }) {
  const [selectedBadge, setSelectedBadge] = useState(null)

  // For each badge, collect the list of participants who have earned it
  const earnedMap = {}
  for (const s of allStats) {
    const ids = earnedBadges(s)
    for (const id of ids) {
      if (!earnedMap[id]) earnedMap[id] = []
      earnedMap[id].push(s.participant)
    }
  }

  // Group badges by category for the section layout
  const byCategory = BADGES.reduce((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  const totalEarned = Object.values(earnedMap).reduce((s, arr) => s + arr.length, 0)
  const totalPossible = BADGES.length * allStats.length

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-slate-300">🏅 Wall of Fame</h2>
        <span className="text-xs text-slate-500 tabular-nums">{totalEarned}/{totalPossible}</span>
      </div>

      <div className="p-3 flex flex-col gap-4">
        {Object.entries(byCategory).map(([cat, badges]) => (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 px-1">{CATEGORY_LABELS[cat]}</p>
            <div className="grid grid-cols-3 gap-2">
              {badges.map(b => {
                const earners = earnedMap[b.id] ?? []
                const isLocked = earners.length === 0
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBadge(b)}
                    className={`rounded-xl border p-2 text-center transition-all hover:scale-105 active:scale-95 ${
                      isLocked
                        ? 'bg-slate-950/40 border-slate-800 opacity-50 hover:opacity-80'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`text-2xl mb-1 ${isLocked ? 'grayscale' : ''}`}>{b.emoji}</div>
                    <div className="text-[10px] font-bold text-slate-200 leading-tight">{b.name}</div>
                    {/* Earners avatars */}
                    <div className="flex items-center justify-center gap-0.5 mt-1.5 min-h-[14px]">
                      {earners.map(p => (
                        <span
                          key={p.id}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black border border-slate-900"
                          style={{ backgroundColor: p.color, color: '#000' }}
                        >
                          {p.initials[0]}
                        </span>
                      ))}
                      {earners.length === 0 && <span className="text-[9px] text-slate-600">tap for details</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Badge details modal — tap any badge to learn what unlocks it */}
      {selectedBadge && (
        <BadgeDetailsModal
          badge={selectedBadge}
          earners={earnedMap[selectedBadge.id] ?? []}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  )
}
