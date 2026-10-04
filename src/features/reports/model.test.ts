import { describe, expect, it } from 'vitest'
import {
  breakdownByDebt,
  buildMonthlyReport,
  buildRangeReport,
  byCategory,
  rangeOptions,
  type DebtRow,
  type ExpenseRow,
  type PaymentRow,
  type TotalsRow,
} from './model'

// Datos sintéticos (no son los del seed real).
const total = (periodo: string, over: Partial<TotalsRow> = {}): TotalsRow => ({
  periodo,
  saldo_total: 1000,
  total_real: 1000,
  pagos: 0,
  interes_cargos: 0,
  capital: 0,
  compras_tarjeta: 0,
  gastos_total: 0,
  ingreso_mensual: 5000,
  gastos_fijos: 2000,
  ingresos_extra: 0,
  flujo_libre: 3000,
  ...over,
})
const totals: TotalsRow[] = [
  total('2025-12-01', { total_real: 12000 }),
  total('2026-01-01', { total_real: 11500, pagos: 800, interes_cargos: 300, capital: 500, flujo_libre: 2200 }),
  total('2026-02-01', {
    total_real: 11100.5,
    pagos: 700,
    interes_cargos: 250.25,
    capital: 449.75,
    compras_tarjeta: 120,
    gastos_total: 200,
    ingresos_extra: 1000,
    flujo_libre: 3300,
  }),
]
const pago = (
  id: string,
  debt_id: string,
  periodo: string,
  pago_total: number,
  interes: number | null,
  cargos: number | null = null,
): PaymentRow => ({
  id,
  debt_id,
  fecha: `${periodo.slice(0, 8)}15`,
  periodo,
  pago_total,
  interes,
  cargos,
  capital: Math.round((pago_total - (interes ?? 0) - (cargos ?? 0)) * 100) / 100,
  saldo_despues: 0,
  es_estimado: interes != null && cargos == null && id === 'p3',
})
const payments = [
  pago('p1', 'a', '2026-01-01', 500, 200, 20),
  pago('p2', 'b', '2026-01-01', 300, 80),
  pago('p3', 'a', '2026-02-01', 700, 250.25),
]
const gasto = (
  id: string,
  periodo: string,
  monto: number,
  categoria: string,
  metodo: ExpenseRow['metodo'],
  debt_id: string | null = null,
): ExpenseRow => ({
  id,
  fecha: `${periodo.slice(0, 8)}10`,
  periodo,
  descripcion: id,
  categoria,
  monto,
  metodo,
  debt_id,
})
const expenses = [
  gasto('g1', '2026-02-01', 120, 'Juegos', 'tarjeta', 'a'),
  gasto('g2', '2026-02-01', 50, 'Comida', 'efectivo'),
  gasto('g3', '2026-02-01', 30, 'Comida', 'debito'),
]
const debts: DebtRow[] = [
  { debt_id: 'a', nombre: 'Tarjeta', estado: 'activa', ultimo_pago: '2026-02-15', cerrada_en: null, prioridad: 1 },
  { debt_id: 'b', nombre: 'Préstamo', estado: 'liquidada', ultimo_pago: '2026-01-15', cerrada_en: null, prioridad: 2 },
  { debt_id: 'c', nombre: 'Vieja', estado: 'cerrada', ultimo_pago: null, cerrada_en: '2025-06-30', prioridad: 3 },
]

describe('reporte mensual', () => {
  const r = buildMonthlyReport('2026-02-01', totals, payments, expenses, debts)

  it('resume el mes con cambio de deuda y % de interés', () => {
    expect(r.cambioDeuda).toBe(-399.5)
    expect(r.pctInteres).toBeCloseTo(250.25 / 700)
    expect(r.pagos.map((p) => [p.id, p.nombre])).toEqual([['p3', 'Tarjeta']])
  })

  it('agrupa gastos por categoría y separa las compras con tarjeta', () => {
    expect(r.categorias).toEqual([
      { categoria: 'Juegos', monto: 120, cantidad: 1, porcentaje: 0.6 },
      { categoria: 'Comida', monto: 80, cantidad: 2, porcentaje: 0.4 },
    ])
    expect(r.compras.map((c) => [c.id, c.tarjeta])).toEqual([['g1', 'Tarjeta']])
    expect(r.gastosEfectivo).toBe(80)
  })

  it('el flujo resta los gastos pagados con dinero, no las compras con tarjeta', () => {
    expect(r.flujo).toEqual({
      ingreso: 5000,
      ingresosExtra: 1000,
      gastosFijos: 2000,
      pagos: 700,
      libre: 3300,
      despuesDeGastos: 3220,
    })
  })

  it('un mes sin datos queda vacío', () => {
    const vacio = buildMonthlyReport('2027-01-01', totals, payments, expenses, debts)
    expect(vacio).toMatchObject({ totales: null, cambioDeuda: null, pctInteres: null, pagos: [], categorias: [] })
    expect(vacio.flujo.libre).toBeNull()
  })
})

describe('reporte anual / rango', () => {
  const r = buildRangeReport('2026-01-01', '2026-12-01', totals, payments, expenses, debts)

  it('parte de la deuda del mes anterior al rango', () => {
    expect(r).toMatchObject({ meses: 2, deudaInicial: 12000, deudaFinal: 11100.5, cambio: -899.5 })
  })

  it('suma pagos, interés, capital y gastos del rango', () => {
    expect(r.totales).toEqual({
      pagos: 1500,
      interesCargos: 550.25,
      capital: 949.75,
      comprasTarjeta: 120,
      gastos: 200,
      ingresosExtra: 1000,
    })
    expect(r.pctInteres).toBeCloseTo(550.25 / 1500)
  })

  it('desglosa por deuda y lista las liquidadas en el rango', () => {
    expect(r.porDeuda.map((d) => [d.nombre, d.pagado, d.interesCargos, d.capital, d.estimado])).toEqual([
      ['Tarjeta', 1200, 470.25, 729.75, true],
      ['Préstamo', 300, 80, 220, false],
    ])
    expect(r.liquidadas).toEqual([{ debtId: 'b', nombre: 'Préstamo', fecha: '2026-01-15' }])
  })

  it('sin mes anterior usa el primer mes del rango', () => {
    expect(buildRangeReport('2025-12-01', '2026-01-01', totals, [], [], []).deudaInicial).toBe(12000)
  })
})

describe('utilidades', () => {
  it('breakdown y categorías vacíos', () => {
    expect(breakdownByDebt([], debts)).toEqual([])
    expect(byCategory([])).toEqual([])
  })

  it('ofrece los últimos 12 meses y cada año con datos', () => {
    expect(rangeOptions(['2025-11-01', '2026-01-01', '2026-10-01', '2026-11-01'], '2026-10-01')).toEqual([
      { id: '12m', label: 'Últimos 12 meses', desde: '2025-11-01', hasta: '2026-10-01' },
      { id: '2026', label: '2026', desde: '2026-01-01', hasta: '2026-10-01' },
      { id: '2025', label: '2025', desde: '2025-11-01', hasta: '2025-12-01' },
    ])
    expect(rangeOptions([], '2026-10-01')).toEqual([])
  })
})
