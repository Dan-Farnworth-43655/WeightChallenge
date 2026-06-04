// Always use relative URLs — Vercel serves frontend + API on same origin.
// For local dev, run `vercel dev` to get both served together on port 3000.
export async function fetchLogs() {
  const res = await fetch(`/api/logs`)
  if (!res.ok) throw new Error('Failed to fetch logs')
  return res.json()
}

export async function postLog(participant, date, weight) {
  const res = await fetch(`/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant, date, weight }),
  })
  if (!res.ok) throw new Error('Failed to save log')
  return res.json() // { ok, isPR }
}

export async function fetchPRs() {
  const res = await fetch(`/api/prs`)
  if (!res.ok) throw new Error('Failed to fetch PRs')
  return res.json()
}

export async function fetchGoals() {
  const res = await fetch(`/api/goals`)
  if (!res.ok) throw new Error('Failed to fetch goals')
  return res.json() // { [participantId]: { goal, milestones } }
}

export async function saveGoals(participant, goal, milestones) {
  const res = await fetch(`/api/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant, goal, milestones }),
  })
  if (!res.ok) throw new Error('Failed to save goals')
  return res.json()
}

export async function deleteLog(participant, date) {
  const res = await fetch(`/api/log`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant, date }),
  })
  if (!res.ok) throw new Error('Failed to delete log')
  return res.json()
}
