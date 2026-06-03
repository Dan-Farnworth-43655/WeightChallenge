import { Redis } from '@upstash/redis'
import webpush from 'web-push'

const redis = Redis.fromEnv()

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Central Time today as YYYY-MM-DD
function todayStrCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export default async function handler(req, res) {
  // Allow only GET (Vercel Cron uses GET) or POST with secret
  const isCron = req.headers['user-agent']?.includes('vercel-cron')
  const auth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  if (!isCron && !auth) {
    // For manual testing, also allow if CRON_SECRET is unset (best-effort safety)
    if (process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' })
  }

  // Find who has NOT logged today (Central Time)
  const today = todayStrCT()
  const [allLogs, subsRaw] = await Promise.all([
    redis.hgetall('weightlogs'),
    redis.hgetall('pushsubs'),
  ])

  // Build set of participants who have a log for today
  const loggedToday = new Set()
  for (const key of Object.keys(allLogs || {})) {
    const [participant, date] = key.split(':')
    if (date === today) loggedToday.add(participant)
  }

  const results = []
  for (const [participant, raw] of Object.entries(subsRaw || {})) {
    if (loggedToday.has(participant)) {
      results.push({ participant, sent: false, reason: 'already logged' })
      continue
    }
    try {
      const sub = typeof raw === 'string' ? JSON.parse(raw) : raw
      await webpush.sendNotification(sub, JSON.stringify({
        title: '⚖️ Have you weighed in?',
        body:  "Log your weight before midnight to keep your streak alive.",
        tag:   'daily-log-reminder',
        url:   '/',
      }))
      results.push({ participant, sent: true })
    } catch (e) {
      // 410 = subscription expired/revoked. Clean it up.
      if (e.statusCode === 410 || e.statusCode === 404) {
        await redis.hdel('pushsubs', participant)
        results.push({ participant, sent: false, reason: 'subscription removed (expired)' })
      } else {
        results.push({ participant, sent: false, reason: e.message })
      }
    }
  }

  return res.json({ today, results })
}
