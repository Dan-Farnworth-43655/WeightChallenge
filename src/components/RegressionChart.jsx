import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer
} from 'recharts'
import { formatDate } from '../utils/calculations'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  const actual = point.actual ?? null
  const pace   = point.pace  ?? null
  if (actual == null && pace == null) return null

  const diff = actual != null && pace != null ? actual - pace : null
  const isFuture = actual == null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">
        {point.label}{isFuture ? ' · projected' : ''}
      </p>
      {actual != null && (
        <p className="font-semibold text-white">Actual: {actual.toFixed(1)} lbs</p>
      )}
      {pace != null && (
        <p className={isFuture ? 'font-semibold text-white' : 'text-slate-400'}>
          Target: {pace.toFixed(1)} lbs
        </p>
      )}
      {diff != null && (
        <p className={`font-semibold mt-0.5 ${diff <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {diff <= 0 ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} lbs {diff <= 0 ? 'ahead' : 'behind'}
        </p>
      )}
    </div>
  )
}

export default function RegressionChart({ regressionData, color, goal, startWeight, goalDate, milestones }) {
  if (!regressionData) return null

  const { slope, intercept, originMs, windowLogs, allLogs } = regressionData
  const sourceLogs = allLogs ?? windowLogs

  // Chart bounds: first log → goalDate (or +3 months out if no goalDate)
  const firstLogMs = new Date(sourceLogs[0].date).getTime()
  let endMs
  if (goalDate) {
    endMs = new Date(goalDate).getTime()
  } else {
    const threeMonthsOut = new Date()
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3)
    endMs = threeMonthsOut.getTime()
  }
  const chartOriginMs = firstLogMs
  const totalDays = Math.max(1, (endMs - chartOriginMs) / 86400000)
  const days = Math.ceil(totalDays)

  const regOffsetDays = (originMs - chartOriginMs) / 86400000
  const windowDateSet = new Set(windowLogs.map(l => l.date))

  // Regression value at any day x (relative to chartOrigin)
  const regressionAtDay = (x) => intercept + slope * (x - regOffsetDays)

  // Build a lookup of actual weights by date string
  const actualByDate = {}
  for (const l of sourceLogs) actualByDate[l.date] = l.weight

  // Build target path: start → each dated milestone → goal.
  // The pace line bends through each milestone instead of being a straight line.
  const targetPoints = [{ x: 0, y: startWeight }]
  const datedMilestones = (milestones ?? [])
    .filter(m => m.date)
    .map(m => ({
      x: (m.date.getTime() - chartOriginMs) / 86400000,
      y: m.weight,
      milestone: m,
    }))
    .filter(p => p.x >= 0 && p.x <= totalDays)
    .sort((a, b) => a.x - b.x)
  targetPoints.push(...datedMilestones)
  if (goal != null) targetPoints.push({ x: totalDays, y: goal })
  // De-duplicate consecutive points at same x (rare edge case)
  for (let i = targetPoints.length - 1; i > 0; i--) {
    if (targetPoints[i].x === targetPoints[i - 1].x) targetPoints.splice(i, 1)
  }

  // Compute the target weight at any day x by linearly interpolating between
  // consecutive target points (start → m1 → m2 → ... → goal).
  const paceAtDay = (x) => {
    if (targetPoints.length < 2) return null
    if (x <= targetPoints[0].x) return targetPoints[0].y
    if (x >= targetPoints[targetPoints.length - 1].x) return targetPoints[targetPoints.length - 1].y
    for (let i = 0; i < targetPoints.length - 1; i++) {
      const a = targetPoints[i], b = targetPoints[i + 1]
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x)
        return a.y + (b.y - a.y) * t
      }
    }
    return null
  }

  // Unified day-by-day dataset
  const data = Array.from({ length: days + 1 }, (_, i) => {
    const dateMs  = chartOriginMs + i * 86400000
    const dateStr = new Date(dateMs).toISOString().split('T')[0]
    const actualW = actualByDate[dateStr] ?? null
    const paceW   = paceAtDay(i)
    return {
      x:        i,
      label:    new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual:   actualW,
      pace:     paceW != null ? parseFloat(paceW.toFixed(1)) : null,
      regression: parseFloat((intercept + slope * (i - regOffsetDays)).toFixed(1)),
      inWindow: actualW != null && windowDateSet.has(dateStr),
    }
  })

  // For each dated milestone, determine on-track status:
  //   - hit:        already crossed (any prior log <= milestone weight)
  //   - onTrack:    regression projects to hit by milestone date
  //   - behind:     regression projects to miss by milestone date
  const milestoneMarkers = datedMilestones.map(p => {
    const m = p.milestone
    const regAtMilestone = regressionAtDay(p.x)
    const onTrack = regAtMilestone <= p.y
    const status = m.hit ? 'hit' : onTrack ? 'on-track' : 'behind'
    return { x: p.x, y: p.y, status, milestone: m }
  })

  // Y axis bounds — include all weights, regression endpoints, goal, milestones
  const allWeights  = sourceLogs.map(l => l.weight)
  const regStart    = intercept + slope * (0 - regOffsetDays)
  const regEnd      = intercept + slope * (days - regOffsetDays)
  const milestoneYs = datedMilestones.map(p => p.y)
  const allY = [...allWeights, regStart, regEnd, ...(goal != null ? [goal] : []), startWeight, ...milestoneYs].filter(Boolean)
  const minY = Math.floor(Math.min(...allY)) - 2
  const maxY = Math.ceil(Math.max(...allY)) + 2

  // X axis ticks
  const ticks = [0, Math.round(days / 3), Math.round(days * 2 / 3), days]

  // Custom dot for actual weigh-ins: bright if in 21-day window, dim if older
  const ActualDot = (props) => {
    const { cx, cy, payload } = props
    if (payload.actual == null) return null
    return (
      <circle
        cx={cx} cy={cy}
        r={payload.inWindow ? 4 : 3}
        fill={color}
        fillOpacity={payload.inWindow ? 1 : 0.3}
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="x"
          type="number"
          scale="linear"
          domain={[0, days]}
          ticks={ticks}
          tickFormatter={x => {
            const d = new Date(chartOriginMs + x * 86400000)
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }}
          tick={{ fill: '#64748b', fontSize: 10 }}
        />
        <YAxis domain={[minY, maxY]} tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip content={<CustomTooltip />} />

        {/* Goal weight horizontal reference line */}
        {goal != null && (
          <ReferenceLine y={goal} stroke={color} strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: 'Goal', fill: color, fontSize: 10, position: 'insideTopRight' }} />
        )}

        {/* Target path — bends through each milestone */}
        {targetPoints.length >= 2 && (
          <Line
            dataKey="pace"
            stroke="#ffffff"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: '#ffffff', strokeWidth: 0 }}
          />
        )}

        {/* Regression trend line */}
        <Line
          dataKey="regression"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={false}
        />

        {/* Actual weigh-ins as dots */}
        <Line
          dataKey="actual"
          stroke="transparent"
          dot={<ActualDot />}
          activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Milestone target markers — color-coded by status */}
        {milestoneMarkers.map((mk, i) => {
          const fill = mk.status === 'hit'      ? '#10b981'   // emerald
                     : mk.status === 'on-track' ? '#34d399'   // lighter emerald
                     :                            '#ef4444'   // red — behind
          const symbol = mk.status === 'hit' ? '✓' : null
          return (
            <ReferenceDot
              key={i}
              x={mk.x}
              y={mk.y}
              r={6}
              fill={fill}
              stroke="#0f172a"
              strokeWidth={2}
              ifOverflow="extendDomain"
              label={symbol ? {
                value: symbol,
                fill: '#ffffff',
                fontSize: 9,
                fontWeight: 'bold',
              } : undefined}
            />
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
