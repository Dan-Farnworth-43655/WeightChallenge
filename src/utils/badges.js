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

  // ── Goal achievements ──
  { id: 'first-milestone', emoji: '🥉', name: 'First Milestone', category: 'goals',
    description: 'Hit your first milestone weight',
    check: s => (s.milestones ?? []).some(m => m.hit) },
  { id: 'all-milestones',  emoji: '🥈', name: 'All Milestones',  category: 'goals',
    description: 'Hit every milestone',
    check: s => (s.milestones ?? []).length > 0 && (s.milestones ?? []).every(m => m.hit) },
  { id: 'goal-hit',        emoji: '🥇', name: 'Goal Crushed',    category: 'goals',
    description: 'Hit your final goal weight',
    check: s => !!s.goalHit },

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
