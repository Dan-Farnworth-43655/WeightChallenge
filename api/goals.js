import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Stores per-participant goal overrides:
//   Redis key: 'goals' (hash)
//   Field:     participant id
//   Value:     JSON.stringify({ goal: { weight, date }, milestones: [{ weight, date }, ...] })
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const raw = await redis.hgetall('goals') || {}
    const out = {}
    for (const [pid, val] of Object.entries(raw)) {
      try { out[pid] = typeof val === 'string' ? JSON.parse(val) : val } catch (e) { /* skip malformed */ }
    }
    return res.json(out)
  }

  if (req.method === 'POST') {
    const { participant, goal, milestones } = req.body
    if (!participant) return res.status(400).json({ error: 'Missing participant' })
    // Basic shape validation
    if (goal && (typeof goal.weight !== 'number' || (goal.date && typeof goal.date !== 'string'))) {
      return res.status(400).json({ error: 'Invalid goal shape' })
    }
    if (milestones && !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'milestones must be an array' })
    }
    const payload = JSON.stringify({ goal: goal ?? null, milestones: milestones ?? [] })
    await redis.hset('goals', { [participant]: payload })
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
