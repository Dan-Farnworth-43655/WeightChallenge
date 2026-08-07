// Participant configuration — each person has their own goal and milestones.
// Goals: { weight, date }. Milestones: array of { weight, date } (date optional).
// Milestones should be ordered from highest weight to lowest (i.e. earliest to latest in the journey).
export const PARTICIPANTS = [
  {
    id: 'javin', name: 'Javin', initials: 'JT', color: '#0ea5e9',
    goal: { weight: 190, date: '2026-08-31' },
    milestones: [
      { weight: 197, date: '2026-07-15' },
      { weight: 194, date: '2026-08-15' },
    ],
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

// Aggregate logs into daily / weekly / monthly buckets. Returns a new array
// of {participant, date, weight} where date is the period-start (Monday for
// weekly, 1st-of-month for monthly) and weight is the period's average.
// Daily passes through unchanged.
export function aggregateLogs(logs, granularity) {
  if (!granularity || granularity === 'daily') return logs
  const buckets = {}
  for (const log of logs) {
    const d = new Date(log.date + 'T00:00:00')
    let periodStart
    if (granularity === 'weekly') {
      const dow = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
      periodStart = monday.toISOString().split('T')[0]
    } else if (granularity === 'monthly') {
      periodStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    } else {
      periodStart = log.date
    }
    const key = `${log.participant}|${periodStart}`
    if (!buckets[key]) buckets[key] = { participant: log.participant, date: periodStart, sum: 0, count: 0 }
    buckets[key].sum   += log.weight
    buckets[key].count++
  }
  return Object.values(buckets).map(b => ({
    participant: b.participant,
    date: b.date,
    weight: parseFloat((b.sum / b.count).toFixed(2)),
  }))
}

// Returns YYYY-MM-DD of the Monday of the week containing dateStr.
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

/**
 * Merge a Redis-stored goal override into the participant config. Returns a new
 * participant object with goal + milestones replaced if an override exists.
 * If no override, returns the participant unchanged.
 */
export function applyGoalOverride(participant, overrides) {
  if (!overrides) return participant
  const override = overrides[participant.id]
  if (!override) return participant
  return {
    ...participant,
    goal:       override.goal ?? participant.goal,
    milestones: Array.isArray(override.milestones) ? override.milestones : participant.milestones,
  }
}

// Day-of-week analysis: average delta per weekday across all log-to-log transitions.
// Returns the best day (most negative avg) and worst day (most positive avg) with at
// least MIN_SAMPLES occurrences. Null if there isn't enough data.
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function analyzeDayOfWeek(myLogs) {
  const MIN_SAMPLES = 3
  const buckets = [[], [], [], [], [], [], []]
  for (let i = 1; i < myLogs.length; i++) {
    const delta = myLogs[i].weight - myLogs[i - 1].weight
    const dow = new Date(myLogs[i].date + 'T00:00:00').getDay()
    buckets[dow].push(delta)
  }
  const summary = buckets
    .map((deltas, dow) => deltas.length >= MIN_SAMPLES ? ({
      dow,
      name: DOW_NAMES[dow],
      count: deltas.length,
      avg: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    }) : null)
    .filter(Boolean)
  if (summary.length === 0) return null
  const best  = summary.reduce((a, b) => (a.avg < b.avg ? a : b))
  const worst = summary.reduce((a, b) => (a.avg > b.avg ? a : b))
  return { best, worst, all: summary }
}

// Weekly recap: on Mondays, summarize last Mon–Sun by comparing its average
// to the prior week's average. Same comparison rule as the streak — so if
// the recap shows a negative delta, the user has earned the flame.
// Returns null on non-Mondays or weeks with no logs in last week.
function weeklyRecap(myLogs) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (today.getDay() !== 1) return null

  const lastSun  = new Date(today);   lastSun.setDate(today.getDate() - 1)
  const lastMon  = new Date(lastSun); lastMon.setDate(lastSun.getDate() - 6)
  const priorSun = new Date(lastMon); priorSun.setDate(lastMon.getDate() - 1)
  const priorMon = new Date(priorSun); priorMon.setDate(priorSun.getDate() - 6)

  const fmt = d => d.toISOString().split('T')[0]
  const lastMonStr  = fmt(lastMon)
  const lastSunStr  = fmt(lastSun)
  const priorMonStr = fmt(priorMon)
  const priorSunStr = fmt(priorSun)

  const lastWeekLogs  = myLogs.filter(l => l.date >= lastMonStr  && l.date <= lastSunStr)
  const priorWeekLogs = myLogs.filter(l => l.date >= priorMonStr && l.date <= priorSunStr)
  if (lastWeekLogs.length === 0) return null

  const lastAvg  = lastWeekLogs.reduce((s, l) => s + l.weight, 0) / lastWeekLogs.length
  const priorAvg = priorWeekLogs.length > 0
    ? priorWeekLogs.reduce((s, l) => s + l.weight, 0) / priorWeekLogs.length
    : null
  const delta = priorAvg != null ? lastAvg - priorAvg : null

  return {
    weekStart: lastMon,
    weekEnd: lastSun,
    count: lastWeekLogs.length,
    delta,
    lastAvg,
    priorAvg,
    firstTrackedWeek: priorAvg == null,
    // ISO date string used as a localStorage dismissal key
    dismissKey: `recap_${lastMonStr}`,
  }
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
  // Baseline = the very first logged weight, so "Total Lost" reflects lifetime progress.
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

  // Milestone progress — a milestone is "hit" only if CURRENT weight is at or
  // below the milestone. If they briefly dropped under and bounced back above,
  // the milestone reverts to un-hit. hitDate still records the earliest
  // historical crossing for context.
  const milestones = (participant.milestones ?? []).map(m => {
    const hitLog = myLogs.find(l => l.weight <= m.weight)
    const hit    = current != null && current <= m.weight
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

  // Logging streak: consecutive calendar days (Central Time) with at least one log,
  // ending today. If today is missing, count back from the most recent log instead
  // and flag it as 'at risk' so the UI can show the streak as fading rather than gone.
  const loggedDateSet = new Set(myLogs.map(l => l.date))
  let logStreak = 0
  let logStreakAtRisk = false
  const todayDateStr = todayStr()
  if (loggedDateSet.has(todayDateStr)) {
    // Walk back from today
    let cursor = new Date(todayDateStr + 'T00:00:00')
    while (loggedDateSet.has(toDateStr(cursor))) {
      logStreak++
      cursor.setDate(cursor.getDate() - 1)
    }
  } else if (myLogs.length > 0) {
    // Today is missing — show the streak that ended at the last log, marked as at-risk
    const lastDate = myLogs[myLogs.length - 1].date
    let cursor = new Date(lastDate + 'T00:00:00')
    while (loggedDateSet.has(toDateStr(cursor))) {
      logStreak++
      cursor.setDate(cursor.getDate() - 1)
    }
    // Only flag as "at risk" if their last log was yesterday (streak still salvageable today)
    const yesterday = new Date(todayDateStr + 'T00:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    logStreakAtRisk = lastDate === toDateStr(yesterday) && logStreak >= 2
    // If last log is older than yesterday, the streak is already broken
    if (!logStreakAtRisk) logStreak = 0
  }

  // Best logging streak ever: longest run of consecutive calendar days with a log
  let bestLogStreak = 0
  if (myLogs.length > 0) {
    const sortedDates = [...new Set(myLogs.map(l => l.date))].sort()
    let run = 1
    bestLogStreak = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const prevD = new Date(sortedDates[i - 1] + 'T00:00:00')
      const currD = new Date(sortedDates[i] + 'T00:00:00')
      const diff = Math.round((currD - prevD) / 86400000)
      if (diff === 1) {
        run++
        if (run > bestLogStreak) bestLogStreak = run
      } else {
        run = 1
      }
    }
  }

  // Days since last log (for "you haven't logged in X days" indicator)
  let daysSinceLastLog = null
  if (myLogs.length > 0) {
    const lastDate = new Date(myLogs[myLogs.length - 1].date + 'T00:00:00')
    const today = new Date(todayDateStr + 'T00:00:00')
    daysSinceLastLog = Math.max(0, Math.round((today - lastDate) / 86400000))
  }

  // Weight-loss streak (WEEKLY): group logs by Mon–Sun, average each, then count
  // consecutive weeks where the avg holds at or below the LOWEST weekly avg of
  // the current streak, plus a small noise tolerance. Anchoring the tolerance
  // to the streak's low (instead of just the prior week) means tiny wiggles are
  // forgiven but consecutive small gains can't compound into a real uptrend
  // while the flame stays lit.
  const STREAK_MAINTENANCE_TOLERANCE = 0.25
  const weekAccum = {}
  for (const l of myLogs) {
    const ws = mondayOf(l.date)
    if (!weekAccum[ws]) weekAccum[ws] = { sum: 0, count: 0 }
    weekAccum[ws].sum += l.weight
    weekAccum[ws].count++
  }
  const weeklyAvgs = Object.keys(weekAccum)
    .sort()
    .map(ws => ({ weekStart: ws, avg: weekAccum[ws].sum / weekAccum[ws].count }))

  // Helper: number of calendar-weeks between two Monday-of-week date strings
  const weeksBetween = (a, b) => Math.round(
    (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000 / 7
  )

  // Only COMPLETED weeks count toward the streak — the current calendar week
  // is in progress, so its transition vs last week is not yet decided. This
  // keeps the streak in sync with the Monday recap's delta.
  const thisWeekMon = mondayOf(todayStr())
  const pastWeeks   = weeklyAvgs.filter(w => w.weekStart < thisWeekMon)

  let streak = 0
  let prevBestStreak = 0
  let run = 0
  // Lowest weekly avg seen in the current run — the anchor the tolerance is
  // measured against. Resets whenever the streak breaks.
  let runMin = pastWeeks.length > 0 ? pastWeeks[0].avg : null
  for (let i = 1; i < pastWeeks.length; i++) {
    // The streak only continues if the two weeks being compared are immediately
    // adjacent calendar weeks (no gaps) AND the avg held within tolerance of
    // the current streak's lowest weekly avg.
    const consecutive = weeksBetween(pastWeeks[i - 1].weekStart, pastWeeks[i].weekStart) === 1
    const withinBand  = pastWeeks[i].avg <= runMin + STREAK_MAINTENANCE_TOLERANCE
    if (consecutive && withinBand) {
      run++
      runMin = Math.min(runMin, pastWeeks[i].avg)
    } else {
      if (run > prevBestStreak) prevBestStreak = run
      run = 0
      runMin = pastWeeks[i].avg
    }
  }
  // Active-streak gate: the most recent COMPLETED week must be exactly "last
  // calendar week" (1 week before the current one). If the latest past week
  // is older than that, the streak is stale — preserve it as prevBestStreak.
  if (pastWeeks.length > 0) {
    const mostRecentPast = pastWeeks[pastWeeks.length - 1].weekStart
    if (weeksBetween(mostRecentPast, thisWeekMon) !== 1) {
      if (run > prevBestStreak) prevBestStreak = run
      run = 0
    }
  } else {
    // No completed weeks at all — no streak possible
    run = 0
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

  // Projection for the next milestone (or final goal if no remaining milestones):
  // when will the current regression pace get them there, and how many days off
  // are they vs the target date?
  let nextProjection = null
  if (regressionPace != null && current != null) {
    const nextTarget = nextMilestone
      ? { weight: nextMilestone.weight, date: nextMilestone.date, isGoal: false }
      : (goal != null && goalDate ? { weight: goal, date: goalDate, isGoal: true } : null)
    if (nextTarget && nextTarget.date) {
      const lbsToGo = Math.max(0, current - nextTarget.weight)
      if (regressionPace > 0 && lbsToGo > 0) {
        const daysToHit = lbsToGo / regressionPace
        const projectedHitDate = new Date(today.getTime() + daysToHit * 86400000)
        const daysOff = Math.round((projectedHitDate - nextTarget.date) / 86400000)
        nextProjection = {
          target: nextTarget,
          projectedHitDate,
          daysOff,                        // negative = ahead of pace
          status: daysOff <= 0 ? 'on-pace' : 'behind',
        }
      } else if (lbsToGo === 0) {
        nextProjection = { target: nextTarget, status: 'hit' }
      } else if (regressionPace <= 0) {
        // Trending flat or up — won't make it at this rate
        nextProjection = { target: nextTarget, status: 'not-on-pace' }
      }
    }
  }

  // Day-of-week analysis + weekly recap
  const dowAnalysis  = analyzeDayOfWeek(myLogs)
  const recap        = weeklyRecap(myLogs)

  // Week-over-week comparison: this week's avg vs last week's avg. Calendar
  // weeks (Mon-Sun). If the CURRENT week has no logs yet (common — you might
  // not have logged today), fall back one period so the card still shows:
  // last completed week's avg vs the week before that (same pair the Monday
  // recap uses). isCurrentWeek flags which pairing is being shown.
  let weekOverWeek = null
  if (myLogs.length > 0) {
    const todayDt = new Date(); todayDt.setHours(0, 0, 0, 0)
    const dow = todayDt.getDay()
    const thisMon = new Date(todayDt); thisMon.setDate(todayDt.getDate() - (dow === 0 ? 6 : dow - 1))
    const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7)
    const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1)
    const priorMon = new Date(lastMon); priorMon.setDate(lastMon.getDate() - 7)
    const priorSun = new Date(lastMon); priorSun.setDate(lastMon.getDate() - 1)
    const fmt = d => d.toISOString().split('T')[0]
    const thisMonStr = fmt(thisMon)
    const lastMonStr = fmt(lastMon)
    const lastSunStr = fmt(lastSun)
    const priorMonStr = fmt(priorMon)
    const priorSunStr = fmt(priorSun)

    const thisWeek = myLogs.filter(l => l.date >= thisMonStr)
    const lastWeek = myLogs.filter(l => l.date >= lastMonStr && l.date <= lastSunStr)
    const priorWeek = myLogs.filter(l => l.date >= priorMonStr && l.date <= priorSunStr)

    const avgOf = arr => arr.reduce((s, l) => s + l.weight, 0) / arr.length

    if (thisWeek.length > 0 && lastWeek.length > 0) {
      weekOverWeek = {
        thisAvg: avgOf(thisWeek),
        lastAvg: avgOf(lastWeek),
        delta: avgOf(thisWeek) - avgOf(lastWeek),
        thisCount: thisWeek.length,
        lastCount: lastWeek.length,
        isCurrentWeek: true,
      }
    } else if (lastWeek.length > 0 && priorWeek.length > 0) {
      // Fallback: current week has no logs yet — show the last completed pair
      weekOverWeek = {
        thisAvg: avgOf(lastWeek),
        lastAvg: avgOf(priorWeek),
        delta: avgOf(lastWeek) - avgOf(priorWeek),
        thisCount: lastWeek.length,
        lastCount: priorWeek.length,
        isCurrentWeek: false,
      }
    }
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
    logStreak,
    logStreakAtRisk,
    bestLogStreak,
    daysSinceLastLog,
    nextProjection,
    dowAnalysis,
    recap,
    weekOverWeek,
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
