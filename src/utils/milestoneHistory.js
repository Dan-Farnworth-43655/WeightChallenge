// Recovered from committed participant defaults and the saved configuration
// read before the November 18 reset. Earlier goal-editor edits had no audit log.
export const RECOVERED_MILESTONES = {
  javin: [{ weight: 197, date: '2026-07-15' }, { weight: 194, date: '2026-08-15' }, { weight: 197, date: '2026-09-10' }],
  dan: [{ weight: 180, date: '2026-07-15' }, { weight: 182.8, date: '2026-09-10' }],
  paul: [{ weight: 207, date: '2026-07-31' }, { weight: 195, date: '2026-09-30' }, { weight: 207, date: '2026-09-10' }, { weight: 200, date: '2026-09-30' }],
  josh: [{ weight: 200, date: '2026-06-30' }, { weight: 195, date: '2026-07-31' }, { weight: 190, date: '2026-08-31' }, { weight: 197, date: '2026-09-10' }],
}

export const milestoneKey = m => `${m.weight}|${m.date ?? ''}`

export function archiveMilestones(previous, nextMilestones, retiredAt) {
  const activeKeys = new Set(nextMilestones.map(milestoneKey))
  const history = new Map((previous.milestoneHistory ?? []).map(m => [milestoneKey(m), m]))
  for (const m of previous.milestones ?? []) {
    if (!activeKeys.has(milestoneKey(m))) history.set(milestoneKey(m), { ...m, retiredAt })
  }
  return [...history.values()]
}

export function milestoneAchievements(participant, logs) {
  const recovered = (RECOVERED_MILESTONES[participant.id] ?? []).map(m => ({ ...m, retiredAt: '2026-09-10' }))
  const candidates = [...recovered, ...(participant.milestoneHistory ?? []), ...(participant.milestones ?? [])]
  const byWeight = new Map()
  for (const m of candidates) {
    const hit = logs.find(l => l.weight <= m.weight && (!m.retiredAt || l.date <= m.retiredAt))
    if (!hit) continue
    const existing = byWeight.get(m.weight)
    if (!existing || hit.date < existing.hitDate) {
      byWeight.set(m.weight, { weight: m.weight, hitDate: hit.date, actualWeight: hit.weight })
    }
  }
  return [...byWeight.values()].sort((a, b) => a.hitDate.localeCompare(b.hitDate) || b.weight - a.weight)
}
