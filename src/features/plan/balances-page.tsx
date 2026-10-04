import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivePlan, useDebtStatus, useMonthlyBalances, useMonthlyTotals } from '@/features/common/queries'
import { formatMoney, formatPeriod, formatPeriodLong } from '@/lib/format'
import { moneyField, toInput } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { useSaveManualSnapshot } from './api'
import { ChangeAmount, DiffAmount } from './diff'
import { buildBalanceTable, type BalanceCell } from './model'

const ORIGEN_LABEL: Record<BalanceCell['origen'], string> = {
  historial: 'Historial',
  registro: 'Pago registrado',
  manual: 'Ajuste manual',
}

interface Editing {
  debtId: string
  nombre: string
  periodo: string
  cell: BalanceCell
}

const schema = z.object({ saldo: moneyField('Ingresá el saldo') })
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function EditBalanceDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const save = useSaveManualSnapshot()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: { saldo: toInput(editing?.cell.saldo) },
  })

  const onSubmit = form.handleSubmit(async ({ saldo }) => {
    if (!editing) return
    try {
      await save.mutateAsync({
        debt_id: editing.debtId,
        periodo: editing.periodo,
        saldo,
        cuotas_fuera_saldo: editing.cell.cuotasFuera,
      })
      toast.success(`${editing.nombre}: saldo de ${formatPeriod(editing.periodo)} en ${formatMoney(saldo)}`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  })

  return (
    <Dialog open={editing != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {editing && (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {editing.nombre} · {formatPeriod(editing.periodo)}
              </DialogTitle>
              <DialogDescription>
                {editing.cell.registrado
                  ? `Origen actual: ${ORIGEN_LABEL[editing.cell.origen].toLowerCase()}.`
                  : 'Este mes no tiene saldo propio: se arrastra el último conocido.'}{' '}
                Si registrás un pago de este mes después, su saldo reemplaza el ajuste.
              </DialogDescription>
            </DialogHeader>
            <Field
              id="saldo"
              label="Saldo al cierre del mes"
              error={form.formState.errors.saldo?.message}
              hint={
                editing.cell.cuotasFuera > 0
                  ? `Sin las cuotas fuera de saldo (${formatMoney(editing.cell.cuotasFuera)}), que se mantienen.`
                  : 'Saldo del estado de cuenta, sin cuotas fuera de saldo.'
              }
            >
              <MoneyInput id="saldo" autoFocus aria-describedby="saldo-msg" {...form.register('saldo')} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Guardar ajuste
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Legend() {
  return (
    <ul className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <li className="flex items-center gap-1.5">
        <span className="bg-primary size-2 rounded-full" aria-hidden /> Pago registrado
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-warning size-2 rounded-full" aria-hidden /> Ajuste manual
      </li>
      <li className="flex items-center gap-1.5">
        <span className="italic">{formatMoney(0)}</span> en gris: sin dato del mes, se arrastra el anterior
      </li>
      <li>Diferencia = total real − meta</li>
    </ul>
  )
}

const th = 'px-3 py-2 text-right font-medium whitespace-nowrap'
const td = 'px-3 py-1.5 text-right'

export function BalancesPage() {
  const balances = useMonthlyBalances()
  const totals = useMonthlyTotals()
  const debts = useDebtStatus()
  const plan = useActivePlan()
  const [editing, setEditing] = useState<Editing | null>(null)

  const table = useMemo(
    () =>
      balances.data && totals.data && plan.data !== undefined
        ? buildBalanceTable(balances.data, totals.data, plan.data?.totals ?? [])
        : null,
    [balances.data, totals.data, plan.data],
  )
  // Columnas: deudas que tienen algún saldo, en el orden de prioridad.
  const columns = useMemo(() => {
    const conSaldo = new Set(balances.data?.map((b) => b.debt_id))
    return (debts.data ?? []).filter((d) => conSaldo.has(d.debt_id))
  }, [balances.data, debts.data])

  const error = [balances, totals, debts, plan].find((q) => q.error)?.error

  return (
    <>
      <PageHeader
        title="Saldos mensuales"
        description="Saldo de cada deuda al cierre de cada mes. Tocá un saldo para corregirlo."
      />
      {error && <ErrorState error={error} />}
      {!error && !table && <Skeleton className="h-80 rounded-xl" />}
      {table?.length === 0 && (
        <EmptyState
          icon={Table2}
          title="Todavía no hay saldos"
          description="Se llenan con el historial importado y con cada pago que registrás."
          action={
            <Button asChild>
              <Link to="/registrar/pago">Registrar un pago</Link>
            </Button>
          }
        />
      )}
      {table && table.length > 0 && (
        <Card className="gap-0 p-4">
          <Legend />
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Saldos por mes y deuda, con total real, meta y diferencia</caption>
              <thead className="text-muted-foreground border-b text-xs">
                <tr>
                  <th scope="col" className="bg-card sticky left-0 z-10 px-3 py-2 text-left font-medium">
                    Mes
                  </th>
                  {columns.map((d) => (
                    <th key={d.debt_id} scope="col" className={cn(th, 'max-w-32 truncate')} title={d.nombre}>
                      {d.nombre}
                    </th>
                  ))}
                  <th scope="col" className={cn(th, 'border-l')}>
                    Saldos
                  </th>
                  <th scope="col" className={th}>
                    Fuera de saldo
                  </th>
                  <th scope="col" className={cn(th, 'text-foreground')}>
                    Total real
                  </th>
                  <th scope="col" className={th}>
                    Cambio
                  </th>
                  <th scope="col" className={th}>
                    Meta
                  </th>
                  <th scope="col" className={th}>
                    Diferencia
                  </th>
                </tr>
              </thead>
              <tbody className="tabular">
                {table.map((row) => (
                  <tr key={row.periodo} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="bg-card sticky left-0 z-10 px-3 py-1.5 text-left font-medium whitespace-nowrap"
                    >
                      {formatPeriod(row.periodo)}
                    </th>
                    {columns.map((d) => {
                      const cell = row.celdas[d.debt_id]
                      if (!cell) {
                        return (
                          <td key={d.debt_id} className={cn(td, 'text-muted-foreground')}>
                            —
                          </td>
                        )
                      }
                      return (
                        <td key={d.debt_id} className="px-1 py-0.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ debtId: d.debt_id, nombre: d.nombre, periodo: row.periodo, cell })
                            }
                            aria-label={`Corregir saldo de ${d.nombre} en ${formatPeriodLong(row.periodo)}: ${formatMoney(cell.saldo)}${
                              cell.registrado ? `, ${ORIGEN_LABEL[cell.origen].toLowerCase()}` : ', arrastrado'
                            }`}
                            className={cn(
                              'hover:bg-accent focus-visible:ring-ring/50 inline-flex w-full items-center justify-end gap-1.5 rounded-md px-2 py-1 whitespace-nowrap focus-visible:ring-3 focus-visible:outline-none',
                              !cell.registrado && 'text-muted-foreground italic',
                            )}
                          >
                            {cell.registrado && cell.origen !== 'historial' && (
                              <span
                                aria-hidden
                                className={cn(
                                  'size-1.5 shrink-0 rounded-full',
                                  cell.origen === 'manual' ? 'bg-warning' : 'bg-primary',
                                )}
                              />
                            )}
                            {formatMoney(cell.saldo)}
                          </button>
                        </td>
                      )
                    })}
                    <td className={cn(td, 'border-l')}>
                      <Money value={row.saldoTotal} />
                    </td>
                    <td className={cn(td, 'text-muted-foreground')}>
                      {row.cuotasFuera > 0 ? formatMoney(row.cuotasFuera) : '—'}
                    </td>
                    <td className={cn(td, 'font-semibold')}>
                      <Money value={row.totalReal} />
                    </td>
                    <td className={td}>
                      <ChangeAmount value={row.cambio} />
                    </td>
                    <td className={cn(td, 'text-muted-foreground')}>
                      {row.meta == null ? '—' : formatMoney(row.meta)}
                    </td>
                    <td className={td}>
                      <DiffAmount value={row.diferencia} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!plan.data && (
            <p className="text-muted-foreground mt-3 text-xs">
              Sin plan activo no hay meta.{' '}
              <Link to="/plan" className="text-primary font-medium underline-offset-4 hover:underline">
                Generar un plan
              </Link>
            </p>
          )}
        </Card>
      )}
      <EditBalanceDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  )
}
