import { useDocumentTitle } from '@/hooks/use-document-title'
import {
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flag,
  History,
  Percent,
  PiggyBank,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { ErrorState, Money } from '@/components/common'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useActivePlan,
  useDebtStatus,
  useMonthlyBalances,
  useMonthlyTotals,
  usePeriodPayments,
} from '@/features/common/queries'
import { currentPeriod, formatDate, formatGTQ, formatPercent, formatPeriod, formatPeriodLong } from '@/lib/format'
import { usePeriodExpenses } from '@/features/expenses/api'
import { useExtraIncomes } from '@/features/income/api'
import { Button } from '@/components/ui/button'
import { bulletAlerts, type BulletAlert } from './bullet'
import { cn } from '@/lib/utils'
import { BalancesByDebtChart, RealVsGoalChart } from './charts'
import { buildDashboard, type DashboardModel } from './model'

function StatTile({
  icon: Icon,
  label,
  children,
  hint,
  tone = 'neutral',
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'good' | 'bad'
}) {
  return (
    <Card size="sm" className="gap-2">
      <CardContent className="flex flex-col gap-2">
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Icon
            className={cn('size-4', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}
            aria-hidden
          />
          {label}
        </span>
        <span className="tabular text-xl font-semibold tracking-tight sm:text-2xl">{children}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardContent>
    </Card>
  )
}

/** Cambio de saldo: bajar es bueno (verde), subir es malo (rojo). Siempre con icono + texto. */
function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const bajo = value <= 0
  const Icon = bajo ? ArrowDownRight : ArrowUpRight
  return (
    <span className={cn('inline-flex items-center gap-1', bajo ? 'text-success' : 'text-destructive')}>
      <Icon className="size-5" aria-hidden />
      <span className="sr-only">{bajo ? 'Bajó' : 'Subió'}</span>
      {formatGTQ(Math.abs(value))}
    </span>
  )
}

function Hero({ model }: { model: DashboardModel }) {
  const meta = model.meta
  const adelantado = meta ? meta.diferencia <= 0 : false
  return (
    <section className="bg-ink text-ink-foreground relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <svg
        aria-hidden
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute right-0 bottom-0 hidden h-3/4 w-1/2 opacity-20 sm:block"
      >
        <path
          d="M0 12 C110 22 170 92 260 117 S360 140 386 140"
          className="stroke-quetzal"
          strokeWidth="3"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-ink-foreground/70 text-sm">Deuda total real · {formatPeriod(model.periodo)}</p>
      <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{formatGTQ(model.deudaReal)}</p>
      <p className="text-ink-foreground/70 mt-2 text-sm">
        Saldos <span className="tabular text-ink-foreground">{formatGTQ(model.saldoTotal)}</span> + cuotas fuera de
        saldo <span className="tabular text-ink-foreground">{formatGTQ(model.cuotasFuera)}</span>
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {model.libre && (
          <span className="bg-gold text-ink inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
            <Flag className="size-4" aria-hidden />
            Libre de deudas en {model.libre.meses} {model.libre.meses === 1 ? 'mes' : 'meses'} ·{' '}
            {formatPeriod(model.libre.periodo)}
          </span>
        )}
        {meta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
              adelantado ? 'bg-quetzal/15 text-quetzal' : 'bg-destructive/25 text-red-200',
            )}
          >
            {adelantado ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <AlertOctagon className="size-4" aria-hidden />
            )}
            Vas {formatGTQ(Math.abs(meta.diferencia))} {adelantado ? 'adelantado' : 'atrasado'} vs la meta
          </span>
        ) : (
          model.metaInicio && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">
              <CalendarClock className="size-4" aria-hidden />
              La meta arranca en {formatPeriodLong(model.metaInicio)}
            </span>
          )
        )}
      </div>
    </section>
  )
}

