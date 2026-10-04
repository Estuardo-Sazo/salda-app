import { AlertOctagon, ChevronLeft, ChevronRight, CreditCard, Plus, Receipt } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebtStatus } from '@/features/common/queries'
import { summarizeExpenses } from '@/lib/finance/expenses'
import { addMonths, normalizePeriod } from '@/lib/finance/period'
import { currentPeriod, formatDate, formatMoney, formatPercent, formatPeriodLong } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePeriodExpenses, type Expense } from './api'
import { METODO_LABEL } from './schema'

function MonthNav({ periodo, onChange }: { periodo: string; onChange: (p: string) => void }) {
  const actual = currentPeriod()
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Mes anterior" onClick={() => onChange(addMonths(periodo, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium capitalize">{formatPeriodLong(periodo)}</span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        disabled={periodo >= actual}
        onClick={() => onChange(addMonths(periodo, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

function ExpenseRow({ e, tarjeta }: { e: Expense; tarjeta?: string }) {
  const esTarjeta = e.metodo === 'tarjeta'
  return (
    <li>
      <Link
        to={`/gastos/${e.id}/editar`}
        className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition"
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            esTarjeta ? 'bg-danger-soft text-destructive' : 'bg-accent text-accent-foreground',
          )}
        >
          {esTarjeta ? <CreditCard className="size-4" aria-hidden /> : <Receipt className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{e.descripcion}</p>
          <p className="text-muted-foreground truncate text-xs">
            {formatDate(e.fecha)} · {e.categoria} · {esTarjeta ? (tarjeta ?? 'Tarjeta') : METODO_LABEL[e.metodo]}
          </p>
        </div>
        <span className={cn('tabular text-sm font-medium', esTarjeta && 'text-destructive')}>
          {esTarjeta && <span className="sr-only">Deuda nueva: </span>}
          {formatMoney(e.monto)}
        </span>
      </Link>
    </li>
  )
}

export function ExpensesPage() {
  const [params, setParams] = useSearchParams()
  const periodo = params.get('mes') ? normalizePeriod(params.get('mes')!) : currentPeriod()
  const expenses = usePeriodExpenses(periodo)
  const debts = useDebtStatus()

  const nombres = useMemo(() => new Map((debts.data ?? []).map((d) => [d.debt_id, d.nombre])), [debts.data])
  const summary = useMemo(() => {
    const tasas = Object.fromEntries((debts.data ?? []).map((d) => [d.debt_id, d.tasa_anual]))
    return summarizeExpenses(expenses.data ?? [], tasas)
  }, [expenses.data, debts.data])

  const setPeriodo = (p: string) => setParams(p === currentPeriod() ? {} : { mes: p.slice(0, 7) }, { replace: true })
  const error = expenses.error ?? debts.error

  return (
    <>
      <PageHeader
        title="Gastos"
        action={
          <Button asChild>
            <Link to="/registrar/gasto">
              <Plus /> Nuevo
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex justify-center sm:justify-start">
        <MonthNav periodo={periodo} onChange={setPeriodo} />
      </div>

      {error && <ErrorState error={error} />}
      {!expenses.data && !error && (
        <div className="grid gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {expenses.data && expenses.data.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={`Sin gastos en ${formatPeriodLong(periodo)}`}
          description="Registrá lo que gastás en efectivo, débito o tarjeta."
          action={
            <Button asChild>
              <Link to="/registrar/gasto">Registrar gasto</Link>
            </Button>
          }
        />
      )}

      {expenses.data && expenses.data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-5 [&>*]:min-w-0">
          <div className="grid content-start gap-4 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <Card size="sm">
                <CardContent>
                  <p className="text-muted-foreground text-xs">Total del mes</p>
                  <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{formatMoney(summary.total)}</p>
                  <p className="text-muted-foreground text-xs">{expenses.data.length} gastos</p>
                </CardContent>
              </Card>
              <Card size="sm" className={cn(summary.tarjeta > 0 && 'bg-danger-soft ring-destructive/30')}>
                <CardContent>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    {summary.tarjeta > 0 && <AlertOctagon className="text-destructive size-3.5" aria-hidden />}
                    Deuda nueva (tarjeta)
                  </p>
                  <p
                    className={cn(
                      'tabular mt-1 text-2xl font-semibold tracking-tight',
                      summary.tarjeta > 0 && 'text-destructive',
                    )}
                  >
                    {formatMoney(summary.tarjeta)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {summary.tasaTarjeta != null
                      ? `≈ ${formatMoney(summary.interesMensualTarjeta)}/mes al ${formatPercent(summary.tasaTarjeta)}`
                      : summary.tarjeta > 0
                        ? 'tasa pendiente'
                        : 'sin compras con tarjeta'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Por categoría</CardTitle>
                <CardDescription>Porcentaje del total del mes</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {summary.porCategoria.map((c) => (
                    <li key={c.categoria} className="grid gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{c.categoria}</span>
                        <span className="tabular">
                          <Money value={c.total} />{' '}
                          <span className="text-muted-foreground text-xs">{formatPercent(c.pct)}</span>
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                        <div className="bg-primary h-full rounded-full" style={{ width: `${c.pct * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(summary.porMetodo)
                    .filter(([, v]) => v > 0)
                    .map(([m, v]) => (
                      <Badge key={m} variant={m === 'tarjeta' ? 'destructive' : 'secondary'}>
                        {METODO_LABEL[m as keyof typeof METODO_LABEL]} {formatMoney(v)}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
              <CardDescription>Tocá uno para editarlo</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {expenses.data.map((e) => (
                  <ExpenseRow key={e.id} e={e} tarjeta={e.debt_id ? nombres.get(e.debt_id) : undefined} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
