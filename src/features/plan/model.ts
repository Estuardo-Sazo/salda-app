import { addMonths } from '@/lib/finance/period'

const round2 = (v: number) => Math.round(v * 100) / 100

/** Diferencia real − meta: ≤ 0 es ir adelantado (bueno), > 0 es ir atrasado (malo). */
export type DiffTone = 'good' | 'bad'
export const diffTone = (diferencia: number): DiffTone => (diferencia <= 0 ? 'good' : 'bad')

export interface BalanceSource {
  periodo: string
  debt_id: string
  saldo: number
  cuotas_fuera_saldo: number
  origen: 'historial' | 'registro' | 'manual'
  es_registrado: boolean
}

export interface TotalsSource {
  periodo: string
  saldo_total: number
  cuotas_fuera_saldo: number
  total_real: number
}

export interface PlanRowSource {
  periodo: string
  debt_id: string | null
  saldo: number
  pago: number
  interes_cargos: number
}

export interface BalanceCell {
  saldo: number
  cuotasFuera: number
  origen: BalanceSource['origen']
  /** false = no hay saldo de ese mes y se arrastra el último conocido. */
  registrado: boolean
}

export interface BalanceRow {
  periodo: string
  celdas: Record<string, BalanceCell | undefined>
  saldoTotal: number
  cuotasFuera: number
  totalReal: number
  /** Cambio de saldos vs el mes anterior (las cuotas fuera de saldo se registran desde hace poco). */
  cambio: number | null
  meta: number | null
  diferencia: number | null
}

/** Tabla período × deuda con totales, cambio y diferencia contra la meta. Más reciente primero. */
export function buildBalanceTable(
  balances: BalanceSource[],
  totals: TotalsSource[],
  planTotals: Pick<PlanRowSource, 'periodo' | 'saldo'>[],
): BalanceRow[] {
  const celdas = new Map<string, BalanceRow['celdas']>()
  for (const b of balances) {
    const row = celdas.get(b.periodo) ?? {}
    row[b.debt_id] = {
      saldo: b.saldo,
      cuotasFuera: b.cuotas_fuera_saldo,
      origen: b.origen,
      registrado: b.es_registrado,
    }
    celdas.set(b.periodo, row)
  }
  const metas = new Map(planTotals.map((r) => [r.periodo, r.saldo]))
  const byPeriod = new Map(totals.map((t) => [t.periodo, t]))

  return [...totals]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((t) => {
      const prev = byPeriod.get(addMonths(t.periodo, -1))
      const meta = metas.get(t.periodo) ?? null
      return {
        periodo: t.periodo,
        celdas: celdas.get(t.periodo) ?? {},
        saldoTotal: t.saldo_total,
        cuotasFuera: t.cuotas_fuera_saldo,
        totalReal: t.total_real,
        cambio: prev ? round2(t.saldo_total - prev.saldo_total) : null,
        meta,
        diferencia: meta == null ? null : round2(t.total_real - meta),
      }
    })
    .reverse()
}

export interface PlanVsRealRow {
  periodo: string
  mes: number
  meta: number
  pago: number
  interesCargos: number
  real: number | null
  diferencia: number | null
}

/** Filas de totales de un plan (debt_id null), en orden. */
export const planTotalsOf = (rows: PlanRowSource[]) =>
  rows.filter((r) => r.debt_id == null).sort((a, b) => a.periodo.localeCompare(b.periodo))

/** Meta del plan mes a mes contra la deuda real registrada. */
export function buildPlanVsReal(rows: PlanRowSource[], totals: TotalsSource[]): PlanVsRealRow[] {
  const real = new Map(totals.map((t) => [t.periodo, t.total_real]))
  return planTotalsOf(rows).map((r, i) => {
    const r2 = real.get(r.periodo) ?? null
    return {
      periodo: r.periodo,
      mes: i + 1,
      meta: r.saldo,
      pago: r.pago,
      interesCargos: r.interes_cargos,
      real: r2,
      diferencia: r2 == null ? null : round2(r2 - r.saldo),
    }
  })
}

/** Saldo planeado por deuda y mes (para la pestaña "Por deuda"). */
export function planByDebt(rows: PlanRowSource[]): { periodo: string; saldos: Record<string, number> }[] {
  const map = new Map<string, Record<string, number>>()
  for (const r of rows) {
    if (r.debt_id == null) continue
    const row = map.get(r.periodo) ?? {}
    row[r.debt_id] = r.saldo
    map.set(r.periodo, row)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, saldos]) => ({ periodo, saldos }))
}

export interface PlanSummary {
  deudaInicial: number
  totalPagado: number
  totalInteresCargos: number
  mesLibre: number | null
  periodoLibre: string | null
}

export interface PlanMetricDiff {
  a: number
  b: number
  /** b − a: negativo = el plan B cuesta menos. */
  diferencia: number
}

export interface PlanComparison {
  totalPagado: PlanMetricDiff
  interesCargos: PlanMetricDiff
  mesLibre: { a: string | null; b: string | null; meses: number | null }
}

/** Compara dos planes guardados con su resumen (supuestos.resumen). */
export function comparePlans(a: PlanSummary, b: PlanSummary): PlanComparison {
  const metric = (x: number, y: number) => ({ a: x, b: y, diferencia: round2(y - x) })
  return {
    totalPagado: metric(a.totalPagado, b.totalPagado),
    interesCargos: metric(a.totalInteresCargos, b.totalInteresCargos),
    mesLibre: {
      a: a.periodoLibre,
      b: b.periodoLibre,
      meses: a.periodoLibre && b.periodoLibre ? monthDiff(a.periodoLibre, b.periodoLibre) : null,
    },
  }
}

function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number)
  const [y2, m2] = to.split('-').map(Number)
  return (y2! - y1!) * 12 + (m2! - m1!)
}

/** Serie para graficar varias metas (y la deuda real) sobre el mismo eje de meses. */
export function buildCompareSeries(
  plans: { id: string; rows: PlanRowSource[] }[],
  totals: TotalsSource[],
): { periodo: string; real: number | null; [planId: string]: number | string | null }[] {
  const periodos = new Set<string>()
  const metas = plans.map((p) => {
    const m = new Map(planTotalsOf(p.rows).map((r) => [r.periodo, r.saldo]))
    for (const k of m.keys()) periodos.add(k)
    return { id: p.id, m }
  })
  if (periodos.size === 0) return []
  const real = new Map(totals.map((t) => [t.periodo, t.total_real]))
  return [...periodos].sort().map((periodo) => ({
    periodo,
    real: real.get(periodo) ?? null,
    ...Object.fromEntries(metas.map(({ id, m }) => [id, m.get(periodo) ?? null])),
  }))
}

/** Resumen de un plan a partir de sus filas de totales (no depende de `supuestos`). */
export function summarizePlanRows(rows: PlanRowSource[]): PlanSummary {
  const totales = planTotalsOf(rows)
  const last = totales.at(-1)
  const libre = last != null && last.saldo < 0.01
  return {
    deudaInicial: 0,
    totalPagado: round2(totales.reduce((acc, r) => acc + r.pago, 0)),
    totalInteresCargos: round2(totales.reduce((acc, r) => acc + r.interes_cargos, 0)),
    mesLibre: libre ? totales.length : null,
    periodoLibre: libre ? last.periodo : null,
  }
}
