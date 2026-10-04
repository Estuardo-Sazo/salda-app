import { addMonths } from '@/lib/finance/period'

const round2 = (v: number) => Math.round(v * 100) / 100
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100)

export interface TotalsRow {
  periodo: string
  saldo_total: number
  total_real: number
  pagos: number
  interes_cargos: number
  capital: number
  compras_tarjeta: number
  gastos_total: number
  ingreso_mensual: number | null
  gastos_fijos: number
  ingresos_extra: number
  flujo_libre: number
}

export interface PaymentRow {
  id: string
  debt_id: string
  fecha: string
  periodo: string
  pago_total: number
  interes: number | null
  cargos: number | null
  capital: number | null
  saldo_despues: number
  es_estimado: boolean
}

export interface ExpenseRow {
  id: string
  fecha: string
  periodo: string
  descripcion: string
  categoria: string
  monto: number
  metodo: 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'
  debt_id: string | null
}

export interface DebtRow {
  debt_id: string
  nombre: string
  estado: 'activa' | 'liquidada' | 'cerrada'
  ultimo_pago: string | null
  cerrada_en: string | null
  prioridad: number | null
}

export interface DebtBreakdown {
  debtId: string
  nombre: string
  pagos: number
  pagado: number
  interesCargos: number
  capital: number
  /** Algún pago tiene el interés estimado. */
  estimado: boolean
}

export interface CategoryRow {
  categoria: string
  monto: number
  cantidad: number
  /** Fracción del total de gastos (0–1). */
  porcentaje: number
}

/** Pagos por deuda: interés + cargos vs capital. */
export function breakdownByDebt(
  payments: PaymentRow[],
  debts: Pick<DebtRow, 'debt_id' | 'nombre' | 'prioridad'>[],
): DebtBreakdown[] {
  const nombres = new Map(debts.map((d) => [d.debt_id, d]))
  const groups = new Map<string, PaymentRow[]>()
  for (const p of payments) groups.set(p.debt_id, [...(groups.get(p.debt_id) ?? []), p])
  return [...groups.entries()]
    .map(([debtId, ps]) => ({
      debtId,
      nombre: nombres.get(debtId)?.nombre ?? 'Deuda',
      pagos: ps.length,
      pagado: sum(ps.map((p) => p.pago_total)),
      interesCargos: sum(ps.map((p) => (p.interes ?? 0) + (p.cargos ?? 0))),
      capital: sum(ps.map((p) => p.capital ?? p.pago_total - (p.interes ?? 0) - (p.cargos ?? 0))),
      estimado: ps.some((p) => p.es_estimado),
    }))
    .sort(
      (a, b) =>
        (nombres.get(a.debtId)?.prioridad ?? 99) - (nombres.get(b.debtId)?.prioridad ?? 99) || b.pagado - a.pagado,
    )
}

/** Gastos agrupados por categoría, de mayor a menor. */
export function byCategory(expenses: Pick<ExpenseRow, 'categoria' | 'monto'>[]): CategoryRow[] {
  const total = sum(expenses.map((e) => e.monto))
  const groups = new Map<string, { monto: number; cantidad: number }>()
  for (const e of expenses) {
    const g = groups.get(e.categoria) ?? { monto: 0, cantidad: 0 }
    groups.set(e.categoria, { monto: round2(g.monto + e.monto), cantidad: g.cantidad + 1 })
  }
  return [...groups.entries()]
    .map(([categoria, g]) => ({ categoria, ...g, porcentaje: total > 0 ? g.monto / total : 0 }))
    .sort((a, b) => b.monto - a.monto || a.categoria.localeCompare(b.categoria))
}

export interface MonthlyReport {
  periodo: string
  totales: TotalsRow | null
  /** Cambio de la deuda real vs el mes anterior (negativo = bajó). */
  cambioDeuda: number | null
  /** Interés + cargos / pagos. */
  pctInteres: number | null
  pagos: (PaymentRow & { nombre: string })[]
  porDeuda: DebtBreakdown[]
  categorias: CategoryRow[]
  compras: (ExpenseRow & { tarjeta: string })[]
  /** Gastos pagados con dinero (efectivo, débito, transferencia). */
  gastosEfectivo: number
  flujo: {
    ingreso: number | null
    ingresosExtra: number
    gastosFijos: number
    pagos: number
    libre: number | null
    /** Flujo libre menos gastos pagados con dinero (las compras con tarjeta son deuda nueva). */
    despuesDeGastos: number | null
  }
}

