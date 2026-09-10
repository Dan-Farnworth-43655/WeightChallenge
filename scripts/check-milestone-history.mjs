import assert from 'node:assert/strict'
import { archiveMilestones, milestoneAchievements } from '../src/utils/milestoneHistory.js'
import { applyGoalOverride, computeStats } from '../src/utils/calculations.js'

const old = { weight: 200, date: '2026-08-31' }
const next = { weight: 190, date: '2026-11-18' }
const history = archiveMilestones({ milestones: [old] }, [next], '2026-09-10')
assert.deepEqual(history, [{ ...old, retiredAt: '2026-09-10' }])
assert.deepEqual(archiveMilestones({ milestoneHistory: history, milestones: [next] }, [next], '2026-09-11'), history)

const p = applyGoalOverride({ id: 'test', milestones: [] }, {
  test: { goal: { weight: 180 }, milestones: [next], milestoneHistory: history },
})
const logs = [
  { participant: 'test', date: '2026-08-01', weight: 205 },
  { participant: 'test', date: '2026-08-20', weight: 199 },
  { participant: 'test', date: '2026-09-10', weight: 202 },
]
assert.deepEqual(computeStats(p, logs).milestoneAchievements, [{ weight: 200, hitDate: '2026-08-20', actualWeight: 199 }])
assert.equal(computeStats(p, logs).nextMilestone.weight, 190)
assert.deepEqual(milestoneAchievements(p, [{ date: '2026-09-11', weight: 199 }]), [])
assert.deepEqual(milestoneAchievements(p, []), [])
assert.equal(milestoneAchievements({ ...p, milestones: [old, next] }, logs).length, 1)
// Recovered September checkpoint remains available after the November reset.
assert.ok(milestoneAchievements({ id: 'dan', milestones: [] }, [{ date: '2026-09-09', weight: 182.8 }]).some(m => m.weight === 182.8))
console.log('Milestone recovery, archive preservation, bounce-back, retirement cutoff, deduplication, and active target checks passed.')

for (const [id, start] of Object.entries({ javin: 214.2, dan: 198.3, paul: 233.4 })) {
  const threshold = start * 0.92
  const achievements = milestoneAchievements({ id }, [
    { date: '2026-03-30', weight: threshold - 1 },
    { date: '2026-05-01', weight: threshold + 0.01 },
    { date: '2026-05-20', weight: threshold - 0.01 },
    { date: '2026-09-10', weight: start },
  ])
  assert.equal(achievements.find(m => m.label === '8% in 8 weeks').hitDate, '2026-05-20')
}
assert.ok(!milestoneAchievements({ id: 'josh' }, [{ date: '2026-05-20', weight: 170 }]).some(m => m.label === '8% in 8 weeks'))
console.log('Original 8% challenge: all three founders, exact threshold, start date, bounce-back, and Josh exclusion passed.')
