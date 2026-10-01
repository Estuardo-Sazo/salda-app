import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts'
import { formatGTQ, formatGTQCompact, formatPeriod, formatPeriodShort } from '@/lib/format'
import type { DashboardModel } from './model'

/** Color fijo por entidad (orden de prioridad de la deuda), nunca por ranking. */
const seriesColor = (index: number) => `var(--series-${(index % 8) + 1})`

const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value != null)
  if (!rows.length) return null
  return (
    <div className="bg-popover text-popover-foreground min-w-44 rounded-xl border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{formatPeriod(String(label))}</p>
      <ul className="grid gap-1">
        {rows.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="tabular font-medium">{formatGTQ(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LegendContent({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded"
            style={{
              background: i.dashed
                ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)`
                : i.color,
            }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function RealVsGoalChart({ data }: { data: DashboardModel['serie'] }) {
  return (
    <figure>
      <div className="mb-3">
        <LegendContent
          items={[
            { label: 'Real', color: 'var(--series-1)' },
            { label: 'Meta del plan', color: 'var(--muted-foreground)', dashed: true },
          ]}
        />
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="periodo" tickFormatter={formatPeriodShort} minTickGap={16} {...axisProps} />
            <YAxis tickFormatter={formatGTQCompact} width={64} {...axisProps} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
            <Line
              name="Meta"
              type="monotone"
              dataKey="meta"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              name="Real"
              type="monotone"
              dataKey="real"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer">Ver como tabla</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Mes</th>
                <th className="px-3 py-2 text-right font-medium">Real</th>
                <th className="px-3 py-2 text-right font-medium">Meta</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((r) => (
                <tr key={r.periodo} className="border-t">
                  <td className="px-3 py-1.5">{formatPeriod(r.periodo)}</td>
                  <td className="px-3 py-1.5 text-right">{r.real == null ? '—' : formatGTQ(r.real)}</td>
                  <td className="px-3 py-1.5 text-right">{r.meta == null ? '—' : formatGTQ(r.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

export function BalancesByDebtChart({
  data,
  debts,
}: {
  data: DashboardModel['barras']
  debts: DashboardModel['deudas']
}) {
  return (
    <figure>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="periodo" tickFormatter={formatPeriodShort} minTickGap={8} {...axisProps} />
            <YAxis tickFormatter={formatGTQCompact} width={64} {...axisProps} />
            <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
            <Legend
              itemSorter={null}
              verticalAlign="top"
              align="left"
              height={40}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
            />
            {debts.map((d, i) => (
              <Bar
                key={d.id}
                dataKey={d.id}
                name={d.nombre}
                stackId="saldo"
                fill={seriesColor(i)}
                stroke="var(--card)"
                strokeWidth={1}
                maxBarSize={24}
                radius={i === debts.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
