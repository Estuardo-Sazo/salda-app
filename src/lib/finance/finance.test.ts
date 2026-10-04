import { describe, expect, it } from 'vitest'
import exampleJson from '../../../seed/initial-data.example.json'
import { seedToPlanInput } from '@/lib/seed/to-plan-input'
import type { SeedData } from '@/lib/seed/types'
import {
  addMonths,
  buildConsolidation,
  compareScenarios,
  impliedMonthlyRate,
  loanPayment,
  loanPaymentCeil,
  monthlyRate,
  monthsBetween,
  monthsToPayoff,
  normalizePeriod,
  projectPlan,
  type DebtInput,
  type PlanInput,
} from './index'

// Datos sintéticos: los valores reales de la sección 6.3 viven en seed-acceptance.private.test.ts (local).
const closeTo = (actual: number, expected: number, tolerance = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)

const loan = (id: string, saldo: number, tasaAnual: number | null, cuota: number, extra: Partial<DebtInput> = {}) =>
  ({ id, nombre: id, tipo: 'prestamo', saldo, tasaAnual, cuotaMensual: cuota, seguroMensual: 0, ...extra }) as DebtInput
const card = (id: string, saldo: number, tasaAnual: number | null, cuota: number, extra: Partial<DebtInput> = {}) =>
  ({ ...loan(id, saldo, tasaAnual, cuota), tipo: 'tarjeta', ...extra }) as DebtInput
const plan = (debts: DebtInput[], extra: Partial<PlanInput> = {}): PlanInput => ({
  debts,
  estrategia: 'avalancha',
  presupuestoDeudas: debts.reduce((a, d) => a + d.cuotaMensual, 0),
  fechaInicio: '2026-11-01',
  ingresoMensual: 5000,
  gastosFijos: 2000,
  ...extra,
})

describe('tasas y cuotas', () => {
  it('monthlyRate divide la tasa nominal entre 12', () => {
    expect(monthlyRate(0.6)).toBeCloseTo(0.05, 10)
  })

  it('impliedMonthlyRate(60000, 36, 2454.35) ≈ 0.022625 (27.15 % anual)', () => {
    const r = impliedMonthlyRate(60000, 36, 2454.35)
    expect(r).toBeCloseTo(0.022625, 5)
    expect(r * 12).toBeCloseTo(0.2715, 3)
  })

  it('loanPayment es la inversa de impliedMonthlyRate', () => {
    expect(loanPayment(60000, 0.022625, 36)).toBeCloseTo(2454.35, 0)
    expect(loanPayment(1200, 0, 12)).toBe(100)
    expect(() => loanPayment(1000, 0.01, 0)).toThrow()
  })

  it('impliedMonthlyRate devuelve 0 si no hay interés', () => {
    expect(impliedMonthlyRate(1200, 12, 100)).toBe(0)
  })

  it('monthsToPayoff', () => {
    expect(monthsToPayoff(0, 0.01, 100)).toBe(0)
    expect(monthsToPayoff(1200, 0, 100)).toBe(12)
    expect(monthsToPayoff(1000, 0.05, 50)).toBeNull()
    expect(monthsToPayoff(60000, 0.022625, 2454.35)).toBe(36)
    expect(monthsToPayoff(100, 0.01, 0)).toBeNull()
  })
})

