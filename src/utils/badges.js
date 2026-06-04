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

// All achievement badges. `check(stats)` returns true if the participant has earned it.
// Order matters — displayed in this order on the wall.
export const BADGES = [
  // ── Consistency (logging streaks) ──
  { id: 'first-log',      emoji: '🌱', name: 'First Step',        category: 'consistency',
    description: 'Logged your first weight',
    check: s => s.weighIns >= 1 },
  { id: 'log-streak-7',   emoji: '🔥', name: '7-Day Streak',      category: 'consistency',
    description: 'Logged 7 days in a row',
    check: s => s.bestLogStreak >= 7 },
  { id: 'log-streak-14',  emoji: '🔥', name: 'Two-Week Streak',   category: 'consistency',
    description: 'Logged 14 days in a row',
    check: s => s.bestLogStreak >= 14 },
  { id: 'log-streak-30',  emoji: '🔥', name: 'Month Streak',      category: 'consistency',
    description: 'Logged 30 days in a row',
    check: s => s.bestLogStreak >= 30 },
  { id: 'log-streak-60',  emoji: '💎', name: '60-Day Streak',     category: 'consistency',
    description: 'Logged 60 days in a row',
    check: s => s.bestLogStreak >= 60 },
  { id: 'log-streak-100', emoji: '💎', name: 'Century Streak',    category: 'consistency',
    description: 'Logged 100 days in a row',
    check: s => s.bestLogStreak >= 100 },

  // ── Weight loss milestones (5-lb increments) ──
  { id: 'lost-5',  emoji: '⭐', name: '5 lbs Down',  category: 'progress',
    description: 'Total weight lost: 5 lbs',  check: s => (s.lost ?? 0) >= 5 },
  { id: 'lost-10', emoji: '⭐', name: '10 lbs Down', category: 'progress',
    description: 'Total weight lost: 10 lbs', check: s => (s.lost ?? 0) >= 10 },
  { id: 'lost-15', emoji: '⭐', name: '15 lbs Down', category: 'progress',
    description: 'Total weight lost: 15 lbs', check: s => (s.lost ?? 0) >= 15 },
  { id: 'lost-20', emoji: '🏆', name: '20 lbs Down', category: 'progress',
    description: 'Total weight lost: 20 lbs', check: s => (s.lost ?? 0) >= 20 },
  { id: 'lost-25', emoji: '🏆', name: '25 lbs Down', category: 'progress',
    description: 'Total weight lost: 25 lbs', check: s => (s.lost ?? 0) >= 25 },
  { id: 'lost-30', emoji: '👑', name: '30+ lbs Down', category: 'progress',
    description: 'Total weight lost: 30+ lbs', check: s => (s.lost ?? 0) >= 30 },

  // ── Body-weight % (medical/health) ──
  { id: 'pct-5',  emoji: '🩺', name: 'Doctor Approved', category: 'progress',
    description: 'Lost 5% of body weight (clinically meaningful)',
    check: s => (s.pctLost ?? 0) >= 0.05 },
  { id: 'pct-10', emoji: '✨', name: '10% Down', category: 'progress',
    description: 'Lost 10% of body weight',
    check: s => (s.pctLost ?? 0) >= 0.10 },

  // ── Onederland (only if start ≥ 200) ──
  { id: 'onederland', emoji: '🎉', name: 'Onederland', category: 'progress',
    description: 'First log below 200 lbs',
    check: hadOnederland },

  // ── New Decade — crossed into a lower 10-lb range ──
  { id: 'new-decade', emoji: '📉', name: 'New Decade', category: 'progress',
    description: 'Crossed into a lower 10-lb range',
    check: hadNewDecade },

  // ── Weekly downtrend streaks ──
  { id: 'wave',    emoji: '🌊', name: 'Wave',    category: 'progress',
    description: '4 consecutive weeks of weekly-avg loss',
    check: s => bestWeeklyStreakEver(s) >= 4 },
  { id: 'tide',    emoji: '🌀', name: 'Tide',    category: 'progress',
    description: '8 consecutive weeks of weekly-avg loss',
    check: s => bestWeeklyStreakEver(s) >= 8 },
  { id: 'current', emoji: '⚡', name: 'Current', category: 'progress',
    description: '12 consecutive weeks of weekly-avg loss',
    check: s => bestWeeklyStreakEver(s) >= 12 },

  // ── Goal achievements ──
  // First Milestone fires if any configured milestone was hit, OR you've simply
  // lost 5+ lbs total — recognizing real progress for anyone who hasn't set
  // milestones yet or who hit informal ones before this tracker existed.
  { id: 'first-milestone', emoji: '🥉', name: 'First Milestone', category: 'goals',
    description: 'Hit your first milestone (or 5+ lbs lost)',
    check: s => (s.milestones ?? []).some(m => m.hit) || (s.lost ?? 0) >= 5 },
  { id: 'all-milestones',  emoji: '🥈', name: 'All Milestones',  category: 'goals',
    description: 'Hit every milestone',
    check: s => (s.milestones ?? []).length > 0 && (s.milestones ?? []).every(m => m.hit) },
  { id: 'goal-hit',        emoji: '🥇', name: 'Goal Crushed',    category: 'goals',
    description: 'Hit your final goal weight',
    check: s => !!s.goalHit },
  { id: 'past-goal',       emoji: '🚀', name: 'Past Goal',       category: 'goals',
    description: '14+ days sustained 1+ lb below your goal',
    check: hadSustainedPastGoal },
  { id: 'maintenance',     emoji: '🛡️', name: 'Maintenance Mode', category: 'goals',
    description: '4 weeks staying within 2 lbs of your goal',
    check: hadMaintenanceMode },

  // ── Commitment / time tracking ──
  { id: 'month-one', emoji: '📅', name: 'Month One', category: 'commitment',
    description: '30 days since your first log',
    check: s => daysSinceFirstLog(s) >= 30 },
  { id: 'the-og',    emoji: '🏛️', name: 'The OG',   category: 'commitment',
    description: '1 year tracking anniversary',
    check: s => daysSinceFirstLog(s) >= 365 },
  { id: 'hundred-club', emoji: '📒', name: 'Hundred Club', category: 'commitment',
    description: '100 total weigh-ins logged',
    check: s => (s.weighIns ?? 0) >= 100 },

  // ── Resilience ──
  { id: 'comeback-kid', emoji: '🔄', name: 'Comeback Kid', category: 'resilience',
    description: 'Hit a new PR within 14 days of a gain',
    check: hadComebackPR },
  { id: 'phoenix',      emoji: '🦅', name: 'Phoenix',      category: 'resilience',
    description: 'Came back from a 3+ lb gain to set a new PR',
    check: hadPhoenixPR },
  { id: 'monday-beast', emoji: '🌅', name: 'Monday Beast', category: 'resilience',
    description: 'Lost weight 4 Mondays in a row',
    check: hadMondayBeast },

  // ── Quirky ──
  { id: 'honest',  emoji: '🐷', name: 'Honest',  category: 'character',
    description: 'Logged a weight gain (it happens, keep going)',
    check: s => (s.logs ?? []).some((l, i, arr) => i > 0 && l.weight > arr[i - 1].weight) },
]

// Returns the list of earned badge IDs for a participant's stats.
export function earnedBadges(stats) {
  return BADGES.filter(b => {
    try { return b.check(stats) } catch (e) { return false }
  }).map(b => b.id)
}