export function buildMonthlyReport(
  periodo: string,
  totals: TotalsRow[],
  payments: PaymentRow[],
  expenses: ExpenseRow[],
  debts: DebtRow[],
): MonthlyReport {
  const byPeriod = new Map(totals.map((t) => [t.periodo, t]))
  const t = byPeriod.get(periodo) ?? null
  const prev = byPeriod.get(addMonths(periodo, -1))
  const nombres = new Map(debts.map((d) => [d.debt_id, d.nombre]))
  const pagosMes = payments.filter((p) => p.periodo === periodo)
  const gastosMes = expenses.filter((e) => e.periodo === periodo)
  const gastosEfectivo = sum(gastosMes.filter((e) => e.metodo !== 'tarjeta').map((e) => e.monto))
  const ingreso = t?.ingreso_mensual ?? null
  const libre = t && ingreso != null ? t.flujo_libre : null

  return {
    periodo,
    totales: t,
    cambioDeuda: t && prev ? round2(t.total_real - prev.total_real) : null,
    pctInteres: t && t.pagos > 0 ? t.interes_cargos / t.pagos : null,
    pagos: pagosMes
      .map((p) => ({ ...p, nombre: nombres.get(p.debt_id) ?? 'Deuda' }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porDeuda: breakdownByDebt(pagosMes, debts),
    categorias: byCategory(gastosMes),
    compras: gastosMes
      .filter((e) => e.metodo === 'tarjeta')
      .map((e) => ({ ...e, tarjeta: (e.debt_id && nombres.get(e.debt_id)) || 'Tarjeta' }))
      .sort((a, b) => b.monto - a.monto),
    gastosEfectivo,
    flujo: {
      ingreso,
      ingresosExtra: t?.ingresos_extra ?? 0,
      gastosFijos: t?.gastos_fijos ?? 0,
      pagos: t?.pagos ?? 0,
      libre,
      despuesDeGastos: libre == null ? null : round2(libre - gastosEfectivo),
    },
  }
}

export interface RangeReport {
  desde: string
  hasta: string
  meses: number
  serie: { periodo: string; total_real: number; capital: number; interes: number }[]
  deudaInicial: number | null
  deudaFinal: number | null
  /** Deuda final − inicial (negativo = bajó). */
  cambio: number | null
  totales: {
    pagos: number
    interesCargos: number
    capital: number
    comprasTarjeta: number
    gastos: number
    ingresosExtra: number
  }
  pctInteres: number | null
  porDeuda: DebtBreakdown[]
  categorias: CategoryRow[]
  liquidadas: { debtId: string; nombre: string; fecha: string }[]
}

/**
 * Evolución en un rango de meses. La deuda inicial es la del mes anterior al rango (cómo empezó)
 * o, si no hay, la del primer mes.
 */
export function buildRangeReport(
  desde: string,
  hasta: string,
  totals: TotalsRow[],
  payments: PaymentRow[],
  expenses: ExpenseRow[],
  debts: DebtRow[],
): RangeReport {
  const enRango = <T extends { periodo: string }>(x: T) => x.periodo >= desde && x.periodo <= hasta
  const rows = totals.filter(enRango).sort((a, b) => a.periodo.localeCompare(b.periodo))
  const antes = totals.find((t) => t.periodo === addMonths(desde, -1))
  const inicial = antes?.total_real ?? rows[0]?.total_real ?? null
  const final = rows.at(-1)?.total_real ?? null
  const pagos = payments.filter(enRango)
  const pagosTotal = sum(rows.map((r) => r.pagos))
  const interes = sum(rows.map((r) => r.interes_cargos))
  const finRango = `${hasta.slice(0, 7)}-31`

  return {
    desde,
    hasta,
    meses: rows.length,
    serie: rows.map((r) => ({
      periodo: r.periodo,
      total_real: r.total_real,
      capital: r.capital,
      interes: r.interes_cargos,
    })),
    deudaInicial: inicial,
    deudaFinal: final,
    cambio: inicial != null && final != null ? round2(final - inicial) : null,
    totales: {
      pagos: pagosTotal,
      interesCargos: interes,
      capital: sum(rows.map((r) => r.capital)),
      comprasTarjeta: sum(rows.map((r) => r.compras_tarjeta)),
      gastos: sum(rows.map((r) => r.gastos_total)),
      ingresosExtra: sum(rows.map((r) => r.ingresos_extra)),
    },
    pctInteres: pagosTotal > 0 ? interes / pagosTotal : null,
    porDeuda: breakdownByDebt(pagos, debts),
    categorias: byCategory(expenses.filter(enRango)),
    liquidadas: debts
      .filter((d) => d.estado !== 'activa')
      .map((d) => ({ debtId: d.debt_id, nombre: d.nombre, fecha: d.cerrada_en ?? d.ultimo_pago }))
      .filter(
        (d): d is { debtId: string; nombre: string; fecha: string } =>
          d.fecha != null && d.fecha >= desde && d.fecha <= finRango,
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

/** Opciones de rango: cada año con datos y los últimos 12 meses. */
export function rangeOptions(
  periodos: string[],
  actual: string,
): { id: string; label: string; desde: string; hasta: string }[] {
  if (periodos.length === 0) return []
  const sorted = [...periodos].sort()
  const first = sorted[0]!
  const last = sorted.at(-1)! > actual ? actual : sorted.at(-1)!
  const years = [...new Set(sorted.map((p) => p.slice(0, 4)))].sort().reverse()
  const ultimo12 = addMonths(last, -11)
  return [
    { id: '12m', label: 'Últimos 12 meses', desde: ultimo12 < first ? first : ultimo12, hasta: last },
    ...years.map((y) => {
      const desde = `${y}-01-01` < first ? first : `${y}-01-01`
      const hasta = `${y}-12-01` > last ? last : `${y}-12-01`
      return { id: y, label: y, desde, hasta }
    }),
  ]
}
