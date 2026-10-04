import { describe, expect, it } from 'vitest'
import type { ActivePlan, DebtStatus, MonthlyTotals } from '@/features/common/queries'
import { buildDashboard } from './model'

const totals = (periodo: string, saldo: number, fuera = 0, extra: Partial<MonthlyTotals> = {}): MonthlyTotals => ({
  user_id: 'u',
  periodo,
  saldo_total: saldo,
  cuotas_fuera_saldo: fuera,
  total_real: saldo + fuera,
  pagos: 0,
  interes_cargos: 0,
  capital: 0,
  compras_tarjeta: 0,
  gastos_total: 0,
  ingreso_mensual: 9000,
  gastos_fijos: 3050,
  flujo_libre: 5950,
  ingresos_extra: 0,
  ...extra,
})

const debt = (id: string, dia: number, prioridad: number): DebtStatus =>
  ({ debt_id: id, nombre: id, dia_pago: dia, cuota_mensual: 100, estado: 'activa', prioridad }) as DebtStatus

const plan: ActivePlan = {
  plan: {
    fecha_inicio: '2026-11-01',
    supuestos: { resumen: { deuda_inicial: 58665.4, periodo_libre: '2028-02-01' } },
  } as ActivePlan['plan'],
  totals: [
    { periodo: '2026-11-01', saldo: 55400, pago: 4550, interes_cargos: 1284.6 },
    { periodo: '2026-12-01', saldo: 52100, pago: 4550, interes_cargos: 1250 },
  ],
}

describe('buildDashboard', () => {
  const base = {
    totals: [
      totals('2026-01-01', 75445.85),
      totals('2026-09-01', 58116.2, 0, { compras_tarjeta: 426.45 }),
      totals('2026-10-01', 56200, 2465.4, { pagos: 1650, interes_cargos: 388.14 }),
    ],
    balances: [],
    debts: [debt('tarjeta', 27, 2), debt('vehiculo', 5, 4)],
    plan,
    paidDebtIds: new Set(['vehiculo']),
  }

  it('KPIs del mes actual', () => {
    const m = buildDashboard({ ...base, periodo: '2026-10-01' })
    expect(m.deudaReal).toBe(58665.4)
    expect(m.cambioMes).toBe(-1916.2)
    expect(m.cambioDesdeInicio).toBe(-19245.85)
    expect(m.pctIntereses).toBeCloseTo(0.2352, 4)
    expect(m.meta).toBeNull()
    expect(m.libre).toEqual({ periodo: '2028-02-01', meses: 16 })
    expect(m.proximosPagos.map((p) => [p.debtId, p.pagado])).toEqual([
      ['tarjeta', false],
      ['vehiculo', true],
    ])
  })

  it('la serie de la meta arranca en la deuda inicial del plan', () => {
    const m = buildDashboard({ ...base, periodo: '2026-10-01' })
    expect(m.serie.find((s) => s.periodo === '2026-10-01')?.meta).toBe(58665.4)
    expect(m.serie.at(-1)).toEqual({ periodo: '2026-12-01', real: null, meta: 52100 })
  })

  it('real vs meta: positivo = atrasado', () => {
    const m = buildDashboard({
      ...base,
      periodo: '2026-11-01',
      totals: [...base.totals, totals('2026-11-01', 53000, 2600, { compras_tarjeta: 120 })],
    })
    expect(m.meta).toEqual({ periodo: '2026-11-01', saldo: 55400, diferencia: 200 })
    expect(m.comprasTarjeta).toBe(120)
  })

  it('detalla la deuda nueva con la tasa ponderada de las tarjetas usadas', () => {
    const m = buildDashboard({
      ...base,
      periodo: '2026-10-01',
      debts: [{ ...debt('tarjeta', 27, 2), tasa_anual: 0.48 }, debt('vehiculo', 5, 4)],
      expenses: [
        {
          id: 'a',
          descripcion: 'Streaming',
          monto: 89,
          categoria: 'Suscripción',
          metodo: 'tarjeta',
          debt_id: 'tarjeta',
        },
        { id: 'b', descripcion: 'Súper', monto: 300, categoria: 'Comida', metodo: 'tarjeta', debt_id: 'tarjeta' },
        { id: 'c', descripcion: 'Almuerzo', monto: 45, categoria: 'Comida', metodo: 'efectivo', debt_id: null },
      ],
    })
    expect(m.compras.tasa).toBe(0.48)
    expect(m.compras.interesMes).toBeCloseTo((389 * 0.48) / 12, 2)
    expect(m.compras.items.map((c) => [c.descripcion, c.tarjeta])).toEqual([
      ['Súper', 'tarjeta'],
      ['Streaming', 'tarjeta'],
    ])
  })
})
