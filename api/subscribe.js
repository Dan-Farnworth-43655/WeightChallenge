import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'POST') {
    const { participant, subscription } = req.body
    if (!participant || !subscription) return res.status(400).json({ error: 'Missing participant or subscription' })
    // Store one subscription per participant — overwrites if they re-subscribe
    await redis.hset('pushsubs', { [participant]: JSON.stringify(subscription) })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { participant } = req.body
    if (!participant) return res.status(400).json({ error: 'Missing participant' })
    await redis.hdel('pushsubs', participant)
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
