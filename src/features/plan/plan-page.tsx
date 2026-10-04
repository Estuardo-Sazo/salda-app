import { AlertTriangle, CheckCircle2, Flag, ListChecks, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Collapsible } from '@/components/form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebtStatus, useMonthlyTotals, type MonthlyTotals } from '@/features/common/queries'
import { seriesColor } from '@/features/dashboard/chart-style'
import { currentPeriod, formatDate, formatGTQ, formatPeriod, formatPeriodLong } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useActivatePlan, usePlanRows, usePlans, type Plan } from './api'
import { PlanLinesChart } from './charts'
import { DiffAmount } from './diff'
import { GeneratePlanDialog } from './generate-plan-dialog'
import {
  buildCompareSeries,
  buildPlanVsReal,
  comparePlans,
  diffTone,
  planByDebt,
  summarizePlanRows,
  type PlanRowSource,
} from './model'
import { ESTRATEGIA_LABEL } from './plan-input'

const th = 'px-3 py-2 text-right font-medium whitespace-nowrap'
const td = 'px-3 py-1.5 text-right whitespace-nowrap'
const stickyTh = 'bg-card sticky left-0 z-10 px-3 py-1.5 text-left font-medium whitespace-nowrap'

function PlanSummaryCard({ plan, rows, totals }: { plan: Plan; rows: PlanRowSource[]; totals: MonthlyTotals[] }) {
  const resumen = plan.supuestos?.resumen
  const vsReal = useMemo(() => buildPlanVsReal(rows, totals), [rows, totals])
  const ultimo = vsReal.filter((r) => r.diferencia != null).at(-1)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{plan.nombre}</CardTitle>
          <Badge variant="success">Activo</Badge>
        </div>
        <CardDescription>
          {ESTRATEGIA_LABEL[plan.estrategia]} · {formatGTQ(plan.presupuesto_deudas)} al mes
          {plan.abono_extra > 0 && ` + ${formatGTQ(plan.abono_extra)} extra`} · desde {formatPeriod(plan.fecha_inicio)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Libre de deudas</dt>
            <dd className="font-semibold">{resumen?.periodo_libre ? formatPeriodLong(resumen.periodo_libre) : '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Deuda al iniciar</dt>
            <dd className="font-semibold">
              <Money value={resumen?.deuda_inicial} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Intereses y cargos</dt>
            <dd className="font-semibold">
              <Money value={resumen?.total_interes_cargos} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total a pagar</dt>
            <dd className="font-semibold">
              <Money value={resumen?.total_pagado} />
            </dd>
          </div>
        </dl>

        {ultimo ? (
          <p
            className={cn(
              'flex items-center gap-2 rounded-xl p-3 text-sm font-medium',
              diffTone(ultimo.diferencia!) === 'good'
                ? 'bg-success-soft text-success'
                : 'bg-danger-soft text-destructive',
            )}
          >
            {diffTone(ultimo.diferencia!) === 'good' ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
            )}
            En {formatPeriodLong(ultimo.periodo)} vas {formatGTQ(Math.abs(ultimo.diferencia!))}{' '}
            {diffTone(ultimo.diferencia!) === 'good' ? 'adelantado' : 'atrasado'} vs la meta.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            La comparación con lo real empieza en {formatPeriodLong(plan.fecha_inicio)}.
          </p>
        )}

        {plan.supuestos && (
          <Collapsible title="Supuestos del plan">
            <ul className="text-muted-foreground grid list-disc gap-1 pl-5 text-sm">
              {plan.supuestos.supuestos.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {plan.supuestos.advertencias.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {plan.supuestos.advertencias.map((a) => (
                  <li key={a} className="text-warning-foreground flex gap-1.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-xs">Creado el {formatDate(plan.created_at)}.</p>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

function MonthByMonth({ rows, totals }: { rows: PlanRowSource[]; totals: MonthlyTotals[] }) {
  const vsReal = useMemo(() => buildPlanVsReal(rows, totals), [rows, totals])
  const serie = useMemo(() => buildCompareSeries([{ id: 'meta', rows }], totals), [rows, totals])
  const actual = currentPeriod()
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Deuda real vs meta</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanLinesChart
            data={serie}
            series={[
              { key: 'meta', label: 'Meta del plan', color: 'var(--muted-foreground)', dashed: true },
              { key: 'real', label: 'Real', color: 'var(--series-1)' },
            ]}
          />
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Meta del plan, deuda real y diferencia por mes</caption>
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th scope="col" className={cn(stickyTh, 'py-2')}>
                  Mes
                </th>
                <th scope="col" className={th}>
                  Meta
                </th>
                <th scope="col" className={th}>
                  Real
                </th>
                <th scope="col" className={th}>
                  Diferencia
                </th>
                <th scope="col" className={th}>
                  Pago plan
                </th>
                <th scope="col" className={th}>
                  Intereses plan
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {vsReal.map((r) => (
                <tr key={r.periodo} className={cn('border-b last:border-0', r.periodo === actual && 'bg-accent/40')}>
                  <th scope="row" className={stickyTh}>
                    {formatPeriod(r.periodo)}
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">#{r.mes}</span>
                  </th>
                  <td className={cn(td, 'font-medium')}>{formatGTQ(r.meta)}</td>
                  <td className={td}>{r.real == null ? '—' : formatGTQ(r.real)}</td>
                  <td className={td}>
                    <DiffAmount value={r.diferencia} />
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatGTQ(r.pago)}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatGTQ(r.interesCargos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function ByDebt({ rows }: { rows: PlanRowSource[] }) {
  const debts = useDebtStatus()
  const data = useMemo(() => planByDebt(rows), [rows])
  const ids = useMemo(() => {
    const enPlan = new Set(rows.flatMap((r) => (r.debt_id ? [r.debt_id] : [])))
    return (debts.data ?? []).filter((d) => enPlan.has(d.debt_id))
  }, [rows, debts.data])
  // Primer mes en que cada deuda queda en cero (para resaltarlo).
  const liquidada = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of data) {
      for (const [id, saldo] of Object.entries(r.saldos)) if (saldo < 0.01 && !m.has(id)) m.set(id, r.periodo)
    }
    return m
  }, [data])

  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Saldo planeado de cada deuda por mes</caption>
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th scope="col" className={cn(stickyTh, 'py-2')}>
                Mes
              </th>
              {ids.map((d) => (
                <th key={d.debt_id} scope="col" className={cn(th, 'max-w-32 truncate')} title={d.nombre}>
                  {d.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((r) => (
              <tr key={r.periodo} className="border-b last:border-0">
                <th scope="row" className={stickyTh}>
                  {formatPeriod(r.periodo)}
                </th>
                {ids.map((d) => {
                  const saldo = r.saldos[d.debt_id]
                  const esLiquidacion = liquidada.get(d.debt_id) === r.periodo
                  return (
                    <td
                      key={d.debt_id}
                      className={cn(
                        td,
                        saldo != null && saldo < 0.01 && 'text-muted-foreground/60',
                        esLiquidacion && 'text-success font-semibold',
                      )}
                    >
                      {saldo == null ? '—' : esLiquidacion ? 'Liquidada' : formatGTQ(saldo)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PlansList({ plans, activeId }: { plans: Plan[]; activeId: string | undefined }) {
  const activate = useActivatePlan()
  const totals = useMonthlyTotals()
  const others = plans.filter((p) => p.id !== activeId)
  const [aId, setAId] = useState(activeId ?? plans[0]?.id ?? '')
  const [bId, setBId] = useState(others[0]?.id ?? plans[1]?.id ?? '')
  const a = usePlanRows(aId || undefined)
  const b = usePlanRows(bId || undefined)
  const planA = plans.find((p) => p.id === aId)
  const planB = plans.find((p) => p.id === bId)

  const comparison =
    a.data && b.data && aId !== bId ? comparePlans(summarizePlanRows(a.data), summarizePlanRows(b.data)) : null
  const serie = useMemo(
    () =>
      a.data && b.data && totals.data
        ? buildCompareSeries(
            [
              { id: 'a', rows: a.data },
              { id: 'b', rows: b.data },
            ],
            totals.data,
          )
        : [],
    [a.data, b.data, totals.data],
  )

  const select = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background h-11 rounded-lg border px-3 text-sm"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
            {p.activo ? ' (activo)' : ''}
          </option>
        ))}
      </select>
    </label>
  )

  const diffCell = (value: number) => (
    <span className={cn('tabular', value < 0 ? 'text-success' : value > 0 ? 'text-destructive' : '')}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {formatGTQ(Math.abs(value))}
    </span>
  )

  return (
    <div className="grid gap-4">
      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{p.nombre}</span>
                  {p.activo && <Badge variant="success">Activo</Badge>}
                </p>
                <p className="text-muted-foreground text-xs">
                  {ESTRATEGIA_LABEL[p.estrategia]} · {formatGTQ(p.presupuesto_deudas)}/mes · desde{' '}
                  {formatPeriod(p.fecha_inicio)}
                  {p.supuestos?.resumen.periodo_libre &&
                    ` · libre en ${formatPeriod(p.supuestos.resumen.periodo_libre)}`}
                </p>
              </div>
              {!p.activo && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activate.isPending}
                  onClick={() =>
                    activate.mutate(p.id, {
                      onSuccess: () => toast.success(`${p.nombre} es ahora tu meta`),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  {activate.isPending && activate.variables === p.id && <Loader2 className="animate-spin" />}
                  Usar como meta
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {plans.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparar planes</CardTitle>
            <CardDescription>Diferencia = B − A. En verde, B cuesta menos o termina antes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {select('plan-a', aId, setAId, 'Plan A')}
              {select('plan-b', bId, setBId, 'Plan B')}
            </div>
            {aId === bId && <p className="text-muted-foreground text-sm">Elegí dos planes distintos.</p>}
            {comparison && planA && planB && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b text-xs">
                      <tr>
                        <th scope="col" className="py-2 pr-3 text-left font-medium" />
                        <th scope="col" className={th}>
                          A
                        </th>
                        <th scope="col" className={th}>
                          B
                        </th>
                        <th scope="col" className={th}>
                          Diferencia
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular">
                      <tr className="border-b">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                          Inicio
                        </th>
                        <td className={td}>{formatPeriod(planA.fecha_inicio)}</td>
                        <td className={td}>{formatPeriod(planB.fecha_inicio)}</td>
                        <td className={td} />
                      </tr>
                      <tr className="border-b">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                          Libre de deudas
                        </th>
                        <td className={td}>{comparison.mesLibre.a ? formatPeriod(comparison.mesLibre.a) : '—'}</td>
                        <td className={td}>{comparison.mesLibre.b ? formatPeriod(comparison.mesLibre.b) : '—'}</td>
                        <td className={td}>
                          {comparison.mesLibre.meses == null ? (
                            '—'
                          ) : (
                            <span
                              className={cn(
                                comparison.mesLibre.meses < 0 && 'text-success',
                                comparison.mesLibre.meses > 0 && 'text-destructive',
                              )}
                            >
                              {comparison.mesLibre.meses === 0
                                ? 'mismo mes'
                                : `${Math.abs(comparison.mesLibre.meses)} ${Math.abs(comparison.mesLibre.meses) === 1 ? 'mes' : 'meses'} ${comparison.mesLibre.meses < 0 ? 'antes' : 'después'}`}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                          Intereses y cargos
                        </th>
                        <td className={td}>{formatGTQ(comparison.interesCargos.a)}</td>
                        <td className={td}>{formatGTQ(comparison.interesCargos.b)}</td>
                        <td className={td}>{diffCell(comparison.interesCargos.diferencia)}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                          Total a pagar
                        </th>
                        <td className={td}>{formatGTQ(comparison.totalPagado.a)}</td>
                        <td className={td}>{formatGTQ(comparison.totalPagado.b)}</td>
                        <td className={td}>{diffCell(comparison.totalPagado.diferencia)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {planA.fecha_inicio !== planB.fecha_inicio && (
                  <p className="text-muted-foreground text-xs">
                    Los planes empiezan en meses distintos: los totales cubren horizontes diferentes.
                  </p>
                )}
                <PlanLinesChart
                  data={serie}
                  series={[
                    { key: 'a', label: `A · ${planA.nombre}`, color: seriesColor(0) },
                    { key: 'b', label: `B · ${planB.nombre}`, color: seriesColor(1), dashed: true },
                    { key: 'real', label: 'Real', color: 'var(--foreground)' },
                  ]}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function PlanPage() {
  const plans = usePlans()
  const totals = useMonthlyTotals()
  const [open, setOpen] = useState(false)
  const active = plans.data?.find((p) => p.activo)
  const rows = usePlanRows(active?.id)

  const error = [plans, totals, rows].find((q) => q.error)?.error
  const loading = !plans.data || !totals.data || (active && !rows.data)

  return (
    <>
      <PageHeader
        title="Plan vs real"
        description="Tu meta mes a mes y cómo vas contra ella."
        action={
          plans.data &&
          plans.data.length > 0 && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> Nuevo plan
            </Button>
          )
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : plans.data!.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Todavía no tenés un plan"
          description="Generá uno con tus deudas actuales: calcula la meta de cada mes y cuándo quedás libre."
          action={
            <Button onClick={() => setOpen(true)}>
              <Flag /> Generar mi plan
            </Button>
          }
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {active && rows.data ? (
            <PlanSummaryCard plan={active} rows={rows.data} totals={totals.data!} />
          ) : (
            <p className="bg-warning-soft text-warning-foreground rounded-xl p-3 text-sm">
              No tenés un plan activo. Elegí uno en la pestaña Planes para usarlo como meta.
            </p>
          )}
          <Tabs defaultValue={active ? 'mes' : 'planes'}>
            <TabsList>
              {active && <TabsTrigger value="mes">Mes a mes</TabsTrigger>}
              {active && <TabsTrigger value="deuda">Por deuda</TabsTrigger>}
              <TabsTrigger value="planes">Planes ({plans.data!.length})</TabsTrigger>
            </TabsList>
            {active && rows.data && (
              <>
                <TabsContent value="mes" className="mt-3">
                  <MonthByMonth rows={rows.data} totals={totals.data!} />
                </TabsContent>
                <TabsContent value="deuda" className="mt-3">
                  <ByDebt rows={rows.data} />
                </TabsContent>
              </>
            )}
            <TabsContent value="planes" className="mt-3">
              <PlansList plans={plans.data!} activeId={active?.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
      <GeneratePlanDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
