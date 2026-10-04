import { useDocumentTitle } from '@/hooks/use-document-title'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { EmptyState, ErrorState, Money, OrPending, PendingBadge } from '@/components/common'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebtStatus } from '@/features/common/queries'
import { flatMonthlyCharge, flatPayoffIn } from '@/lib/finance/flat-loan'
import {
  currentPeriod,
  formatDate,
  formatGTQ,
  formatGTQCompact,
  formatPercent,
  formatPeriod,
  periodOf,
} from '@/lib/format'
import { TIPO_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDebt, useDebtPayments, useDeleteDebt, useInstallments, useSetDebtClosed, type Payment } from './api'
import { useDebtExpenses, type Expense } from '@/features/expenses/api'
import { InstallmentsCard } from './installments-card'

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

function PaymentsChart({ payments }: { payments: Payment[] }) {
  const data = [...payments].reverse().map((p) => ({
    fecha: p.fecha,
    Capital: Math.max(0, p.capital ?? 0),
    'Interés y cargos': (p.interes ?? 0) + (p.cargos ?? 0),
  }))
  return (
    <figure>
      <ul className="text-muted-foreground mb-3 flex gap-4 text-xs">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-(--series-1)" /> Capital
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-(--series-2)" /> Interés y cargos
        </li>
      </ul>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="fecha"
              tickFormatter={(f: string) => formatDate(f).slice(0, 5)}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatGTQCompact}
              width={56}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              formatter={(v) => formatGTQ(Number(v))}
              labelFormatter={(f) => formatDate(String(f))}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="Capital"
              stackId="p"
              fill="var(--series-1)"
              stroke="var(--card)"
              strokeWidth={1}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="Interés y cargos"
              stackId="p"
              fill="var(--series-2)"
              stroke="var(--card)"
              strokeWidth={1}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/** Compras con esta tarjeta: deuda nueva desde el último pago registrado. */
function CardPurchases({ expenses, desde, debtId }: { expenses: Expense[]; desde: string | null; debtId: string }) {
  const nuevas = desde ? expenses.filter((e) => e.fecha > desde) : expenses
  const total = nuevas.reduce((acc, e) => acc + Math.round(e.monto * 100), 0) / 100
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compras con esta tarjeta</CardTitle>
        <CardDescription>
          {total > 0 ? (
            <>
              <Money value={total} className="text-destructive font-medium" /> de deuda nueva
              {desde ? ` desde el último pago (${formatDate(desde)})` : ''}
            </>
          ) : (
            'Sin compras nuevas desde el último pago'
          )}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/registrar/gasto?volver=/deudas/${debtId}`}>
              <Plus /> Compra
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      {expenses.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {expenses.slice(0, 5).map((e) => (
              <li key={e.id}>
                <Link
                  to={`/gastos/${e.id}/editar?volver=/deudas/${debtId}`}
                  className="hover:bg-accent/50 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{e.descripcion}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(e.fecha)} · {e.categoria}
                    </span>
                  </span>
                  <Money
                    value={e.monto}
                    className={cn(desde && e.fecha <= desde ? 'text-muted-foreground' : 'text-destructive')}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

function PaymentsList({ payments, debtId }: { payments: Payment[]; debtId: string }) {
  return (
    <ul className="divide-y">
      {payments.map((p) => (
        <li key={p.id}>
          <Link
            to={`/pagos/${p.id}/editar?volver=/deudas/${debtId}`}
            className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Money value={p.pago_total} />
                {p.es_estimado && <Badge variant="warning">estimado</Badge>}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {formatDate(p.fecha)} · {formatPeriod(p.periodo)}
                {p.interes != null && ` · interés ${formatGTQ(p.interes)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Saldo después</p>
              <Money value={p.saldo_despues} className="text-sm" />
            </div>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function DebtDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const debt = useDebt(id)
  const statuses = useDebtStatus()
  const payments = useDebtPayments(id)
  const installments = useInstallments(id)
  const expenses = useDebtExpenses(id)
  const setClosed = useSetDebtClosed()
  const remove = useDeleteDebt()
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null)
  useDocumentTitle(debt.data?.nombre ?? 'Deuda')

  const error = debt.error ?? statuses.error ?? payments.error ?? installments.error
  if (error) return <ErrorState error={error} />
  const status = statuses.data?.find((s) => s.debt_id === id)
  if (!debt.data || !status || !payments.data || !installments.data) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const d = debt.data
  const Icon = d.tipo === 'tarjeta' ? CreditCard : Landmark
  const activa = status.estado === 'activa'
  const flat = d.interes_modo === 'monto_original' && d.monto_original != null && d.tasa_anual != null
  const flatInfo = (() => {
    if (!flat || !activa) return null
    const terms = {
      montoOriginal: d.monto_original!,
      tasaAnual: d.tasa_anual!,
      fechaBase: d.fecha_base,
      saldoBase: d.saldo_base,
      fechaVencimiento: d.fecha_vencimiento,
    }
    const hoy = currentPeriod()
    const venc = d.fecha_vencimiento ? periodOf(d.fecha_vencimiento) : null
    return {
      cargo: flatMonthlyCharge(terms),
      cancelarHoy: flatPayoffIn(terms, payments.data, hoy),
      venc,
      alVencimiento: venc && venc >= hoy ? flatPayoffIn(terms, payments.data, venc) : null,
    }
  })()
  const progreso =
    d.saldo_base > 0 ? Math.min(100, Math.max(0, ((d.saldo_base - status.saldo_actual) / d.saldo_base) * 100)) : 0

  const onConfirm = () => {
    if (confirm === 'close') {
      setClosed.mutate(
        { id, closed: activa },
        {
          onSuccess: () =>
            toast.success(activa ? `${d.nombre} quedó liquidada 🎉` : `${d.nombre} está activa de nuevo`),
          onError: (e) => toast.error(e.message),
        },
      )
    } else if (confirm === 'delete') {
      remove.mutate(id, {
        onSuccess: () => {
          toast.success('Deuda eliminada')
          navigate('/deudas', { replace: true })
        },
        onError: (e) => toast.error(e.message),
      })
    }
    setConfirm(null)
  }

  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link to="/deudas">
          <ArrowLeft /> Deudas
        </Link>
      </Button>

      <header className="flex items-start gap-3">
        <span className="bg-ink text-mint grid size-12 shrink-0 place-items-center rounded-2xl">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{d.nombre}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {d.entidad}
            <Badge variant="outline">{TIPO_LABEL[d.tipo]}</Badge>
            {!activa && (
              <Badge variant="success">{status.estado === 'cerrada' ? 'Liquidada / cerrada' : 'Liquidada'}</Badge>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Más acciones">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/deudas/${id}/editar`}>
                <Pencil /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm('close')}>
              {activa ? <CheckCircle2 /> : <RotateCcw />}
              {activa ? 'Marcar como liquidada' : 'Reactivar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('delete')}>
              <Trash2 /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <section className="bg-ink text-ink-foreground grid gap-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-ink-foreground/70 text-sm">Deuda real</p>
            <p className="tabular text-4xl font-semibold tracking-tight">{formatGTQ(status.deuda_real)}</p>
            {status.cuotas_fuera_saldo > 0 && (
              <p className="text-ink-foreground/70 mt-1 text-sm">
                Saldo {formatGTQ(status.saldo_actual)} + {formatGTQ(status.cuotas_fuera_saldo)} fuera de saldo
              </p>
            )}
          </div>
          {activa && (
            <Button asChild className="bg-lime text-ink hover:bg-lime/90 h-11">
              <Link to={`/registrar/pago?deuda=${id}&volver=/deudas/${id}`}>
                <Plus /> Registrar pago
              </Link>
            </Button>
          )}
        </div>
        <div>
          <Progress
            value={progreso}
            className="bg-ink-foreground/15 h-2 [&>div]:bg-(--mint)"
            aria-label="Avance contra el saldo base"
          />
          <p className="text-ink-foreground/70 mt-1.5 flex justify-between text-xs">
            <span>{progreso.toFixed(0)} % pagado del saldo base</span>
            <span className="tabular">
              base {formatGTQ(d.saldo_base)} · {formatDate(d.fecha_base)}
            </span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-ink-foreground/60 text-xs">Pagado</dt>
            <dd className="tabular font-medium">{formatGTQ(status.pagado_acumulado)}</dd>
          </div>
          <div>
            <dt className="text-ink-foreground/60 text-xs">A capital</dt>
            <dd className="tabular font-medium">{formatGTQ(status.capital_acumulado)}</dd>
          </div>
          <div>
            <dt className="text-ink-foreground/60 text-xs">Interés y cargos</dt>
            <dd className="tabular font-medium">{formatGTQ(status.interes_acumulado)}</dd>
          </div>
        </dl>
      </section>

      {flatInfo && (
        <section className="border-warning/60 bg-warning-soft/60 grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Interés fijo por mes</p>
            <p className="tabular text-lg font-semibold">{formatGTQ(flatInfo.cargo)}</p>
            <p className="text-muted-foreground text-xs">Se suma aunque no pagues nada</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Para cancelarlo este mes</p>
            <p className="tabular text-lg font-semibold">{formatGTQ(flatInfo.cancelarHoy)}</p>
            <p className="text-muted-foreground text-xs">
              Cada mes que lo adelantes te ahorrás {formatGTQ(flatInfo.cargo)}
            </p>
          </div>
          {flatInfo.alVencimiento != null && flatInfo.venc && (
            <div>
              <p className="text-muted-foreground text-xs">Si lo pagás en {formatPeriod(flatInfo.venc)}</p>
              <p className="tabular text-destructive text-lg font-semibold">{formatGTQ(flatInfo.alVencimiento)}</p>
              <p className="text-muted-foreground text-xs">
                {flatInfo.alVencimiento > flatInfo.cancelarHoy
                  ? `${formatGTQ(flatInfo.alVencimiento - flatInfo.cancelarHoy)} más que cancelarlo hoy`
                  : 'Vence este mes'}
              </p>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
            <CardDescription>
              {payments.data.length
                ? `${payments.data.length} ${payments.data.length === 1 ? 'pago registrado' : 'pagos registrados'} · tocá uno para editarlo`
                : 'Todavía no hay pagos'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {payments.data.length > 0 ? (
              <>
                <PaymentsChart payments={payments.data} />
                <PaymentsList payments={payments.data} debtId={id} />
              </>
            ) : (
              <EmptyState
                icon={Plus}
                title="Sin pagos"
                description="El primer pago define cuánto va a interés y cuánto a capital."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          {d.tipo === 'tarjeta' && expenses.data && (
            <CardPurchases expenses={expenses.data} desde={status.ultimo_pago} debtId={id} />
          )}

          {(d.tipo === 'tarjeta' || installments.data.length > 0) && (
            <InstallmentsCard debtId={id} installments={installments.data} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Condiciones</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {flat ? (
                  <>
                    <Stat label="Interés fijo">{formatPercent((d.tasa_anual ?? 0) / 12)} mensual</Stat>
                    <Stat label="Sobre el monto">
                      <Money value={d.monto_original} />
                    </Stat>
                  </>
                ) : (
                  <>
                    <Stat label="Tasa anual">
                      <OrPending value={d.tasa_anual}>{formatPercent(d.tasa_anual)}</OrPending>
                    </Stat>
                    <Stat label="TEA">
                      {d.tasa_efectiva_anual != null ? formatPercent(d.tasa_efectiva_anual) : '—'}
                    </Stat>
                  </>
                )}
                {d.pago_unico ? (
                  <Stat label="Forma de pago">Pago único</Stat>
                ) : (
                  <Stat label="Cuota mensual">
                    <OrPending value={d.cuota_mensual}>
                      <Money value={d.cuota_mensual} />
                    </OrPending>
                  </Stat>
                )}
                <Stat label="Seguro">
                  <OrPending value={d.seguro_mensual}>
                    <Money value={d.seguro_mensual} />
                  </OrPending>
                </Stat>
                <Stat label="Día de pago">{d.dia_pago ?? '—'}</Stat>
                {d.tipo === 'tarjeta' ? (
                  <>
                    <Stat label="Día de corte">{d.dia_corte ?? '—'}</Stat>
                    <Stat label="Límite">{d.limite_credito != null ? <Money value={d.limite_credito} /> : '—'}</Stat>
                  </>
                ) : (
                  <>
                    {!d.pago_unico && (
                      <Stat label="Cuotas">
                        {d.cuotas_totales != null ? `${d.cuota_actual ?? '?'} de ${d.cuotas_totales}` : '—'}
                      </Stat>
                    )}
                    <Stat label={d.pago_unico ? 'Se paga todo el' : 'Vence'}>{formatDate(d.fecha_vencimiento)}</Stat>
                  </>
                )}
              </dl>
              <div className="bg-muted/60 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
                <span className="text-muted-foreground">Saldo de cancelación</span>
                {d.saldo_cancelacion == null ? (
                  <PendingBadge />
                ) : (
                  <span className="font-medium">
                    <Money value={d.saldo_cancelacion} />
                    {d.saldo_cancelacion_fecha && (
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        al {formatDate(d.saldo_cancelacion_fecha)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {d.notas && <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{d.notas}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'delete'
                ? `¿Eliminar ${d.nombre}?`
                : activa
                  ? `¿Marcar ${d.nombre} como liquidada?`
                  : `¿Reactivar ${d.nombre}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? 'Solo se puede eliminar si no tiene pagos ni gastos. Se borran también sus cuotas y saldos mensuales.'
                : activa
                  ? status.deuda_real > 0.005
                    ? `Todavía figura una deuda real de ${formatGTQ(status.deuda_real)}. Registrá el último pago con saldo Q0 antes, si aplica.`
                    : 'Deja de contarse desde hoy en los totales y en el plan.'
                  : 'Vuelve a contarse en los totales.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant={confirm === 'delete' ? 'destructive' : 'default'} onClick={onConfirm}>
              {confirm === 'delete' ? 'Eliminar' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
