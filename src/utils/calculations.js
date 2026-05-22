export const COMPETITION_START = new Date('2026-04-01')
export const COMPETITION_END = new Date('2026-06-01')
export const COMPETITION_DAYS = 62

export const PARTICIPANTS = [
  { id: 'javin', name: 'Javin', initials: 'JT', startWeight: 214.2, goalPercent: 0.08, color: '#0ea5e9' },
  { id: 'dan',   name: 'Dan',   initials: 'DF', startWeight: 198.3, goalPercent: 0.08, color: '#a78bfa' },
  { id: 'paul',  name: 'Paul',  initials: 'PW', startWeight: 233.4, goalPercent: 0.08, color: '#34d399' },
  { id: 'josh',  name: 'Josh',  initials: 'JR', startWeight: null,  goalWeight: 185,  color: '#f59e0b', observer: true },
]

export const COMPETITORS = PARTICIPANTS.filter(p => !p.observer)
export const OBSERVERS   = PARTICIPANTS.filter(p => p.observer)

export function goalWeight(p) {
  return p.startWeight * (1 - p.goalPercent)
}

export function dayOfCompetition() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(COMPETITION_START)
  start.setHours(0, 0, 0, 0)
  return Math.max(1, Math.floor((today - start) / 86400000) + 1)
}

export function toDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export function todayStr() {
  return toDateStr(new Date())
}

/**
 * Build per-participant stats from a list of log entries.
 * logs: [{ participant, date (YYYY-MM-DD), weight }]
 */
export function computeStats(participant, logs) {
  const myLogs = logs
    .filter(l => l.participant === participant.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const weighIns = myLogs.length
  // Observers use first log as baseline; competitors use hardcoded startWeight
  const effectiveStart = participant.startWeight ?? (weighIns > 0 ? myLogs[0].weight : null)
  const current = weighIns > 0 ? myLogs[myLogs.length - 1].weight : effectiveStart
  const goal = participant.goalPercent != null && effectiveStart != null
    ? goalWeight({ ...participant, startWeight: effectiveStart })
    : participant.goalWeight ?? null
  const lost = effectiveStart != null && current != null ? effectiveStart - current : 0
  const pctLost = effectiveStart ? lost / effectiveStart : 0
  const remaining = goal != null ? current - goal : null
  const pctToGoal = goal != null && effectiveStart != null ? lost / (effectiveStart - goal) : 0

  // Loss streak: walk forward through all logs, recording every completed streak
  // and tracking the current (active) one. A "streak" = consecutive entries where
  // each weight is LESS THAN OR EQUAL TO the previous (i.e., no gains).
  // Only an actual weight gain breaks the streak; flat days count.
  let streak = 0          // current ongoing streak
  let prevBestStreak = 0  // longest PRIOR completed streak (not counting the active one)
  let run = 0
  for (let i = 1; i < myLogs.length; i++) {
    if (myLogs[i].weight <= myLogs[i - 1].weight) {
      run++
    } else {
      if (run > prevBestStreak) prevBestStreak = run
      run = 0
    }
  }
  streak = run // whatever's still going at the end is the active streak

  // Pace: linear regression over rolling 21-day window, requires 7+ weigh-ins
  const ROLLING_DAYS = 21
  const MIN_WEIGH_INS = 7
  let pace = null        // simple average: displayed in UI
  let regressionPace = null  // regression slope: used for forecasting
  let projectedFinish = null
  let projectedEndWeight = null
  let regressionData = null

  // Simple average pace for display
  if (weighIns >= 2) {
    const firstDate = new Date(myLogs[0].date)
    const lastDate = new Date(myLogs[myLogs.length - 1].date)
    const daysElapsed = Math.max(1, (lastDate - firstDate) / 86400000)
    pace = lost / daysElapsed
  }

  if (weighIns >= MIN_WEIGH_INS) {
    const windowLast = new Date(myLogs[myLogs.length - 1].date)
    const cutoff = new Date(windowLast)
    cutoff.setDate(cutoff.getDate() - ROLLING_DAYS)
    const windowLogs = myLogs.filter(l => new Date(l.date) >= cutoff)

    // Least-squares linear regression: x = days elapsed, y = weight
    const origin = new Date(windowLogs[0].date).getTime()
    const pts = windowLogs.map(l => ({
      x: (new Date(l.date).getTime() - origin) / 86400000,
      y: l.weight,
    }))
    const n = pts.length
    const sumX  = pts.reduce((s, p) => s + p.x, 0)
    const sumY  = pts.reduce((s, p) => s + p.y, 0)
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0)
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    regressionPace = -slope

    // Projected weight at end of competition (June 1) — works for gain or loss
    const daysToEnd = Math.max(0, (COMPETITION_END - windowLast) / 86400000)
    projectedEndWeight = parseFloat((current - regressionPace * daysToEnd).toFixed(1))

    // Projected date of hitting goal (only meaningful if actively losing)
    if (regressionPace > 0 && remaining > 0) {
      const daysLeft = remaining / regressionPace
      projectedFinish = new Date(windowLast.getTime() + daysLeft * 86400000)
    }

    // Pass regression details for chart
    const originMs = new Date(windowLogs[0].date).getTime()
    const endDayX = (COMPETITION_END.getTime() - originMs) / 86400000
    regressionData = { pts, slope, intercept, originMs, endDayX, windowLogs, allLogs: myLogs }
  }

  return {
    participant,
    weighIns,
    current,
    effectiveStart,
    goal,
    lost,
    pctLost,
    remaining,
    pctToGoal,
    pace,
    projectedFinish,
    projectedEndWeight,
    regressionData,
    streak,
    prevBestStreak,
    logs: myLogs,
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatProjectedFinish(date) {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function rankParticipants(allStats) {
  const competitors = allStats.filter(s => !s.participant.observer)
  const observers   = allStats.filter(s =>  s.participant.observer)
  return [
    ...competitors.sort((a, b) => b.pctLost - a.pctLost),
    ...observers,
  ]
}
