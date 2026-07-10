// Date after which non-retroactive badges become trackable. Streaks, %-based
// loss, decade crossings, comeback events, etc. only count for logs on or
// after this date — so people don't immediately unlock streak badges based
// on competition-era history. Cumulative pound milestones and Onederland
// remain lifetime-retroactive because they reflect total progress.
export const BADGES_CUTOFF = '2026-06-03'

function logsFromCutoff(stats) {
  return (stats.logs ?? []).filter(l => l.date >= BADGES_CUTOFF)
}

// Best consecutive-day logging streak using only post-cutoff logs.
function bestLogStreakSinceCutoff(stats) {
  const dates = [...new Set(logsFromCutoff(stats).map(l => l.date))].sort()
  if (dates.length === 0) return 0
  let best = 1, run = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00')
    const curr = new Date(dates[i] + 'T00:00:00')
    if (Math.round((curr - prev) / 86400000) === 1) { run++; if (run > best) best = run }
    else run = 1
  }
  return best
}

// % body weight lost using post-cutoff baseline (first log on/after cutoff vs
// the LOWEST weight reached since) — badges are earned forever, so a later
// regain never un-earns them.
function pctLostSinceCutoff(stats) {
  const logs = logsFromCutoff(stats).sort((a, b) => a.date.localeCompare(b.date))
  if (logs.length < 2) return 0
  const baseline = logs[0].weight
  const lowest   = Math.min(...logs.map(l => l.weight))
  return baseline ? (baseline - lowest) / baseline : 0
}

// Most total lbs ever lost: first log ever vs the lowest weight ever reached.
// Used for the lbs-down badges so they stay earned through a regain.
function maxLostEver(stats) {
  const logs = stats.logs ?? []
  if (logs.length === 0 || stats.effectiveStart == null) return 0
  const lowest = Math.min(...logs.map(l => l.weight))
  return stats.effectiveStart - lowest
}

// Best week-over-week loss streak using only post-cutoff logs.
// Same rule as the live weekly streak in calculations.js — weekly avg must
// hold within TOLERANCE of the current streak's lowest weekly avg (noise is
// forgiven, cumulative drift up is not) — and resets on any missing
// calendar-week gap.
function bestWeeklyStreakSinceCutoff(stats) {
  const TOLERANCE = 0.25
  const logs = logsFromCutoff(stats)
  if (logs.length === 0) return 0
  const weekly = {}
  for (const l of logs) {
    const d = new Date(l.date + 'T00:00:00')
    const dow = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const ws = monday.toISOString().split('T')[0]
    if (!weekly[ws]) weekly[ws] = { sum: 0, count: 0 }
    weekly[ws].sum   += l.weight
    weekly[ws].count++
  }
  const entries = Object.keys(weekly).sort().map(k => ({
    ws:  k,
    avg: weekly[k].sum / weekly[k].count,
  }))
  const weeksBetween = (a, b) => Math.round(
    (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000 / 7
  )
  let best = 0, run = 0
  let runMin = entries.length > 0 ? entries[0].avg : null
  for (let i = 1; i < entries.length; i++) {
    const consecutive = weeksBetween(entries[i - 1].ws, entries[i].ws) === 1
    const withinBand  = entries[i].avg <= runMin + TOLERANCE
    if (consecutive && withinBand) {
      run++
      runMin = Math.min(runMin, entries[i].avg)
      if (run > best) best = run
    } else {
      run = 0
      runMin = entries[i].avg
    }
  }
  return best
}

function hadNewDecadeSinceCutoff(stats) {
  const logs = logsFromCutoff(stats).sort((a, b) => a.date.localeCompare(b.date))
  if (logs.length === 0) return false
  const startDecade = Math.floor(logs[0].weight / 10)
  return logs.some(l => Math.floor(l.weight / 10) < startDecade)
}

function hadComebackPRSinceCutoff(stats) {
  const sorted = logsFromCutoff(stats).sort((a, b) => a.date.localeCompare(b.date))
  let pr = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const log = sorted[i]
    if (log.weight < pr) {
      const logDate = new Date(log.date + 'T00:00:00')
      const fourteen = new Date(logDate); fourteen.setDate(fourteen.getDate() - 14)
      const cutStr = fourteen.toISOString().split('T')[0]
      const recent = sorted.slice(0, i).filter(l => l.date >= cutStr)
      if (pr !== Infinity && recent.some(l => l.weight > pr + 0.5)) return true
      pr = log.weight
    }
  }
  return false
}