function BulletAlertCard({ alert }: { alert: BulletAlert }) {
  const cubierto = alert.faltante === 0
  return (
    <section
      aria-label={`Pago único de ${alert.nombre}`}
      className="border-warning/60 bg-warning-soft/70 grid gap-3 rounded-2xl border p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <CalendarClock className="text-warning-foreground mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {alert.mesesFaltan === 0 ? 'Este mes' : `En ${formatPeriodLong(alert.periodo)}`} vence {alert.nombre}
          </p>
          <p className="text-muted-foreground">
            Pago único de <Money value={alert.monto} className="text-foreground font-semibold" />
            {alert.ingresosExtra > 0 && (
              <>
                {' '}
                · ingresos extra de ese mes{' '}
                <Money value={alert.ingresosExtra} className="text-foreground font-medium" />
              </>
            )}
          </p>
        </div>
      </div>
      <ul className="grid gap-1.5 pl-8">
        <li className="flex items-center gap-2">
          {cubierto ? (
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
          ) : (
            <AlertOctagon className="text-destructive size-4 shrink-0" aria-hidden />
          )}
          <span>
            {cubierto ? (
              'Los ingresos extra de ese mes lo cubren.'
            ) : (
              <>
                Faltan <Money value={alert.faltante} className="font-semibold" />
                {alert.mesesFaltan > 0 && (
                  <>
                    : apartá ≈ <Money value={alert.apartarPorMes} className="font-semibold" /> por mes
                  </>
                )}
                .
              </>
            )}
          </span>
        </li>
        {alert.cancelarHoy && alert.cancelarHoy.ahorro > 0 && (
          <li className="flex items-center gap-2">
            <PiggyBank className="text-success size-4 shrink-0" aria-hidden />
            <span>
              Si lo cancelás este mes pagás <Money value={alert.cancelarHoy.monto} className="font-semibold" /> y te
              ahorrás <Money value={alert.cancelarHoy.ahorro} className="text-success font-semibold" />.
            </span>
          </li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2 pl-8">
        <Button size="sm" variant="outline" asChild>
          <Link to={`/deudas/${alert.debtId}`}>Ver préstamo</Link>
        </Button>
        {alert.ingresosExtra === 0 && (
          <Button size="sm" variant="ghost" asChild>
            <Link to="/mas/ingresos-extra">Registrar aguinaldo</Link>
          </Button>
        )}
      </div>
    </section>
  )
}

function CardPurchasesAlert({ model }: { model: DashboardModel }) {
  if (model.comprasTarjeta > 0) {
    return (
      <div role="alert" className="border-destructive/30 bg-danger-soft flex items-start gap-3 rounded-2xl border p-4">
        <AlertOctagon className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-destructive font-semibold">Deuda nueva este mes</p>
          <p className="text-muted-foreground">
            Agregaste <span className="text-foreground tabular font-medium">{formatGTQ(model.comprasTarjeta)}</span> de
            deuda nueva con tarjeta
            {model.compras.tasa != null && (
              <>
                {' '}
                al ~{formatPercent(model.compras.tasa)} anual: ≈{' '}
                <span className="text-foreground font-medium">{formatGTQ(model.compras.interesMes)}</span> de interés
                por mes si no la pagás completa
              </>
            )}
            .
          </p>
          {model.compras.items.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {model.compras.items.slice(0, 3).map((c) => (
                <li key={c.id} className="flex min-w-0 justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {c.descripcion} <span className="text-muted-foreground">· {c.tarjeta}</span>
                  </span>
                  <Money value={c.monto} className="text-destructive font-medium" />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/gastos"
            className="text-destructive mt-2 inline-block font-medium underline-offset-4 hover:underline"
          >
            {model.compras.items.length > 3 ? `Ver las ${model.compras.items.length} compras` : 'Ver gastos del mes'}
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-success-soft/60 flex items-center gap-3 rounded-2xl border p-4 text-sm">
      <ShieldCheck className="text-success size-5 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Sin compras con tarjeta</span>{' '}
        <span className="text-muted-foreground">en {formatPeriodLong(model.periodo)}. ¡Seguí así!</span>{' '}
        <Link to="/gastos" className="text-primary font-medium underline-offset-4 hover:underline">
          Ver gastos
        </Link>
      </p>
    </div>
  )
}

function UpcomingPayments({ model }: { model: DashboardModel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos de {formatPeriodLong(model.periodo)}</CardTitle>
        <CardDescription>Tocá una pendiente para registrar su pago</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {model.proximosPagos.map((p) => (
            <li key={p.debtId}>
              <Link
                to={p.pagado ? `/deudas/${p.debtId}` : `/registrar/pago?deuda=${p.debtId}`}
                className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition"
              >
                {p.pagado ? (
                  <CheckCircle2 className="text-success size-5 shrink-0" aria-hidden />
                ) : (
                  <Circle className="text-muted-foreground/60 size-5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(p.fecha)} · {p.pagado ? 'Pagado' : 'Pendiente'}
                  </p>
                </div>
                <Money value={p.cuota} className={cn('text-sm', p.pagado && 'text-muted-foreground line-through')} />
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function DashboardView({ model, alerts = [] }: { model: DashboardModel; alerts?: BulletAlert[] }) {
  const inicio = model.periodoInicio ? formatPeriod(model.periodoInicio) : 'el inicio'
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Hero model={model} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CalendarDays}
          label="Saldos este mes"
          tone={(model.cambioMes ?? 0) <= 0 ? 'good' : 'bad'}
          hint="vs mes anterior"
        >
          <Delta value={model.cambioMes} />
        </StatTile>
        <StatTile
          icon={History}
          label={`Desde ${inicio}`}
          tone={(model.cambioDesdeInicio ?? 0) <= 0 ? 'good' : 'bad'}
          hint="cambio de saldos"
        >
          <Delta value={model.cambioDesdeInicio} />
        </StatTile>
        <StatTile
          icon={Percent}
          label="Se fue en intereses"
          hint={
            model.pagosMes > 0 ? `${formatGTQ(model.interesesMes)} de ${formatGTQ(model.pagosMes)}` : 'sin pagos aún'
          }
        >
          {formatPercent(model.pctIntereses)}
        </StatTile>
        <StatTile
          icon={Wallet}
          label="Flujo libre"
          tone={(model.flujoLibre ?? 0) >= 0 ? 'good' : 'bad'}
          hint="ingreso − fijos − pagos"
        >
          {model.flujoLibre == null ? '—' : formatGTQ(model.flujoLibre)}
        </StatTile>
      </div>

      {alerts.map((a) => (
        <BulletAlertCard key={a.debtId} alert={a} />
      ))}

      <CardPurchasesAlert model={model} />

      <div className="grid gap-4 lg:grid-cols-5 [&>*]:min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Deuda real vs meta</CardTitle>
            <CardDescription>Las cuotas fuera de saldo se registran desde oct 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <RealVsGoalChart data={model.serie} />
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <UpcomingPayments model={model} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo por deuda</CardTitle>
          <CardDescription>Saldo del estado de cuenta al cierre de cada mes</CardDescription>
        </CardHeader>
        <CardContent>
          <BalancesByDebtChart data={model.barras} debts={model.deudas} />
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-44 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function DashboardPage() {
  useDocumentTitle('Inicio')
  const periodo = currentPeriod()
  const totals = useMonthlyTotals()
  const balances = useMonthlyBalances()
  const debts = useDebtStatus()
  const plan = useActivePlan()
  const payments = usePeriodPayments(periodo)
  const expenses = usePeriodExpenses(periodo)
  const extras = useExtraIncomes()
  const queries = [totals, balances, debts, plan, payments, expenses]

  const model = useMemo(() => {
    if (!totals.data || !balances.data || !debts.data || plan.data === undefined || !payments.data) return null
    return buildDashboard({
      periodo,
      totals: totals.data,
      balances: balances.data,
      debts: debts.data,
      plan: plan.data,
      paidDebtIds: new Set(payments.data.map((p) => p.debt_id)),
      expenses: expenses.data,
    })
  }, [periodo, totals.data, balances.data, debts.data, plan.data, payments.data, expenses.data])

  const error = queries.find((q) => q.error)?.error
  if (error) return <ErrorState error={error} />
  if (!model || !debts.data) return <DashboardSkeleton />
  if (debts.data.length === 0) return <Navigate to="/bienvenida" replace />
  const alerts = bulletAlerts(debts.data, extras.data ?? [], periodo)
  return <DashboardView model={model} alerts={alerts} />
}
