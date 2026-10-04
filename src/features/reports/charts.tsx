import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps } from '@/features/dashboard/chart-style'
import { ChartTooltip, LegendContent } from '@/features/dashboard/charts'
import { formatGTQCompact, formatPeriodShort } from '@/lib/format'

/** Pagos de cada mes separados en capital (lo que baja la deuda) e interés + cargos (costo). */
export function PaymentsSplitChart({ data }: { data: { periodo: string; capital: number; interes: number }[] }) {
  return (
    <figure>
      <div className="mb-3">
        <LegendContent
          items={[
            { label: 'Capital', color: 'var(--success)' },
            { label: 'Interés y cargos', color: 'var(--destructive)' },
          ]}
        />
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="periodo" tickFormatter={formatPeriodShort} minTickGap={8} {...axisProps} />
            <YAxis tickFormatter={formatGTQCompact} width={64} {...axisProps} />
            <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
            <Bar
              name="Capital"
              dataKey="capital"
              stackId="pago"
              fill="var(--success)"
              maxBarSize={28}
              isAnimationActive={false}
            />
            <Bar
              name="Interés y cargos"
              dataKey="interes"
              stackId="pago"
              fill="var(--destructive)"
              maxBarSize={28}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