function hadPhoenixPRSinceCutoff(stats) {
  const sorted = logsFromCutoff(stats).sort((a, b) => a.date.localeCompare(b.date))
  let pr = Infinity
  for (const log of sorted) {
    if (log.weight < pr) {
      if (pr !== Infinity && sorted.filter(l => l.date < log.date).some(l => l.weight >= log.weight + 3)) {
        return true
      }
      pr = log.weight
    }
  }
  return false
}

function hadMondayBeastSinceCutoff(stats) {
  const mondays = logsFromCutoff(stats)
    .filter(l => new Date(l.date + 'T00:00:00').getDay() === 1)
    .sort((a, b) => a.date.localeCompare(b.date))
  let run = 1
  for (let i = 1; i < mondays.length; i++) {
    if (mondays[i].weight < mondays[i - 1].weight) {
      run++
      if (run >= 4) return true
    } else {
      run = 1
    }
  }
  return false
}

// ── Helper functions for badge checks ──

function daysSinceFirstLog(stats) {
  if (!stats.logs?.length) return 0
  const first = new Date(stats.logs[0].date + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today - first) / 86400000)
}

// True if any new-PR log was preceded (within 14 days) by a log that gained
// at least 0.5 lbs above the prior PR — they bounced back fast.
function hadComebackPR(stats) {
  const sorted = [...(stats.logs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  let pr = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const log = sorted[i]
    if (log.weight < pr) {
      const logDate = new Date(log.date + 'T00:00:00')
      const cutoff  = new Date(logDate); cutoff.setDate(cutoff.getDate() - 14)
      const cutStr  = cutoff.toISOString().split('T')[0]
      const recent  = sorted.slice(0, i).filter(l => l.date >= cutStr)
      if (recent.some(l => l.weight > pr + 0.5)) return true
      pr = log.weight
    }
  }
  return false
}

// True if any new-PR log was preceded at some point by a log 3+ lbs above
// the eventual PR (a real setback they came back from).
function hadPhoenixPR(stats) {
  const sorted = [...(stats.logs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  let pr = Infinity
  for (const log of sorted) {
    if (log.weight < pr) {
      // Did any earlier log gain 3+ above the prior PR? (use current weight as floor of comparison)
      if (sorted.filter(l => l.date < log.date).some(l => l.weight >= log.weight + 3)) {
        // And was the prior PR not also already this low? (avoids triggering on first log)
        if (pr !== Infinity) return true
      }
      pr = log.weight
    }
  }
  return false
}

// True if 4+ consecutive Monday logs each weighed less than the previous Monday's log.
function hadMondayBeast(stats) {
  const mondays = (stats.logs ?? [])
    .filter(l => new Date(l.date + 'T00:00:00').getDay() === 1)
    .sort((a, b) => a.date.localeCompare(b.date))
  let run = 1
  for (let i = 1; i < mondays.length; i++) {
    if (mondays[i].weight < mondays[i - 1].weight) {
      run++
      if (run >= 4) return true
    } else {
      run = 1
    }
  }
  return false
}

// True if there was a stretch of 14+ days where every log was at least 1 lb
// below the participant's goal weight (sustained maintenance / overshoot).
function hadSustainedPastGoal(stats) {
  if (stats.goal == null) return false
  const threshold = stats.goal - 1
  const sorted = [...(stats.logs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  let runStart = null
  let lastBelow = null
  for (const log of sorted) {
    if (log.weight <= threshold) {
      if (runStart == null) runStart = log.date
      lastBelow = log.date
    } else {
      if (runStart && lastBelow) {
        const days = (new Date(lastBelow) - new Date(runStart)) / 86400000
        if (days >= 14) return true
      }
      runStart = null
      lastBelow = null
    }
  }
  if (runStart && lastBelow) {
    const days = (new Date(lastBelow) - new Date(runStart)) / 86400000
    if (days >= 14) return true
  }
  return false
}

// Onederland: only relevant if their starting weight was 200+ AND they have a log under 200.
function hadOnederland(stats) {
  if (!stats.effectiveStart || stats.effectiveStart < 200) return false
  return (stats.logs ?? []).some(l => l.weight < 200)
}

// New Decade: crossed into a lower 10-lb range at any point.
// E.g., started in 220s and any log <= 219.9 → earned.
function hadNewDecade(stats) {
  if (!stats.effectiveStart) return false
  const startDecade = Math.floor(stats.effectiveStart / 10)
  return (stats.logs ?? []).some(l => Math.floor(l.weight / 10) < startDecade)
}

// Maintenance Mode: after first hitting goal, 28+ days where every log stayed
// within [goal - 2, goal + 2] (didn't bounce back up or way past it).
function hadMaintenanceMode(stats) {
  if (stats.goal == null) return false
  const lower = stats.goal - 2
  const upper = stats.goal + 2
  const sorted = [...(stats.logs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const firstHitIdx = sorted.findIndex(l => l.weight <= stats.goal)
  if (firstHitIdx === -1) return false
  let runStart = null
  let lastInRange = null
  for (let i = firstHitIdx; i < sorted.length; i++) {
    const log = sorted[i]
    if (log.weight >= lower && log.weight <= upper) {
      if (runStart == null) runStart = log.date
      lastInRange = log.date
      const days = (new Date(lastInRange) - new Date(runStart)) / 86400000
      if (days >= 28) return true
    } else {
      runStart = null
      lastInRange = null
    }
  }
  return false
}

// "Best weekly streak ever" = max(current, prevBest) — used by Wave/Tide/Current.
function bestWeeklyStreakEver(stats) {
  return Math.max(stats.streak ?? 0, stats.prevBestStreak ?? 0)
}

// Returns a near-miss message if you're close to a lbs-lost threshold (within 1 lb).
function nearLbsLost(threshold) {
  return s => {
    const lost = s.lost ?? 0
    if (lost >= threshold) return null
    const remaining = threshold - lost
    if (remaining > 1) return null
    return `Just ${remaining.toFixed(1)} lbs to go!`
  }
}

function nearPctLost(threshold) {
  return s => {
    const pct = s.pctLost ?? 0
    if (pct >= threshold) return null
    const remaining = threshold - pct
    if (remaining > 0.01) return null
    return `${(remaining * 100).toFixed(1)}% more body weight!`
  }
}

function nearLogStreak(target) {
  return s => {
    const cur = s.logStreak ?? 0
    if (cur >= target) return null
    const left = target - cur
    if (left > 2) return null
    return left === 1 ? 'Log tomorrow to unlock!' : `Only ${left} more days!`
  }
}

function nearWeeklyStreak(target) {
  return s => {
    const cur = bestWeeklyStreakEver(s)
    if (cur >= target) return null
    const left = target - cur
    if (left > 1) return null
    return 'One more week of weekly-avg loss!'
  }
}

function nearWeighIns(target) {
  return s => {
    const cur = s.weighIns ?? 0
    if (cur >= target) return null
    const left = target - cur
    if (left > 5) return null
    return `Only ${left} more logs!`
  }
}

function nearDaysTracking(target) {
  return s => {
    if (!s.logs?.length) return null
    const first = new Date(s.logs[0].date + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = Math.floor((today - first) / 86400000)
    if (days >= target) return null
    const left = target - days
    if (left > 7) return null
    return `${left} ${left === 1 ? 'day' : 'days'} away!`
  }
}

function nearOnederland(s) {
  if (!s.effectiveStart || s.effectiveStart < 200) return null
  if (s.current == null || s.current < 200) return null
  const remaining = s.current - 199.9
  if (remaining > 3) return null
  return `${remaining.toFixed(1)} lbs from the 100s!`
}

function nearNewDecade(s) {
  if (!s.effectiveStart || s.current == null) return null
  const startDecade   = Math.floor(s.effectiveStart / 10)
  const currentDecade = Math.floor(s.current / 10)
  if (currentDecade < startDecade) return null // already crossed at least once
  // distance to dropping below the next decade boundary (current decade floor)
  const nextThreshold = currentDecade * 10
  const remaining = s.current - (nextThreshold - 0.1)
  if (remaining > 2) return null
  return `${remaining.toFixed(1)} lbs to drop into the ${nextThreshold - 10}s!`
}

function nearGoalHit(s) {
  if (s.goalHit || s.goal == null || s.current == null) return null
  const remaining = s.current - s.goal
  if (remaining <= 0 || remaining > 2) return null
  return `${remaining.toFixed(1)} lbs from your goal!`
}

// All achievement badges. `check(stats)` returns true if the participant has earned it.
// Order matters — displayed in this order on the wall.
export const BADGES = [
  // ── Consistency (logging streaks) ──
  { id: 'first-log',      emoji: '🌱', name: 'First Step',        category: 'consistency',
    description: 'Logged your first weight',
    check: s => s.weighIns >= 1 },
  { id: 'log-streak-7',   emoji: '🔥', name: '7-Day Streak',      category: 'consistency',
    description: 'Logged 7 days in a row',
    check: s => bestLogStreakSinceCutoff(s) >= 7,
    closeTo: nearLogStreak(7) },
  { id: 'log-streak-14',  emoji: '🔥', name: 'Two-Week Streak',   category: 'consistency',
    description: 'Logged 14 days in a row',
    check: s => bestLogStreakSinceCutoff(s) >= 14,
    closeTo: nearLogStreak(14) },
  { id: 'log-streak-30',  emoji: '🔥', name: 'Month Streak',      category: 'consistency',
    description: 'Logged 30 days in a row',
    check: s => bestLogStreakSinceCutoff(s) >= 30,
    closeTo: nearLogStreak(30) },
  { id: 'log-streak-60',  emoji: '💎', name: '60-Day Streak',     category: 'consistency',
    description: 'Logged 60 days in a row',
    check: s => bestLogStreakSinceCutoff(s) >= 60,
    closeTo: nearLogStreak(60) },
  { id: 'log-streak-100', emoji: '💎', name: 'Century Streak',    category: 'consistency',
    description: 'Logged 100 days in a row',
    check: s => bestLogStreakSinceCutoff(s) >= 100,
    closeTo: nearLogStreak(100) },

  // ── Weight loss milestones (5-lb increments) — once earned, kept forever
  //    (based on the lowest weight ever reached, not current weight) ──
  { id: 'lost-5',  emoji: '⭐', name: '5 lbs Down',  category: 'progress',
    description: 'Total weight lost: 5 lbs',  check: s => maxLostEver(s) >= 5,  closeTo: nearLbsLost(5) },
  { id: 'lost-10', emoji: '⭐', name: '10 lbs Down', category: 'progress',
    description: 'Total weight lost: 10 lbs', check: s => maxLostEver(s) >= 10, closeTo: nearLbsLost(10) },
  { id: 'lost-15', emoji: '⭐', name: '15 lbs Down', category: 'progress',
    description: 'Total weight lost: 15 lbs', check: s => maxLostEver(s) >= 15, closeTo: nearLbsLost(15) },
  { id: 'lost-20', emoji: '🏆', name: '20 lbs Down', category: 'progress',
    description: 'Total weight lost: 20 lbs', check: s => maxLostEver(s) >= 20, closeTo: nearLbsLost(20) },
  { id: 'lost-25', emoji: '🏆', name: '25 lbs Down', category: 'progress',
    description: 'Total weight lost: 25 lbs', check: s => maxLostEver(s) >= 25, closeTo: nearLbsLost(25) },
  { id: 'lost-30', emoji: '👑', name: '30+ lbs Down', category: 'progress',
    description: 'Total weight lost: 30+ lbs', check: s => maxLostEver(s) >= 30, closeTo: nearLbsLost(30) },

  // ── Body-weight % (medical/health) — non-retroactive ──
  { id: 'pct-5',  emoji: '🩺', name: 'Doctor Approved', category: 'progress',
    description: 'Lost 5% of body weight (clinically meaningful) — earned going forward',
    check: s => pctLostSinceCutoff(s) >= 0.05,
    closeTo: s => {
      const pct = pctLostSinceCutoff(s)
      if (pct >= 0.05) return null
      const remaining = 0.05 - pct
      if (remaining > 0.01) return null
      return `${(remaining * 100).toFixed(1)}% more body weight!`
    } },
  { id: 'pct-10', emoji: '✨', name: '10% Down', category: 'progress',
    description: 'Lost 10% of body weight — earned going forward',
    check: s => pctLostSinceCutoff(s) >= 0.10,
    closeTo: s => {
      const pct = pctLostSinceCutoff(s)
      if (pct >= 0.10) return null
      const remaining = 0.10 - pct
      if (remaining > 0.01) return null
      return `${(remaining * 100).toFixed(1)}% more body weight!`
    } },

  // ── Onederland (retroactive — start ≥ 200 and any log < 200) ──
  { id: 'onederland', emoji: '🎉', name: 'Onederland', category: 'progress',
    description: 'First log below 200 lbs',
    check: hadOnederland, closeTo: nearOnederland },

  // ── New Decade — non-retroactive ──
  { id: 'new-decade', emoji: '📉', name: 'New Decade', category: 'progress',
    description: 'Crossed into a lower 10-lb range — earned going forward',
    check: hadNewDecadeSinceCutoff, closeTo: nearNewDecade },

  // ── Weekly downtrend streaks — non-retroactive ──
  { id: 'wave',    emoji: '🌊', name: 'Wave',    category: 'progress',
    description: '4 consecutive weeks of weekly-avg loss — earned going forward',
    check: s => bestWeeklyStreakSinceCutoff(s) >= 4,  closeTo: nearWeeklyStreak(4) },
  { id: 'tide',    emoji: '🌀', name: 'Tide',    category: 'progress',
    description: '8 consecutive weeks of weekly-avg loss — earned going forward',
    check: s => bestWeeklyStreakSinceCutoff(s) >= 8,  closeTo: nearWeeklyStreak(8) },
  { id: 'current', emoji: '⚡', name: 'Current', category: 'progress',
    description: '12 consecutive weeks of weekly-avg loss — earned going forward',
    check: s => bestWeeklyStreakSinceCutoff(s) >= 12, closeTo: nearWeeklyStreak(12) },

  // ── Goal achievements — once earned, kept forever (any historical log at or
  //    below the target counts, even if weight later bounced back above) ──
  { id: 'first-milestone', emoji: '🥉', name: 'First Milestone', category: 'goals',
    description: 'Hit your first configured milestone weight',
    check: s => (s.milestones ?? []).some(m => m.hitDate != null) },
  { id: 'all-milestones',  emoji: '🥈', name: 'All Milestones',  category: 'goals',
    description: 'Hit every milestone',
    check: s => (s.milestones ?? []).length > 0 && (s.milestones ?? []).every(m => m.hitDate != null) },
  { id: 'goal-hit',        emoji: '🥇', name: 'Goal Crushed',    category: 'goals',
    description: 'Hit your final goal weight',
    check: s => s.goal != null && (s.logs ?? []).some(l => l.weight <= s.goal),
    closeTo: nearGoalHit },
  { id: 'past-goal',       emoji: '🚀', name: 'Past Goal',       category: 'goals',
    description: '14+ days sustained 1+ lb below your goal',
    check: hadSustainedPastGoal },
  { id: 'maintenance',     emoji: '🛡️', name: 'Maintenance Mode', category: 'goals',
    description: '4 weeks staying within 2 lbs of your goal',
    check: hadMaintenanceMode },

  // ── Commitment / time tracking ──
  { id: 'month-one', emoji: '📅', name: 'Month One', category: 'commitment',
    description: '30 days since your first log',
    check: s => daysSinceFirstLog(s) >= 30,
    closeTo: nearDaysTracking(30) },
  { id: 'the-og',    emoji: '🏛️', name: 'The OG',   category: 'commitment',
    description: '1 year tracking anniversary',
    check: s => daysSinceFirstLog(s) >= 365,
    closeTo: nearDaysTracking(365) },
  { id: 'hundred-club', emoji: '📒', name: 'Hundred Club', category: 'commitment',
    description: '100 total weigh-ins logged',
    check: s => (s.weighIns ?? 0) >= 100,
    closeTo: nearWeighIns(100) },

  // ── Resilience — non-retroactive ──
  { id: 'comeback-kid', emoji: '🔄', name: 'Comeback Kid', category: 'resilience',
    description: 'Hit a new PR within 14 days of a gain — earned going forward',
    check: hadComebackPRSinceCutoff },
  { id: 'phoenix',      emoji: '🦅', name: 'Phoenix',      category: 'resilience',
    description: 'Came back from a 3+ lb gain to set a new PR — earned going forward',
    check: hadPhoenixPRSinceCutoff },
  { id: 'monday-beast', emoji: '🌅', name: 'Monday Beast', category: 'resilience',
    description: 'Lost weight 4 Mondays in a row — earned going forward',
    check: hadMondayBeastSinceCutoff },
]

// Returns the list of earned badge IDs for a participant's stats.
export function earnedBadges(stats) {
  return BADGES.filter(b => {
    try { return b.check(stats) } catch (e) { return false }
  }).map(b => b.id)
}

// Returns { badge, message } for the highest-priority unearned badge that is
// "almost there" based on the latest stats, or null if nothing is close.
// We pick the first badge in BADGES order so progress -> goals -> commitment
// gets priority — typically the most exciting one is shown.
export function nearestUnearnedBadge(stats) {
  for (const badge of BADGES) {
    let earned = false
    try { earned = badge.check(stats) } catch (e) { earned = false }
    if (earned) continue
    if (!badge.closeTo) continue
    let msg = null
    try { msg = badge.closeTo(stats) } catch (e) { msg = null }
    if (msg) return { badge, message: msg }
  }
  return null
}
