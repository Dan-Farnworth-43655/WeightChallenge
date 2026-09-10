import { PARTICIPANTS, applyGoalOverride, computeStats } from '../src/utils/calculations.js'

const base = 'https://weight-challenge-five.vercel.app'
const [goals, logs] = await Promise.all(['/api/goals', '/api/logs'].map(async path => {
  const response = await fetch(base + path)
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}))
for (const p of PARTICIPANTS) {
  const stats = computeStats(applyGoalOverride(p, goals), logs)
  console.log(JSON.stringify({ name: p.name, weighIns: stats.weighIns, achievements: stats.milestoneAchievements }))
}
