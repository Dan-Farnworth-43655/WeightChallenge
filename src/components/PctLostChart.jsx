import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatDate, ACCOUNTABILITY_START } from '../utils/calculations'

function buildChartData(logs, participants) {
  // Only consider logs from the accountability era
  const eraLogs = logs.filter(l => l.date >= ACCOUNTABILITY_START)
  const dateSet = new Set(eraLogs.map(l => l.date))
  const dates = [...dateSet].sort()

  // Per-participant baseline = their first log in the accountability era
  const effectiveStart = {}
  for (const p of participants) {
    const first = eraLogs.filter(l => l.participant === p.id).sort((a, b) => a.date.localeCompare(b.date))[0]
    effectiveStart[p.id] = first ? first.weight : null
  }

  return dates.map(date => {
    const point = { date, label: formatDate(date) }
    for (const p of participants) {
      const start = effectiveStart[p.id]
      if (start == null) continue
      const entry = eraLogs.find(l => l.participant === p.id && l.date === date)
      if (entry) {
        point[p.id] = parseFloat(((start - entry.weight) / start * 100).toFixed(2))
      }
    }
    return point
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value?.toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

export default function PctLostChart({ logs, participants }) {
  const data = buildChartData(logs, participants)
  if (data.length === 0) return <p className="text-slate-500 text-sm text-center py-4">No data yet</p>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => {
            const p = participants.find(p => p.id === value)
            return <span style={{ color: p?.color }}>{p?.name ?? value}</span>
          }}
        />
        {participants.map(p => (
          <Line
            key={p.id}
            type="monotone"
            dataKey={p.id}
            name={p.id}
            stroke={p.color}
            strokeWidth={2}
            dot={{ fill: p.color, r: 4 }}
            connectNulls
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
