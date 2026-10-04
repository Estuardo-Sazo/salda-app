import { AlertTriangle, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, Money, PageHeader, PendingBadge } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useActivePlan } from '@/features/common/queries'
import { seriesColor } from '@/features/dashboard/chart-style'
import { usePlanSources, useSavePlan } from '@/features/plan/api'
import { PlanLinesChart } from '@/features/plan/charts'
import {
  buildSavePlanPayload,
  defaultPlanName,
  defaultPlanStart,
  ESTRATEGIA_LABEL,
  type PlanSources,
} from '@/features/plan/plan-input'
import type { Strategy } from '@/lib/finance'
import { currentPeriod, formatMoney, formatPercent, formatPeriod } from '@/lib/format'
import { parseAmount, toInput } from '@/lib/forms'
import { cn } from '@/lib/utils'
import {
  baseParams,
  budgetBounds,
  cancellationAmount,
  liquidationTable,
  simulateConsolidation,
  simulateStrategy,
  suggestedLoanAmount,
  type LiquidationCell,
  type Simulation,
  type StrategyParams,
} from './model'

/* ------------------------------------------------------------------ controles */

/** Slider + campo de monto sincronizados. */
function AmountSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 50,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  hint?: ReactNode
}) {
  const id = useId()
  // Mientras se escribe se muestra el borrador; al confirmar vuelve a seguir al slider.
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const n = draft == null ? null : parseAmount(draft)
    if (n != null && !Number.isNaN(n) && n >= 0) onChange(n)
    setDraft(null)
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <div className="w-36">
          <MoneyInput
            id={id}
            className="h-9 text-right"
            value={draft ?? toInput(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
          />
        </div>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={Math.max(max, value)}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? 0)}
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

function StrategyChips({ value, onChange }: { value: Strategy; onChange: (s: Strategy) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Estrategia</legend>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(ESTRATEGIA_LABEL) as Strategy[]).map((s) => (
          <ChoiceChip key={s} selected={value === s} className="text-center" onClick={() => onChange(s)}>
            {ESTRATEGIA_LABEL[s]}
          </ChoiceChip>
        ))}
      </div>
    </fieldset>
  )
}

/* ------------------------------------------------------------------ resultados */

const th = 'px-3 py-2 text-right font-medium whitespace-nowrap'
const td = 'px-3 py-1.5 text-right whitespace-nowrap'
const rowTh = 'py-1.5 pr-3 text-left font-medium'

/** Diferencia B − A. `lowerIsBetter` = costos (verde si baja); flujo libre al revés. */
function Delta({ value, lowerIsBetter = true }: { value: number; lowerIsBetter?: boolean }) {
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">igual</span>
  const good = lowerIsBetter ? value < 0 : value > 0
  return (
    <span className={cn('tabular font-medium', good ? 'text-success' : 'text-destructive')}>
      <span className="sr-only">{good ? 'Mejor: ' : 'Peor: '}</span>
      {value > 0 ? '+' : '−'}
      {formatMoney(Math.abs(value))}
    </span>
  )
}

