import {
  buildConsolidation,
  compareScenarios,
  CONSOLIDATION_ID,
  projectPlan,
  type ConsolidationOptions,
  type ConsolidationSetup,
  type PlanInput,
  type PlanResult,
  type ScenarioComparison,
  type Strategy,
} from '@/lib/finance'
import { addMonths } from '@/lib/finance/period'
import { buildPlanInput, suggestedBudget, type PlanDebtSource, type PlanSources } from '@/features/plan/plan-input'

export interface StrategyParams {
  estrategia: Strategy
  presupuestoDeudas: number
  abonoExtra: number
}

/** Parámetros del plan activo (o una avalancha con la suma de cuotas si no hay plan). */
export function baseParams(
  debts: PlanDebtSource[],
  active: { estrategia: Strategy; presupuesto_deudas: number; abono_extra: number } | null | undefined,
): StrategyParams {
  return {
    estrategia: active?.estrategia ?? 'avalancha',
    presupuestoDeudas: suggestedBudget(debts, active?.presupuesto_deudas),
    abonoExtra: active?.abono_extra ?? 0,
  }
}

/** Rango del slider de presupuesto: desde la suma de cuotas hasta lo que deja el ingreso. */
export function budgetBounds(sources: PlanSources, actual: number): { min: number; max: number } {
  const cuotas = suggestedBudget(sources.debts, null)
  const libre = sources.ingresoMensual != null ? sources.ingresoMensual - sources.gastosFijos : 0
  const min = Math.floor(Math.min(cuotas, actual) / 50) * 50
  const max = Math.ceil(Math.max(libre, cuotas * 1.5, actual) / 50) * 50
  return { min, max: Math.max(max, min + 50) }
}

export interface ScenarioResult {
  input: PlanInput
  result: PlanResult
}

export interface Simulation {
  actual: ScenarioResult
  escenario: ScenarioResult
  comparacion: ScenarioComparison
  /** Curvas de deuda real de ambos escenarios, con el punto de partida en el mes 0. */
  serie: { periodo: string; a: number | null; b: number | null }[]
  /** Flujo libre de un mes sin deudas (para comparar flujos en el mismo horizonte). */
  libreSinDeuda: number
}

export function curveSeries(a: PlanResult, b: PlanResult, fechaInicio: string): Simulation['serie'] {
  const n = Math.max(a.meses.length, b.meses.length)
  const serie: Simulation['serie'] = [{ periodo: addMonths(fechaInicio, -1), a: a.deudaInicial, b: b.deudaInicial }]
  for (let i = 0; i < n; i++) {
    serie.push({
      periodo: addMonths(fechaInicio, i),
      a: a.meses[i]?.deudaReal ?? (a.mesLibre != null ? 0 : null),
      b: b.meses[i]?.deudaReal ?? (b.mesLibre != null ? 0 : null),
    })
  }
  return serie
}

function compare(actual: ScenarioResult, escenario: ScenarioResult, sources: PlanSources): Simulation {
  const libreSinDeuda = sources.ingresoMensual != null ? sources.ingresoMensual - sources.gastosFijos : 0
  return {
    actual,
    escenario,
    comparacion: compareScenarios(actual.result, escenario.result, libreSinDeuda),
    serie: curveSeries(actual.result, escenario.result, actual.input.fechaInicio),
    libreSinDeuda,
  }
}

interface Context {
  fechaInicio: string
  periodoActual: string
}

function run(sources: PlanSources, params: StrategyParams, ctx: Context): ScenarioResult {
  const input = buildPlanInput(sources, { ...params, ...ctx })
  return { input, result: projectPlan(input) }
}

/** Plan actual vs otra estrategia, presupuesto o abono extra. */
export function simulateStrategy(
  sources: PlanSources,
  actual: StrategyParams,
  escenario: StrategyParams,
  ctx: Context,
): Simulation {
  return compare(run(sources, actual, ctx), run(sources, escenario, ctx), sources)
}

export interface ConsolidationParams extends Omit<ConsolidationOptions, 'nombre'> {
  abonoExtra: number
  /** true = lo que se libera al liquidar se reparte (avalancha); false = solo cuotas + abono extra. */
  redistribuir: boolean
}

export interface ConsolidationSimulation extends Simulation {
  setup: ConsolidationSetup
}

/** Plan actual vs tomar un préstamo nuevo para cancelar deudas (sección 6.2, escenario de consolidación). */
export function simulateConsolidation(
  sources: PlanSources,
  actual: StrategyParams,
  params: ConsolidationParams,
  ctx: Context,
): ConsolidationSimulation {
  const base = run(sources, actual, ctx)
  const { abonoExtra, redistribuir, ...opts } = params
  const setup = buildConsolidation(
    { ...base.input, estrategia: redistribuir ? 'avalancha' : 'cuotas_fijas', abonoExtra },
    { ...opts, nombre: 'Préstamo nuevo' },
  )
  const escenario = { input: setup.input, result: projectPlan(setup.input) }
  return { ...compare(base, escenario, sources), setup }
}

/** Lo que costaría cancelar una deuda: saldo de cancelación del banco o, si falta, la deuda real. */
export function cancellationAmount(
  debt: Pick<PlanInput['debts'][number], 'saldo' | 'saldoCancelacion' | 'installments'>,
): { monto: number; pendiente: boolean } {
  if (debt.saldoCancelacion != null) return { monto: debt.saldoCancelacion, pendiente: false }
  const fuera = (debt.installments ?? []).reduce(
    (acc, i) =>
      acc + Math.round((i.capitalPendiente ?? (i.montoCuota - i.cargoExtraPorCuota) * i.cuotasRestantes) * 100),
    0,
  )
  return { monto: (Math.round(debt.saldo * 100) + fuera) / 100, pendiente: true }
}

/** Monto sugerido del préstamo: lo necesario para cancelar las deudas elegidas, redondeado a Q100. */
export function suggestedLoanAmount(input: PlanInput, cancelar: string[]): number {
  const total = input.debts
    .filter((d) => cancelar.includes(d.id))
    .reduce((acc, d) => acc + cancellationAmount(d).monto, 0)
  return Math.ceil(total / 100) * 100
}

/** null = no se liquida en el horizonte; 'cancelada' = se paga con el préstamo; 'no-aplica' = no existe en ese escenario. */
export type LiquidationCell = { mes: number; periodo: string } | null | 'cancelada' | 'no-aplica'

export interface LiquidationRow {
  id: string
  nombre: string
  a: LiquidationCell
  b: LiquidationCell
}

/** Mes en que se liquida cada deuda en ambos escenarios. */
export function liquidationTable(sim: Simulation): LiquidationRow[] {
  const enB = new Set(sim.escenario.input.debts.map((d) => d.id))
  const rows: LiquidationRow[] = sim.actual.input.debts.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    a: sim.actual.result.liquidaciones[d.id] ?? null,
    b: enB.has(d.id) ? (sim.escenario.result.liquidaciones[d.id] ?? null) : 'cancelada',
  }))
  const nuevo = sim.escenario.input.debts.find((d) => d.id === CONSOLIDATION_ID)
  if (nuevo) {
    rows.unshift({
      id: nuevo.id,
      nombre: nuevo.nombre,
      a: 'no-aplica',
      b: sim.escenario.result.liquidaciones[nuevo.id] ?? null,
    })
  }
  return rows
}
