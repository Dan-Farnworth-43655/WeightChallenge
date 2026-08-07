import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatDate } from '../utils/calculations'

function buildChartData(logs, participants) {
  // Collect all dates that have at least one log
  const dateSet = new Set(logs.map(l => l.date))
  const dates = [...dateSet].sort()

  return dates.map(date => {
    const point = { date, label: formatDate(date) }
    for (const p of participants) {
      const entry = logs.find(l => l.participant === p.id && l.date === date)
      if (entry) point[p.id] = entry.weight
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
          {p.name}: {p.value?.toFixed(1)} lbs
        </p>
      ))}
    </div>
  )
}

export default function WeightChart({ logs, participants }) {
  const data = buildChartData(logs, participants)
  if (data.length === 0) return <p className="text-slate-500 text-sm text-center py-4">No data yet</p>

  // Y axis domain: min/max weight with padding
  const allWeights = logs.map(l => l.weight)
  const minW = Math.floor(Math.min(...allWeights)) - 2
  const maxW = Math.ceil(Math.max(...allWeights)) + 2

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis domain={[minW, maxW]} tick={{ fill: '#64748b', fontSize: 11 }} />
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
            dot={false}
            connectNulls
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
