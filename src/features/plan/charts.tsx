import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps } from '@/features/dashboard/chart-style'
import { ChartTooltip, LegendContent } from '@/features/dashboard/charts'
import { formatGTQCompact, formatPeriodShort } from '@/lib/format'

export interface LineSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
}

/** Curvas de deuda por mes (metas de planes y deuda real) sobre el mismo eje. */
export function PlanLinesChart({
  data,
  series,
}: {
  data: { periodo: string; [key: string]: number | string | null }[]
  series: LineSeries[]
}) {
  return (
    <figure>
      <div className="mb-3">
        <LegendContent items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="periodo" tickFormatter={formatPeriodShort} minTickGap={16} {...axisProps} />
            <YAxis tickFormatter={formatGTQCompact} width={64} {...axisProps} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                name={s.label}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
