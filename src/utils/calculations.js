// Participant configuration — each person has their own goal and milestones.
// Goals: { weight, date }. Milestones: array of { weight, date } (date optional).
// Milestones should be ordered from highest weight to lowest (i.e. earliest to latest in the journey).
export const PARTICIPANTS = [
  {
    id: 'javin', name: 'Javin', initials: 'JT', color: '#0ea5e9',
    goal: { weight: 190, date: '2026-08-31' },
    milestones: [],
  },
  {
    id: 'dan', name: 'Dan', initials: 'DF', color: '#a78bfa',
    goal: { weight: 175, date: '2026-08-31' },
    milestones: [
      { weight: 180, date: '2026-07-15' },
    ],
  },
  {
    id: 'paul', name: 'Paul', initials: 'PW', color: '#34d399',
    goal: { weight: 185, date: '2026-12-31' },
    milestones: [
      { weight: 207, date: '2026-07-31' },
      { weight: 195, date: '2026-09-30' },
    ],
  },
  {
    id: 'josh', name: 'Josh', initials: 'JR', color: '#f59e0b',
    goal: { weight: 185, date: '2026-09-30' },
    milestones: [
      { weight: 200, date: '2026-06-30' },
      { weight: 195, date: '2026-07-31' },
      { weight: 190, date: '2026-08-31' },
    ],
  },
]

export function toDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export function todayStr() {
  return toDateStr(new Date())
}

function parseDate(str) {
  return new Date(str + 'T00:00:00')
}

function daysBetween(fromDate, toDate) {
  const a = new Date(fromDate); a.setHours(0, 0, 0, 0)
  const b = new Date(toDate);   b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / 86400000)
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
  const effectiveStart = weighIns > 0 ? myLogs[0].weight : null
  const current = weighIns > 0 ? myLogs[myLogs.length - 1].weight : null

  // Goal
  const goal     = participant.goal?.weight ?? null
  const goalDate = participant.goal?.date ? parseDate(participant.goal.date) : null

  const lost = effectiveStart != null && current != null ? effectiveStart - current : 0
  const pctLost = effectiveStart ? lost / effectiveStart : 0
  const remaining = goal != null && current != null ? current - goal : null
  const pctToGoal = goal != null && effectiveStart != null
    ? Math.max(0, Math.min(1, lost / (effectiveStart - goal)))
    : 0

  // Days to goal date + pace needed
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysToGoalDate = goalDate ? Math.max(0, daysBetween(today, goalDate)) : null
  const paceNeeded = (remaining != null && remaining > 0 && daysToGoalDate != null && daysToGoalDate > 0)
    ? remaining / daysToGoalDate
    : 0

  // Milestone progress — for each milestone, has it been hit? Earliest log date that
  // first dropped to or below the milestone weight wins.
  const milestones = (participant.milestones ?? []).map(m => {
    const hitLog = myLogs.find(l => l.weight <= m.weight)
    const hit = !!hitLog
    const targetDate = m.date ? parseDate(m.date) : null
    const daysToTarget = targetDate ? Math.max(0, daysBetween(today, targetDate)) : null
    const remainingToMilestone = current != null ? Math.max(0, current - m.weight) : null
    const paceNeededToMilestone = (remainingToMilestone != null && remainingToMilestone > 0 && daysToTarget != null && daysToTarget > 0)
      ? remainingToMilestone / daysToTarget
      : 0
    return {
      weight: m.weight,
      date: targetDate,
      dateStr: m.date ?? null,
      hit,
      hitDate: hitLog?.date ?? null,
      daysToTarget,
      remaining: remainingToMilestone,
      paceNeeded: paceNeededToMilestone,
    }
  })

  // Next active milestone = first one not yet hit
  const nextMilestone = milestones.find(m => !m.hit) ?? null
  // Goal achieved?
  const goalHit = goal != null && current != null && current <= goal

  // Loss streak (consecutive entries where weight <= previous; only gains break it)
  let streak = 0
  let prevBestStreak = 0
  let run = 0
  for (let i = 1; i < myLogs.length; i++) {
    if (myLogs[i].weight <= myLogs[i - 1].weight) {
      run++
    } else {
      if (run > prevBestStreak) prevBestStreak = run
      run = 0
    }
  }
  streak = run

  // Pace (simple average across all logs, for display)
  let pace = null
  if (weighIns >= 2) {
    const firstDate = new Date(myLogs[0].date)
    const lastDate  = new Date(myLogs[myLogs.length - 1].date)
    const daysElapsed = Math.max(1, (lastDate - firstDate) / 86400000)
    pace = lost / daysElapsed
  }

  // 21-day rolling least-squares regression for projections (requires 7+ weigh-ins)
  const ROLLING_DAYS = 21
  const MIN_WEIGH_INS = 7
  let regressionPace = null
  let projectedFinish = null      // Projected DATE of hitting goal
  let projectedGoalDateWeight = null  // Projected weight on goal date
  let regressionData = null

  if (weighIns >= MIN_WEIGH_INS) {
    const windowLast = new Date(myLogs[myLogs.length - 1].date)
    const cutoff = new Date(windowLast)
    cutoff.setDate(cutoff.getDate() - ROLLING_DAYS)
    const windowLogs = myLogs.filter(l => new Date(l.date) >= cutoff)

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

    // Projected weight on the user's goal date
    if (goalDate) {
      const daysToGoalEnd = Math.max(0, (goalDate - windowLast) / 86400000)
      projectedGoalDateWeight = parseFloat((current - regressionPace * daysToGoalEnd).toFixed(1))
    }

    // Projected date of hitting goal (only meaningful if actively losing)
    if (regressionPace > 0 && remaining > 0) {
      const daysLeft = remaining / regressionPace
      projectedFinish = new Date(windowLast.getTime() + daysLeft * 86400000)
    }

    const originMs = new Date(windowLogs[0].date).getTime()
    regressionData = { pts, slope, intercept, originMs, windowLogs, allLogs: myLogs }
  }

  return {
    participant,
    weighIns,
    current,
    effectiveStart,
    goal,
    goalDate,
    goalHit,
    lost,
    pctLost,
    remaining,
    pctToGoal,
    daysToGoalDate,
    paceNeeded,
    milestones,
    nextMilestone,
    pace,
    projectedFinish,
    projectedGoalDateWeight,
    regressionData,
    streak,
    prevBestStreak,
    logs: myLogs,
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatLongDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatProjectedFinish(date) {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Sort by % to goal (descending) so people closer to their own goal show up higher.
// This is not "ranked competition" — just a sensible ordering for the dashboard list.
export function sortByGoalProgress(allStats) {
  return [...allStats].sort((a, b) => b.pctToGoal - a.pctToGoal)
}