const meses = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`

function liquidationText(cell: LiquidationCell) {
  if (cell === 'cancelada') return <span className="text-success">Cancelada con el préstamo</span>
  if (cell === 'no-aplica') return <span className="text-muted-foreground">—</span>
  if (cell == null) return <span className="text-destructive">Más de 10 años</span>
  if (cell.mes === 0) return <span className="text-muted-foreground">Ya liquidada</span>
  return (
    <>
      {formatPeriod(cell.periodo)} <span className="text-muted-foreground text-xs">(mes {cell.mes})</span>
    </>
  )
}

function Results({ sim, labelB, hasIncome }: { sim: Simulation; labelB: string; hasIncome: boolean }) {
  const c = sim.comparacion
  const a = sim.actual.result
  const b = sim.escenario.result
  const liq = useMemo(() => liquidationTable(sim), [sim])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>Diferencia = {labelB.toLowerCase()} − plan actual. En verde, lo que mejora.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Comparación entre el plan actual y {labelB.toLowerCase()}</caption>
              <thead className="text-muted-foreground border-b text-xs">
                <tr>
                  <th scope="col" className="py-2 pr-3 text-left font-medium" />
                  <th scope="col" className={th}>
                    Plan actual
                  </th>
                  <th scope="col" className={th}>
                    {labelB}
                  </th>
                  <th scope="col" className={th}>
                    Diferencia
                  </th>
                </tr>
              </thead>
              <tbody className="tabular">
                <tr className="border-b">
                  <th scope="row" className={rowTh}>
                    Libre de deudas
                  </th>
                  <td className={td}>{a.periodoLibre ? formatPeriod(a.periodoLibre) : 'Más de 10 años'}</td>
                  <td className={td}>{b.periodoLibre ? formatPeriod(b.periodoLibre) : 'Más de 10 años'}</td>
                  <td className={td}>
                    {c.mesLibre.diferencia == null ? (
                      '—'
                    ) : c.mesLibre.diferencia === 0 ? (
                      <span className="text-muted-foreground">mismo mes</span>
                    ) : (
                      <span
                        className={cn('font-medium', c.mesLibre.diferencia < 0 ? 'text-success' : 'text-destructive')}
                      >
                        {meses(Math.abs(c.mesLibre.diferencia))} {c.mesLibre.diferencia < 0 ? 'antes' : 'después'}
                      </span>
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <th scope="row" className={rowTh}>
                    Intereses y cargos
                  </th>
                  <td className={td}>{formatMoney(c.interesCargos.a)}</td>
                  <td className={td}>{formatMoney(c.interesCargos.b)}</td>
                  <td className={td}>
                    <Delta value={c.interesCargos.diferencia} />
                  </td>
                </tr>
                <tr className={cn(hasIncome && 'border-b')}>
                  <th scope="row" className={rowTh}>
                    Total pagado
                  </th>
                  <td className={td}>{formatMoney(c.totalPagado.a)}</td>
                  <td className={td}>{formatMoney(c.totalPagado.b)}</td>
                  <td className={td}>
                    <Delta value={c.totalPagado.diferencia} />
                  </td>
                </tr>
                {hasIncome && (
                  <tr>
                    <th scope="row" className={rowTh}>
                      Flujo libre
                      <span className="text-muted-foreground block text-xs font-normal">
                        acumulado en {meses(c.horizonte)}
                      </span>
                    </th>
                    <td className={td}>{formatMoney(c.flujoLibre.a)}</td>
                    <td className={td}>{formatMoney(c.flujoLibre.b)}</td>
                    <td className={td}>
                      <Delta value={c.flujoLibre.diferencia} lowerIsBetter={false} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PlanLinesChart
            data={sim.serie}
            series={[
              { key: 'a', label: 'Plan actual', color: 'var(--muted-foreground)', dashed: true },
              { key: 'b', label: labelB, color: seriesColor(0) },
            ]}
          />
          {b.advertencias.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {b.advertencias.map((w) => (
                <li key={w} className="text-warning-foreground flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-muted-foreground px-4 pt-3 text-left text-xs">
              Mes de liquidación por deuda
            </caption>
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Deuda
                </th>
                <th scope="col" className={th}>
                  Plan actual
                </th>
                <th scope="col" className={th}>
                  {labelB}
                </th>
              </tr>
            </thead>
            <tbody>
              {liq.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-1.5 text-left font-medium">
                    {r.nombre}
                  </th>
                  <td className={td}>{liquidationText(r.a)}</td>
                  <td className={td}>{liquidationText(r.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ pestañas */

interface TabProps {
  sources: PlanSources
  actual: StrategyParams
  ctx: { fechaInicio: string; periodoActual: string }
}

function StrategyTab({ sources, actual, ctx }: TabProps) {
  const [params, setParams] = useState<StrategyParams>(actual)
  const bounds = useMemo(() => budgetBounds(sources, actual.presupuestoDeudas), [sources, actual])
  const sim = useMemo(() => simulateStrategy(sources, actual, params, ctx), [sources, actual, params, ctx])
  const save = useSavePlan()
  const navigate = useNavigate()
  const changed =
    params.estrategia !== actual.estrategia ||
    params.presupuestoDeudas !== actual.presupuestoDeudas ||
    params.abonoExtra !== actual.abonoExtra
  const libre = sources.ingresoMensual != null ? sources.ingresoMensual - sources.gastosFijos : null

  const onSave = async () => {
    const nombre = defaultPlanName(params.estrategia, ctx.fechaInicio)
    try {
      await save.mutateAsync(
        buildSavePlanPayload(sim.escenario.input, sim.escenario.result, {
          nombre,
          activo: false,
          periodoActual: ctx.periodoActual,
        }),
      )
      toast.success(`${nombre} guardado`, {
        description: 'Podés activarlo como meta en Plan vs real.',
        action: { label: 'Ver planes', onClick: () => navigate('/plan') },
      })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5 [&>*]:min-w-0">
      <Card className="lg:col-span-2 lg:self-start">
        <CardHeader>
          <CardTitle>Escenario</CardTitle>
          <CardDescription>
            Plan actual: {ESTRATEGIA_LABEL[actual.estrategia].toLowerCase()} con {formatMoney(actual.presupuestoDeudas)}{' '}
            al mes
            {actual.abonoExtra > 0 && ` + ${formatMoney(actual.abonoExtra)}`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <StrategyChips
            value={params.estrategia}
            onChange={(estrategia) => setParams((p) => ({ ...p, estrategia }))}
          />
          <AmountSlider
            label="Presupuesto para deudas"
            value={params.presupuestoDeudas}
            onChange={(presupuestoDeudas) => setParams((p) => ({ ...p, presupuestoDeudas }))}
            min={bounds.min}
            max={bounds.max}
            hint={
              libre != null
                ? `Tu ingreso menos gastos fijos deja ${formatMoney(libre)} al mes.`
                : 'Registrá tu ingreso en Más para ver el flujo libre.'
            }
          />
          <AmountSlider
            label="Abono extra mensual"
            value={params.abonoExtra}
            onChange={(abonoExtra) => setParams((p) => ({ ...p, abonoExtra }))}
            min={0}
            max={3000}
            hint="Se suma al presupuesto y va a la deuda prioritaria de la estrategia."
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!changed} onClick={() => setParams(actual)}>
              <RotateCcw /> Restablecer
            </Button>
            <Button disabled={save.isPending} onClick={onSave}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar como plan
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="lg:col-span-3">
        <Results sim={sim} labelB="Simulación" hasIncome={sources.ingresoMensual != null} />
      </div>
    </div>
  )
}

function ConsolidationTab({ sources, actual, ctx }: TabProps) {
  const base = useMemo(() => simulateStrategy(sources, actual, actual, ctx).actual.input, [sources, actual, ctx])
  const [cancelar, setCancelar] = useState<string[]>([])
  const [monto, setMonto] = useState('')
  const [plazo, setPlazo] = useState('36')
  const [modo, setModo] = useState<'cuota' | 'tasa'>('cuota')
  const [valor, setValor] = useState('')
  const [sobranteA, setSobranteA] = useState('')
  const [abonoExtra, setAbonoExtra] = useState(0)
  const [redistribuir, setRedistribuir] = useState(false)

  const sugerido = suggestedLoanAmount(base, cancelar)
  const toggle = (id: string) => setCancelar((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const parsed = useMemo(() => {
    const m = parseAmount(monto)
    const n = /^\d+$/.test(plazo.trim()) ? Number(plazo) : Number.NaN
    const v = parseAmount(valor)
    const errors: Record<string, string> = {}
    if (m == null || Number.isNaN(m) || m <= 0) errors.monto = 'Ingresá el monto del préstamo'
    if (!(n >= 1 && n <= 120)) errors.plazo = 'Entre 1 y 120 meses'
    if (v == null || Number.isNaN(v) || v <= 0) {
      errors.valor = modo === 'cuota' ? 'Ingresá la cuota que ofrece el banco' : 'Ingresá la tasa anual'
    }
    return { errors, monto: m ?? 0, plazo: n, valor: v ?? 0 }
  }, [monto, plazo, valor, modo])

  const sim = useMemo(() => {
    if (Object.keys(parsed.errors).length > 0) return null
    try {
      return simulateConsolidation(
        sources,
        actual,
        {
          monto: parsed.monto,
          plazoMeses: parsed.plazo,
          cuota: modo === 'cuota' ? parsed.valor : null,
          tasaAnual: modo === 'tasa' ? parsed.valor / 100 : null,
          cancelar,
          aplicarSobranteA: sobranteA || null,
          abonoExtra,
          redistribuir,
        },
        ctx,
      )
    } catch {
      return null
    }
  }, [parsed, modo, cancelar, sobranteA, abonoExtra, redistribuir, sources, actual, ctx])

  const touched = monto !== '' || valor !== ''
  const setup = sim?.setup

  return (
    <div className="grid gap-4">
      <div
        role="note"
        className="border-destructive/30 bg-danger-soft flex items-start gap-3 rounded-2xl border p-4 text-sm"
      >
        <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          <span className="text-destructive font-semibold">
            Consolidar solo funciona si no vuelves a usar las tarjetas.
          </span>{' '}
          <span className="text-muted-foreground">
            Si las tarjetas canceladas se vuelven a llenar, terminás con el préstamo nuevo y las deudas de antes.
          </span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 [&>*]:min-w-0">
        <Card className="lg:col-span-2 lg:self-start">
          <CardHeader>
            <CardTitle>Préstamo nuevo</CardTitle>
            <CardDescription>Con el dinero se cancelan las deudas que elijas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Deudas a cancelar</legend>
              {base.debts.map((d) => {
                const c = cancellationAmount(d)
                const checked = cancelar.includes(d.id)
                return (
                  <label
                    key={d.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
                      checked ? 'border-primary bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={checked}
                      onChange={() => toggle(d.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{d.nombre}</span>
                      <span className="text-muted-foreground text-xs">
                        {d.tasaAnual == null ? 'tasa PENDIENTE' : `${formatPercent(d.tasaAnual)} anual`}
                      </span>
                    </span>
                    <span className="grid justify-items-end gap-0.5">
                      <Money value={c.monto} className="font-medium" />
                      {c.pendiente && <PendingBadge short className="text-[10px]" />}
                    </span>
                  </label>
                )
              })}
              {cancelar.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Para cancelarlas necesitás ≈ <Money value={sugerido} className="text-foreground font-medium" />.{' '}
                  <button
                    type="button"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                    onClick={() => setMonto(toInput(sugerido))}
                  >
                    Usar este monto
                  </button>
                </p>
              )}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Field id="monto" label="Monto" error={touched ? parsed.errors.monto : undefined}>
                <MoneyInput id="monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </Field>
              <Field id="plazo" label="Plazo (meses)" error={parsed.errors.plazo}>
                <Input
                  id="plazo"
                  inputMode="numeric"
                  className="tabular h-11"
                  value={plazo}
                  onChange={(e) => setPlazo(e.target.value)}
                />
              </Field>
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">El banco te da</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip selected={modo === 'cuota'} className="text-center" onClick={() => setModo('cuota')}>
                  La cuota
                </ChoiceChip>
                <ChoiceChip selected={modo === 'tasa'} className="text-center" onClick={() => setModo('tasa')}>
                  La tasa
                </ChoiceChip>
              </div>
              <Field
                id="valor"
                label={modo === 'cuota' ? 'Cuota mensual' : 'Tasa anual (%)'}
                error={touched ? parsed.errors.valor : undefined}
              >
                {modo === 'cuota' ? (
                  <MoneyInput id="valor" value={valor} onChange={(e) => setValor(e.target.value)} />
                ) : (
                  <Input
                    id="valor"
                    inputMode="decimal"
                    className="tabular h-11"
                    placeholder="24"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                )}
              </Field>
            </fieldset>

            <Field id="sobrante" label="Si sobra dinero, abonarlo a">
              <select
                id="sobrante"
                value={sobranteA}
                onChange={(e) => setSobranteA(e.target.value)}
                className="border-input bg-background h-11 rounded-lg border px-3 text-sm"
              >
                <option value="">Nada (queda en efectivo)</option>
                {base.debts
                  .filter((d) => !cancelar.includes(d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
              </select>
            </Field>

            <AmountSlider label="Abono extra mensual" value={abonoExtra} onChange={setAbonoExtra} min={0} max={3000} />
            <div className="flex items-start justify-between gap-3">
              <Label htmlFor="redistribuir" className="grid gap-0.5 font-normal">
                Reasignar cuotas liberadas
                <span className="text-muted-foreground text-xs">
                  Apagado: pagás solo las cuotas y lo liberado queda como flujo libre.
                </span>
              </Label>
              <Switch id="redistribuir" checked={redistribuir} onCheckedChange={setRedistribuir} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-3 lg:self-start">
          {setup && sim ? (
            <>
              <Card size="sm">
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        {modo === 'cuota' ? 'Tasa implícita' : 'Cuota mensual'}
                      </dt>
                      <dd className="tabular font-semibold">
                        {modo === 'cuota' ? `${formatPercent(setup.tasaAnual)} anual` : formatMoney(setup.cuota)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Se cancela</dt>
                      <dd className="font-semibold">
                        <Money value={setup.totalCancelado} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Presupuesto nuevo</dt>
                      <dd className="font-semibold">
                        <Money value={setup.input.presupuestoDeudas} />
                      </dd>
                    </div>
                    {setup.costoCancelacion > 0 && (
                      <div>
                        <dt className="text-muted-foreground text-xs">Costo de cancelar</dt>
                        <dd className="text-destructive font-semibold">
                          <Money value={setup.costoCancelacion} />
                        </dd>
                      </div>
                    )}
                    {setup.sobranteAplicado > 0 && (
                      <div>
                        <dt className="text-muted-foreground text-xs">Sobrante abonado</dt>
                        <dd className="font-semibold">
                          <Money value={setup.sobranteAplicado} />
                        </dd>
                      </div>
                    )}
                    {setup.sobranteLibre > 0 && (
                      <div>
                        <dt className="text-muted-foreground text-xs">Queda en efectivo</dt>
                        <dd className="font-semibold">
                          <Money value={setup.sobranteLibre} />
                        </dd>
                      </div>
                    )}
                  </dl>
                  {setup.advertencias.length > 0 && (
                    <ul className="mt-3 grid gap-1 text-sm">
                      {setup.advertencias.map((w) => (
                        <li key={w} className="text-warning-foreground flex gap-1.5">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Results sim={sim} labelB="Consolidando" hasIncome={sources.ingresoMensual != null} />
            </>
          ) : (
            <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
              Elegí las deudas a cancelar e ingresá el monto, el plazo y la cuota (o la tasa) que te ofrecen para ver la
              comparación.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ página */

export function SimulatorPage() {
  const { sources, error } = usePlanSources()
  const active = useActivePlan()
  const periodoActual = currentPeriod()
  const ctx = useMemo(() => ({ periodoActual, fechaInicio: defaultPlanStart(periodoActual) }), [periodoActual])
  const actual = useMemo(
    () => (sources && active.data !== undefined ? baseParams(sources.debts, active.data?.plan) : null),
    [sources, active.data],
  )

  const err = error ?? active.error
  return (
    <>
      <PageHeader
        title="Simulador"
        description={`Probá estrategias, abonos extra o un préstamo de consolidación desde ${formatPeriod(ctx.fechaInicio)}. Nada cambia hasta que lo guardés.`}
      />
      {err ? (
        <ErrorState error={err} />
      ) : !sources || !actual ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : sources.debts.every((d) => d.estado !== 'activa') ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
          No tenés deudas activas para simular.
        </p>
      ) : (
        <Tabs defaultValue="estrategia">
          <TabsList>
            <TabsTrigger value="estrategia">Estrategia y abonos</TabsTrigger>
            <TabsTrigger value="consolidar">Consolidar</TabsTrigger>
          </TabsList>
          <TabsContent value="estrategia" className="mt-3">
            <StrategyTab sources={sources} actual={actual} ctx={ctx} />
          </TabsContent>
          <TabsContent value="consolidar" className="mt-3">
            <ConsolidationTab sources={sources} actual={actual} ctx={ctx} />
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}