describe('períodos', () => {
  it('suma y resta meses', () => {
    expect(addMonths('2026-11-01', 11)).toBe('2027-10-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(monthsBetween('2026-11-01', '2028-02-01')).toBe(15)
    expect(normalizePeriod('2026-10')).toBe('2026-10-01')
    expect(() => normalizePeriod('oct 2026')).toThrow()
  })
})

describe('projectPlan', () => {
  it('préstamo sin interés: 12 cuotas exactas', () => {
    const r = projectPlan(plan([loan('a', 1200, 0, 100)]))
    expect(r.mesLibre).toBe(12)
    expect(r.periodoLibre).toBe('2027-10-01')
    expect(r.totalPagado).toBe(1200)
    expect(r.totalInteresCargos).toBe(0)
    expect(r.liquidaciones.a).toEqual({ mes: 12, periodo: '2027-10-01' })
  })

  it('préstamo francés: interés total = cuotas − capital', () => {
    const tasa = impliedMonthlyRate(60000, 36, 2454.35) * 12
    const r = projectPlan(plan([loan('a', 60000, tasa, 2454.35)]))
    expect(r.mesLibre).toBe(36)
    closeTo(r.totalInteresCargos, 36 * 2454.35 - 60000, 1)
  })

  it('tarjeta: interés + seguro + cuota fuera de saldo con cargo extra (mes 1)', () => {
    const debt = card('t', 1000, 0.24, 300, {
      seguroMensual: 10,
      installments: [
        { descripcion: 'VC', montoCuota: 110, cuotasRestantes: 2, capitalPendiente: null, cargoExtraPorCuota: 10 },
      ],
    })
    const r = projectPlan(plan([debt]))
    const m1 = r.meses[0]!
    expect(r.deudaInicial).toBe(1200) // 1000 + 2 × (110 − 10)
    expect(m1.deudas.t).toEqual({ saldo: 840, fueraSaldo: 100, total: 940, pago: 300, interes: 20, cargos: 20 })
    expect(m1.interesCargos).toBe(40)
    closeTo(r.deudaInicial + r.totalInteresCargos, r.totalPagado)
    expect(r.supuestos.join(' ')).toContain('Q10.00')
  })

  it('los textos del plan usan la moneda del usuario', () => {
    const debt = card('t', 1000, 0.24, 300, { seguroMensual: 1500 })
    const usd = projectPlan(plan([debt], { moneda: 'USD' }))
    expect(usd.supuestos.join(' ')).toContain('seguro de $1,500.00')
    const gtq = projectPlan(plan([debt]))
    expect(gtq.supuestos.join(' ')).toContain('seguro de Q1,500.00')
  })

  it('capital_pendiente manda sobre monto × cuotas', () => {
    const debt = card('t', 0, 0, 500, {
      installments: [
        { descripcion: 'X', montoCuota: 200, cuotasRestantes: 3, capitalPendiente: 450, cargoExtraPorCuota: 0 },
      ],
    })
    const r = projectPlan(plan([debt]))
    expect(r.deudaInicial).toBe(450)
    expect(r.mesLibre).toBe(3)
    expect(r.totalPagado).toBe(450)
  })

  const dos = [loan('cara', 1000, 0.6, 100), loan('chica', 500, 0.12, 100)]

  it('avalancha aplica el sobrante a la mayor tasa', () => {
    const m1 = projectPlan(plan(dos, { presupuestoDeudas: 500 })).meses[0]!
    expect(m1.deudas.cara!.pago).toBe(400)
    expect(m1.deudas.chica!.pago).toBe(100)
  })

  it('bola de nieve aplica el sobrante al menor saldo', () => {
    const m1 = projectPlan(plan(dos, { presupuestoDeudas: 500, estrategia: 'bola_nieve' })).meses[0]!
    expect(m1.deudas.chica!.pago).toBe(400)
    expect(m1.deudas.cara!.pago).toBe(100)
  })

  it('cuotas fijas no redistribuye y libera flujo; avalancha paga menos interés', () => {
    const fijas = projectPlan(plan(dos, { presupuestoDeudas: 500, estrategia: 'cuotas_fijas' }))
    const avalancha = projectPlan(plan(dos, { presupuestoDeudas: 500 }))
    expect(fijas.meses[0]!.pago).toBe(200)
    expect(fijas.meses[0]!.flujoLibre).toBe(5000 - 2000 - 200)
    expect(avalancha.totalInteresCargos).toBeLessThan(fijas.totalInteresCargos)
    expect(avalancha.mesLibre!).toBeLessThan(fijas.mesLibre!)
  })

  it('cuotas fijas sí aplica el abono extra (a la mayor tasa)', () => {
    const m1 = projectPlan(plan(dos, { estrategia: 'cuotas_fijas', abonoExtra: 50 })).meses[0]!
    expect(m1.deudas.cara!.pago).toBe(150)
  })

  it('sin deudas: libre desde el mes 0', () => {
    const r = projectPlan(plan([]))
    expect(r.mesLibre).toBe(0)
    expect(r.meses).toHaveLength(0)
  })

  it('advierte tasas y seguros pendientes, presupuesto insuficiente y horizonte agotado', () => {
    const r = projectPlan(
      plan([card('x', 1000, null, 100, { seguroMensual: null })], { presupuestoDeudas: 50, maxMeses: 3 }),
    )
    const texto = r.advertencias.join(' ')
    expect(r.mesLibre).toBeNull()
    expect(texto).toMatch(/tasa PENDIENTE/)
    expect(texto).toMatch(/seguro PENDIENTE/)
    expect(texto).toMatch(/presupuesto/)
    expect(texto).toMatch(/3 meses/)
  })

  it('el seed de ejemplo se liquida y cuadra deuda inicial + costos = total pagado', () => {
    const r = projectPlan(seedToPlanInput(exampleJson as unknown as SeedData))
    expect(r.mesLibre).not.toBeNull()
    expect(r.advertencias).toHaveLength(0)
    closeTo(r.deudaInicial + r.totalInteresCargos, r.totalPagado, 0.05)
  })
})

describe('préstamo de interés fijo con pago único', () => {
  // Ficticio: Q5,000 al 5 % mensual sobre el monto original (Q250/mes), se paga todo en el mes 3.
  const fijo = loan('fijo', 5250, 0.6, 0, { interesFijoMensual: 250, vencimiento: '2027-01-01' })

  it('suma el cargo fijo cada mes y paga todo al vencimiento, fuera del presupuesto', () => {
    const r = projectPlan(plan([fijo], { presupuestoDeudas: 0 }))
    expect(r.meses.map((m) => m.deudas.fijo!.saldo)).toEqual([5500, 5750, 0])
    expect(r.meses[2]!.deudas.fijo).toMatchObject({ pago: 6000, interes: 250 })
    expect(r.totalInteresCargos).toBe(750)
    expect(r.liquidaciones.fijo).toEqual({ mes: 3, periodo: '2027-01-01' })
    expect(r.supuestos.join(' ')).toMatch(/interés fijo de Q250\.00.*ene 2027/)
  })

  it('avisa si el flujo libre no alcanza el mes del vencimiento y suma los ingresos extra', () => {
    const sinExtra = projectPlan(plan([fijo], { presupuestoDeudas: 0 }))
    expect(sinExtra.meses[2]!.flujoLibre).toBe(3000 - 6000)
    expect(sinExtra.advertencias.join(' ')).toMatch(/En ene 2027 vence fijo \(Q6,000\.00\).*-Q3,000\.00/)

    const conExtra = projectPlan(plan([fijo], { presupuestoDeudas: 0, ingresosExtra: { '2027-01': 3500 } }))
    expect(conExtra.meses[2]!.flujoLibre).toBe(500)
    expect(conExtra.advertencias).toHaveLength(0)
  })

  it('con avalancha recibe el sobrante primero (mayor tasa) y se cancela antes', () => {
    const largo = { ...fijo, vencimiento: '2027-04-01' } // mes 6
    const r = projectPlan(plan([largo, loan('barato', 3000, 0.12, 200)], { presupuestoDeudas: 2000 }))
    expect(r.meses[0]!.deudas.fijo!.pago).toBe(1800)
    // 5500−1800 → 3700; 3950−1800 → 2150; 2400−1800 → 600; 850 → 0: se cancela en el mes 4, no en el 6.
    expect(r.liquidaciones.fijo!.mes).toBe(4)
    expect(r.meses.slice(0, 4).reduce((a, m) => a + m.deudas.fijo!.interes, 0)).toBe(1000)
  })
})

describe('consolidación', () => {
  const base = plan([
    card('x', 3000, 0.6, 300, {
      installments: [
        { descripcion: 'VC', montoCuota: 100, cuotasRestantes: 5, capitalPendiente: null, cargoExtraPorCuota: 0 },
      ],
    }),
    loan('y', 5000, 0.3, 400, { saldoCancelacion: 5200 }),
    loan('z', 4000, 0.1, 200),
  ])

  it('cancela deudas, aplica el sobrante y arma el préstamo nuevo', () => {
    const s = buildConsolidation(base, {
      monto: 10000,
      plazoMeses: 24,
      tasaAnual: 0.24,
      cancelar: ['x', 'y'],
      aplicarSobranteA: 'z',
    })
    expect(s.cancelaciones).toEqual([
      { id: 'x', nombre: 'x', monto: 3500, pendiente: true, parcial: false },
      { id: 'y', nombre: 'y', monto: 5200, pendiente: false, parcial: false },
    ])
    expect(s.costoCancelacion).toBe(200)
    expect(s.sobranteAplicado).toBe(1300)
    expect(s.sobranteLibre).toBe(0)
    expect(s.cuota).toBe(loanPaymentCeil(10000, 0.02, 24))
    expect(s.input.debts.map((d) => [d.id, d.saldo])).toEqual([
      ['consolidacion', 10000],
      ['z', 2700],
    ])
    expect(s.input.presupuestoDeudas).toBeCloseTo(900 - 300 - 400 + s.cuota, 2)
    expect(s.advertencias.join(' ')).toMatch(/x: saldo de cancelación PENDIENTE/)
    expect(projectPlan(s.input).mesLibre).toBeLessThanOrEqual(24)
  })

  it('la cuota calculada con la tasa se redondea hacia arriba y liquida justo en el plazo', () => {
    expect(loanPayment(10000, 0.02, 24)).toBe(528.71)
    expect(loanPaymentCeil(10000, 0.02, 24)).toBe(528.72)
    expect(loanPaymentCeil(1200, 0, 12)).toBe(100)
    expect(loanPaymentCeil(1000, 0, 3)).toBe(333.34)
    expect(() => loanPaymentCeil(1000, 0.01, 0)).toThrow()
    const s = buildConsolidation(base, { monto: 10300, plazoMeses: 24, tasaAnual: 0.24, cancelar: [] })
    const solo = projectPlan({
      ...s.input,
      estrategia: 'cuotas_fijas',
      debts: s.input.debts.filter((d) => d.id === 'consolidacion'),
    })
    expect(solo.mesLibre).toBe(24)
  })

  it('con cuota ofrecida calcula la tasa implícita', () => {
    const s = buildConsolidation(base, { monto: 60000, plazoMeses: 36, cuota: 2454.35, cancelar: [] })
    expect(s.tasaAnual).toBeCloseTo(0.2715, 3)
    expect(s.sobranteLibre).toBe(60000)
  })

  it('si el préstamo no alcanza, cancela en parte', () => {
    const s = buildConsolidation(base, { monto: 2000, plazoMeses: 12, tasaAnual: 0.24, cancelar: ['x'] })
    expect(s.cancelaciones[0]).toMatchObject({ monto: 2000, parcial: true })
    expect(s.input.debts.find((d) => d.id === 'x')?.saldo).toBe(1000)
    expect(s.advertencias.join(' ')).toMatch(/no alcanza/)
  })

  it('el sobrante que excede la deuda destino queda libre', () => {
    const s = buildConsolidation(base, {
      monto: 20000,
      plazoMeses: 12,
      tasaAnual: 0.24,
      cancelar: ['x'],
      aplicarSobranteA: 'z',
    })
    expect(s.sobranteAplicado).toBe(4000)
    expect(s.sobranteLibre).toBe(12500)
  })

  it('valida sus parámetros', () => {
    expect(() => buildConsolidation(base, { monto: 0, plazoMeses: 12, cuota: 1, cancelar: [] })).toThrow()
    expect(() => buildConsolidation(base, { monto: 100, plazoMeses: 12, cancelar: [] })).toThrow()
  })

  it('compareScenarios resume la diferencia entre dos planes', () => {
    const a = projectPlan(base)
    const b = projectPlan(
      buildConsolidation(base, { monto: 10000, plazoMeses: 24, tasaAnual: 0.24, cancelar: ['x', 'y'] }).input,
    )
    const cmp = compareScenarios(a, b, 3000)
    expect(cmp.horizonte).toBe(Math.max(a.meses.length, b.meses.length))
    expect(cmp.mesLibre.diferencia).toBe(b.mesLibre! - a.mesLibre!)
    closeTo(cmp.totalPagado.diferencia, b.totalPagado - a.totalPagado)
    expect(compareScenarios(a, { ...b, mesLibre: null }).mesLibre.diferencia).toBeNull()
  })
})
