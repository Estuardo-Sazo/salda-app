import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebtStatus, useMonthlyTotals, type DebtStatus, type MonthlyTotals } from '@/features/common/queries'
import { PlanLinesChart } from '@/features/plan/charts'
import { currentPeriod, formatDate, formatMoney, formatPercent, formatPeriod, formatPeriodLong } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useExpensesRange, usePaymentsRange } from './api'
import { PaymentsSplitChart } from './charts'
import {
  buildMonthlyReport,
  buildRangeReport,
  rangeOptions,
  type CategoryRow,
  type DebtBreakdown,
  type DebtRow,
  type TotalsRow,
} from './model'

const th = 'px-3 py-2 text-right font-medium whitespace-nowrap'
const td = 'px-3 py-1.5 text-right whitespace-nowrap'

const toTotals = (t: MonthlyTotals[]): TotalsRow[] => t
const toDebts = (d: DebtStatus[]): DebtRow[] =>
  d.map((x) => ({
    debt_id: x.debt_id,
    nombre: x.nombre,
    estado: x.estado,
    ultimo_pago: x.ultimo_pago ?? null,
    cerrada_en: x.cerrada_en ?? null,
    prioridad: x.prioridad ?? null,
  }))

function Kpi({
  icon: Icon,
  label,
  children,
  hint,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
        <span className="tabular text-xl font-semibold tracking-tight">{children}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardContent>
    </Card>
  )
}

