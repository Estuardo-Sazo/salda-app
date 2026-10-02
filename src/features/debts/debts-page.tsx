import { CreditCard, Landmark, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, Money, OrPending, PageHeader, PendingBadge } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebtStatus, type DebtStatus } from '@/features/common/queries'
import { formatDate, formatGTQ, formatPercent } from '@/lib/format'
import { TIPO_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Avance contra el saldo base (cuánto bajó desde que se empezó a seguir). */
function progressOf(d: DebtStatus) {
  if (d.saldo_base <= 0) return d.estado === 'activa' ? 0 : 100
  return Math.min(100, Math.max(0, ((d.saldo_base - d.saldo_actual) / d.saldo_base) * 100))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

function DebtCard({ debt }: { debt: DebtStatus }) {
  const Icon = debt.tipo === 'tarjeta' ? CreditCard : Landmark
  const progress = progressOf(debt)
  const closed = debt.estado !== 'activa'
  return (
    <Card className={cn('hover:ring-primary/40 relative transition', closed && 'opacity-70')}>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
          <span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-xl">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-semibold">
                <Link
                  to={`/deudas/${debt.debt_id}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {debt.nombre}
                </Link>
              </h2>
              <Badge variant="outline">{TIPO_LABEL[debt.tipo]}</Badge>
              {closed && <Badge variant="secondary">{debt.estado === 'cerrada' ? 'Cerrada' : 'Liquidada'}</Badge>}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">{debt.entidad}</p>
          </div>
          <div className="bg-muted/60 col-span-2 flex items-baseline justify-between gap-2 rounded-xl px-3 py-2 sm:col-span-1 sm:block sm:bg-transparent sm:p-0 sm:text-right">
            <p className="text-lg font-semibold tracking-tight">
              <Money value={debt.deuda_real} />
            </p>
            {debt.cuotas_fuera_saldo > 0 && (
              <p className="text-muted-foreground text-xs">
                incl. <Money value={debt.cuotas_fuera_saldo} /> fuera de saldo
              </p>
            )}
          </div>
        </div>

        {!closed && (
          <div>
            <Progress value={progress} aria-label={`Avance de ${debt.nombre}`} className="h-2" />
            <p className="text-muted-foreground mt-1.5 flex justify-between text-xs">
              <span>{progress.toFixed(0)} % pagado del saldo base</span>
              <span className="tabular">base {formatGTQ(debt.saldo_base)}</span>
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Field label="Tasa anual">
            <OrPending value={debt.tasa_anual}>{formatPercent(debt.tasa_anual)}</OrPending>
          </Field>
          <Field label="Cuota mensual">
            <OrPending value={debt.cuota_mensual}>
              <Money value={debt.cuota_mensual} />
            </OrPending>
          </Field>
          <Field label="Día de pago">{debt.dia_pago ?? '—'}</Field>
          <Field label="Seguro">
            <OrPending value={debt.seguro_mensual}>
              <Money value={debt.seguro_mensual} />
            </OrPending>
          </Field>
        </dl>

        {!closed && (
          <div className="bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
            <span className="text-muted-foreground">Saldo de cancelación</span>
            {debt.saldo_cancelacion == null ? (
              <PendingBadge />
            ) : (
              <span className="font-medium">
                <Money value={debt.saldo_cancelacion} />
                {debt.saldo_cancelacion_fecha && (
                  <span className="text-muted-foreground ml-1 text-xs font-normal">
                    al {formatDate(debt.saldo_cancelacion_fecha)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DebtsPage() {
  const { data, error, isLoading } = useDebtStatus()
  if (error) return <ErrorState error={error} />

  const activas = data?.filter((d) => d.estado === 'activa') ?? []
  const otras = data?.filter((d) => d.estado !== 'activa') ?? []
  const total = activas.reduce((acc, d) => acc + d.deuda_real, 0)

  return (
    <>
      <PageHeader
        title="Deudas"
        description={
          data ? (
            <>
              {activas.length} activas · <Money value={total} className="text-foreground font-medium" /> en total
            </>
          ) : undefined
        }
        action={
          <Button asChild>
            <Link to="/deudas/nueva">
              <Plus /> Nueva
            </Link>
          </Button>
        }
      />
      {isLoading && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="Todavía no hay deudas"
          description="Cargá tus datos o empezá desde cero."
          action={
            <Button asChild>
              <Link to="/bienvenida">Empezar</Link>
            </Button>
          }
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {activas.map((d) => (
          <DebtCard key={d.debt_id} debt={d} />
        ))}
      </div>
      {otras.length > 0 && (
        <>
          <h2 className="text-muted-foreground mt-8 mb-3 text-sm font-medium">Cerradas y liquidadas</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {otras.map((d) => (
              <DebtCard key={d.debt_id} debt={d} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