/** Cambio de deuda: bajar es bueno. */
function DebtChange({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const bajo = value <= 0
  const Icon = bajo ? ArrowDownRight : ArrowUpRight
  return (
    <span className={cn('inline-flex items-center gap-1', bajo ? 'text-success' : 'text-destructive')}>
      <Icon className="size-5" aria-hidden />
      <span className="sr-only">{bajo ? 'Bajó' : 'Subió'}</span>
      {formatMoney(Math.abs(value))}
    </span>
  )
}

function InterestVsCapital({ rows }: { rows: DebtBreakdown[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Sin pagos en este período.</p>
  return (
    <ul className="grid gap-3">
      {rows.map((d) => {
        const pctInteres = d.pagado > 0 ? Math.min(1, Math.max(0, d.interesCargos / d.pagado)) : 0
        return (
          <li key={d.debtId} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">
                {d.nombre}
                {d.estimado && (
                  <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                    interés estimado
                  </Badge>
                )}
              </span>
              <Money value={d.pagado} className="font-medium" />
            </div>
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-success h-full" style={{ width: `${(1 - pctInteres) * 100}%` }} />
              <span className="bg-destructive h-full" style={{ width: `${pctInteres * 100}%` }} />
            </div>
            <p className="text-muted-foreground flex justify-between gap-3 text-xs">
              <span>
                Capital <Money value={d.capital} className="text-success font-medium" />
              </span>
              <span>
                Interés y cargos <Money value={d.interesCargos} className="text-destructive font-medium" /> (
                {formatPercent(pctInteres)})
              </span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function Categories({ rows }: { rows: CategoryRow[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Sin gastos registrados.</p>
  return (
    <ul className="grid gap-2.5">
      {rows.map((c) => (
        <li key={c.categoria} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              {c.categoria} <span className="text-muted-foreground text-xs">· {c.cantidad}</span>
            </span>
            <span className="tabular">
              {formatMoney(c.monto)} <span className="text-muted-foreground text-xs">{formatPercent(c.porcentaje)}</span>
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-primary block h-full rounded-full" style={{ width: `${c.porcentaje * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PeriodSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-muted-foreground text-sm font-normal">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ------------------------------------------------------------------ mensual */

function MonthlyTab({ totals, debts }: { totals: TotalsRow[]; debts: DebtRow[] }) {
  const actual = currentPeriod()
  const periodos = useMemo(
    () =>
      totals
        .map((t) => t.periodo)
        .filter((p) => p <= actual)
        .reverse(),
    [totals, actual],
  )
  const [periodo, setPeriodo] = useState(periodos[0] ?? actual)
  const payments = usePaymentsRange(periodo, periodo)
  const expenses = useExpensesRange(periodo, periodo)

  const error = payments.error ?? expenses.error
  const r = useMemo(
    () =>
      payments.data && expenses.data ? buildMonthlyReport(periodo, totals, payments.data, expenses.data, debts) : null,
    [periodo, totals, payments.data, expenses.data, debts],
  )

  return (
    <div className="grid gap-4">
      <PeriodSelect
        id="reporte-mes"
        label="Mes"
        value={periodo}
        onChange={setPeriodo}
        options={periodos.map((p) => ({ value: p, label: formatPeriodLong(p) }))}
      />
      {error ? (
        <ErrorState error={error} />
      ) : !r ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Wallet} label="Pagado a deudas" hint={`${r.pagos.length} pagos`}>
              {formatMoney(r.totales?.pagos)}
            </Kpi>
            <Kpi icon={PiggyBank} label="Capital" hint="lo que bajó la deuda">
              <span className="text-success">{formatMoney(r.totales?.capital)}</span>
            </Kpi>
            <Kpi icon={Receipt} label="Interés y cargos" hint={`${formatPercent(r.pctInteres)} de lo pagado`}>
              <span className="text-destructive">{formatMoney(r.totales?.interes_cargos)}</span>
            </Kpi>
            <Kpi icon={ArrowDownRight} label="Deuda real" hint="vs mes anterior">
              <DebtChange value={r.cambioDeuda} />
            </Kpi>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Interés vs capital</CardTitle>
                <CardDescription>Cuánto de cada pago bajó la deuda</CardDescription>
              </CardHeader>
              <CardContent>
                <InterestVsCapital rows={r.porDeuda} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flujo del mes</CardTitle>
                <CardDescription>Lo que entra menos lo que sale</CardDescription>
              </CardHeader>
              <CardContent>
                {r.flujo.ingreso == null ? (
                  <p className="text-muted-foreground text-sm">
                    Registrá tu ingreso mensual para ver el flujo.{' '}
                    <Link to="/mas" className="text-primary font-medium underline-offset-4 hover:underline">
                      Ir a Más
                    </Link>
                  </p>
                ) : (
                  <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                    <dt>Ingreso</dt>
                    <dd className="text-right">{formatMoney(r.flujo.ingreso)}</dd>
                    {r.flujo.ingresosExtra > 0 && (
                      <>
                        <dt>+ Ingresos extra</dt>
                        <dd className="text-success text-right">{formatMoney(r.flujo.ingresosExtra)}</dd>
                      </>
                    )}
                    <dt>− Gastos fijos</dt>
                    <dd className="text-right">{formatMoney(r.flujo.gastosFijos)}</dd>
                    <dt>− Pagos a deudas</dt>
                    <dd className="text-right">{formatMoney(r.flujo.pagos)}</dd>
                    <dt className="border-t pt-1.5 font-semibold">Flujo libre</dt>
                    <dd className="border-t pt-1.5 text-right font-semibold">{formatMoney(r.flujo.libre)}</dd>
                    <dt className="text-muted-foreground">− Gastos con dinero</dt>
                    <dd className="text-muted-foreground text-right">{formatMoney(r.gastosEfectivo)}</dd>
                    <dt className="font-semibold">Te queda</dt>
                    <dd
                      className={cn(
                        'text-right font-semibold',
                        (r.flujo.despuesDeGastos ?? 0) < 0 ? 'text-destructive' : 'text-success',
                      )}
                    >
                      {formatMoney(r.flujo.despuesDeGastos)}
                    </dd>
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-3">
              <CardTitle>Pagos de {formatPeriodLong(periodo)}</CardTitle>
            </CardHeader>
            {r.pagos.length === 0 ? (
              <CardContent className="pb-4">
                <p className="text-muted-foreground text-sm">Sin pagos registrados.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-xs">
                    <tr className="border-b">
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Fecha
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Deuda
                      </th>
                      <th scope="col" className={th}>
                        Pago
                      </th>
                      <th scope="col" className={th}>
                        Interés y cargos
                      </th>
                      <th scope="col" className={th}>
                        Capital
                      </th>
                      <th scope="col" className={th}>
                        Saldo después
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {r.pagos.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(p.fecha)}</td>
                        <td className="px-3 py-1.5">
                          <Link to={`/deudas/${p.debt_id}`} className="hover:underline">
                            {p.nombre}
                          </Link>
                        </td>
                        <td className={td}>{formatMoney(p.pago_total)}</td>
                        <td className={cn(td, 'text-destructive')}>
                          {p.interes == null && p.cargos == null ? '—' : formatMoney((p.interes ?? 0) + (p.cargos ?? 0))}
                          {p.es_estimado && <span className="text-muted-foreground ml-1 text-xs">est.</span>}
                        </td>
                        <td className={cn(td, 'text-success')}>{formatMoney(p.capital)}</td>
                        <td className={td}>{formatMoney(p.saldo_despues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Gastos por categoría</CardTitle>
                <CardDescription>
                  Total <Money value={r.totales?.gastos_total} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Categories rows={r.categorias} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Compras con tarjeta</CardTitle>
                <CardDescription>Deuda nueva del mes</CardDescription>
              </CardHeader>
              <CardContent>
                {r.compras.length === 0 ? (
                  <p className="text-success flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4" aria-hidden /> Sin compras con tarjeta este mes.
                  </p>
                ) : (
                  <ul className="grid gap-1.5 text-sm">
                    {r.compras.map((c) => (
                      <li key={c.id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {c.descripcion} <span className="text-muted-foreground">· {c.tarjeta}</span>
                        </span>
                        <Money value={c.monto} className="text-destructive font-medium" />
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t pt-1.5 font-semibold">
                      <span>Total</span>
                      <Money value={r.totales?.compras_tarjeta} className="text-destructive" />
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ anual / rango */

function RangeTab({ totals, debts }: { totals: TotalsRow[]; debts: DebtRow[] }) {
  const options = useMemo(
    () =>
      rangeOptions(
        totals.map((t) => t.periodo),
        currentPeriod(),
      ),
    [totals],
  )
  const [id, setId] = useState(options[0]?.id ?? '')
  const opt = options.find((o) => o.id === id) ?? options[0]
  const payments = usePaymentsRange(opt?.desde ?? null, opt?.hasta ?? null)
  const expenses = useExpensesRange(opt?.desde ?? null, opt?.hasta ?? null)
  const error = payments.error ?? expenses.error
  const r = useMemo(
    () =>
      opt && payments.data && expenses.data
        ? buildRangeReport(opt.desde, opt.hasta, totals, payments.data, expenses.data, debts)
        : null,
    [opt, totals, payments.data, expenses.data, debts],
  )
  if (!opt) return null

  return (
    <div className="grid gap-4">
      <PeriodSelect
        id="reporte-rango"
        label="Período"
        value={opt.id}
        onChange={setId}
        options={options.map((o) => ({ value: o.id, label: o.label }))}
      />
      {error ? (
        <ErrorState error={error} />
      ) : !r ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {formatPeriod(r.desde)} a {formatPeriod(r.hasta)} · {r.meses} {r.meses === 1 ? 'mes' : 'meses'}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={ArrowDownRight}
              label="Deuda real"
              hint={
                r.deudaInicial != null && r.deudaFinal != null
                  ? `${formatMoney(r.deudaInicial)} → ${formatMoney(r.deudaFinal)}`
                  : undefined
              }
            >
              <DebtChange value={r.cambio} />
            </Kpi>
            <Kpi icon={Wallet} label="Pagado a deudas">
              {formatMoney(r.totales.pagos)}
            </Kpi>
            <Kpi icon={Receipt} label="Intereses pagados" hint={`${formatPercent(r.pctInteres)} de lo pagado`}>
              <span className="text-destructive">{formatMoney(r.totales.interesCargos)}</span>
            </Kpi>
            <Kpi icon={PiggyBank} label="Capital" hint={`Compras con tarjeta ${formatMoney(r.totales.comprasTarjeta)}`}>
              <span className="text-success">{formatMoney(r.totales.capital)}</span>
            </Kpi>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Evolución de la deuda real</CardTitle>
              </CardHeader>
              <CardContent>
                <PlanLinesChart
                  data={r.serie}
                  series={[{ key: 'total_real', label: 'Deuda real', color: 'var(--series-1)' }]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pagos por mes</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentsSplitChart data={r.serie} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Por deuda</CardTitle>
                <CardDescription>Interés vs capital en el período</CardDescription>
              </CardHeader>
              <CardContent>
                <InterestVsCapital rows={r.porDeuda} />
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Deudas liquidadas</CardTitle>
                </CardHeader>
                <CardContent>
                  {r.liquidadas.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Ninguna en este período.</p>
                  ) : (
                    <ul className="grid gap-1.5 text-sm">
                      {r.liquidadas.map((d) => (
                        <li key={d.debtId} className="flex items-center gap-2">
                          <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                          <span className="flex-1 font-medium">{d.nombre}</span>
                          <span className="text-muted-foreground tabular">{formatDate(d.fecha)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Gastos por categoría</CardTitle>
                  <CardDescription>
                    Total <Money value={r.totales.gastos} />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Categories rows={r.categorias} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ReportsPage() {
  const totals = useMonthlyTotals()
  const debts = useDebtStatus()
  const error = totals.error ?? debts.error
  const t = useMemo(() => (totals.data ? toTotals(totals.data) : null), [totals.data])
  const d = useMemo(() => (debts.data ? toDebts(debts.data) : null), [debts.data])

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Cuánto pagaste, cuánto se fue en intereses y en qué gastaste."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/mas/exportar">
              <Download /> Exportar
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : !t || !d ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : t.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Todavía no hay datos"
          description="Los reportes se arman con tus pagos, gastos y saldos mensuales."
        />
      ) : (
        <Tabs defaultValue="mensual">
          <TabsList>
            <TabsTrigger value="mensual">Mensual</TabsTrigger>
            <TabsTrigger value="anual">Anual</TabsTrigger>
          </TabsList>
          <TabsContent value="mensual" className="mt-3">
            <MonthlyTab totals={t} debts={d} />
          </TabsContent>
          <TabsContent value="anual" className="mt-3">
            <RangeTab totals={t} debts={d} />
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}
