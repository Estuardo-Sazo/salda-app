import { describe, expect, it } from 'vitest'
import { CONSOLIDATION_ID } from '@/lib/finance'
import type { PlanSources } from '@/features/plan/plan-input'
import {
  baseParams,
  budgetBounds,
  cancellationAmount,
  liquidationTable,
  simulateConsolidation,
  simulateStrategy,
  suggestedLoanAmount,
} from './model'

// Datos sintéticos (no son los del seed real).
const debt = (over: Partial<PlanSources['debts'][number]> & { debt_id: string }) => ({
  nombre: over.debt_id,
  tipo: 'prestamo' as const,
  estado: 'activa' as const,
  tasa_anual: 0.2,
  cuota_mensual: 300,
  seguro_mensual: null,
  saldo_cancelacion: null,
  saldo_actual: 3000,
  monto_original: null,
  saldo_para_cancelar: null,
  ...over,
})

const sources: PlanSources = {
  debts: [
    debt({
      debt_id: 'tc',
      nombre: 'Tarjeta',
      tipo: 'tarjeta',
      tasa_anual: 0.6,
      cuota_mensual: 400,
      seguro_mensual: 0,
      saldo_actual: 4000,
    }),
    debt({
      debt_id: 'pr',
      nombre: 'Préstamo',
      tasa_anual: 0.18,
      cuota_mensual: 500,
      saldo_actual: 6000,
      saldo_cancelacion: 6100,
    }),
  ],
  installments: [
    {
      debt_id: 'tc',
      descripcion: 'VC',
      monto_cuota: 100,
      cuotas_totales: 4,
      cuotas_cobradas: 2,
      capital_pendiente: null,
      cargo_extra_por_cuota: 0,
      activa: true,
    },
  ],
  ingresoMensual: 4000,
  gastosFijos: 2000,
  ingresosExtra: [],
}
const ctx = { fechaInicio: '2026-11-01', periodoActual: '2026-10-01' }

describe('simulador de estrategias', () => {
  it('parte del plan activo o de la suma de cuotas', () => {
    expect(baseParams(sources.debts, null)).toEqual({ estrategia: 'avalancha', presupuestoDeudas: 900, abonoExtra: 0 })
    expect(baseParams(sources.debts, { estrategia: 'bola_nieve', presupuesto_deudas: 1000, abono_extra: 50 })).toEqual({
      estrategia: 'bola_nieve',
      presupuestoDeudas: 1000,
      abonoExtra: 50,
    })
  })

  it('el slider de presupuesto va de la suma de cuotas a lo que deja el ingreso', () => {
    expect(budgetBounds(sources, 900)).toEqual({ min: 900, max: 2000 })
    expect(budgetBounds({ ...sources, ingresoMensual: null }, 900)).toEqual({ min: 900, max: 1350 })
  })

  it('un abono extra termina antes y paga menos interés', () => {
    const base = { estrategia: 'avalancha' as const, presupuestoDeudas: 900, abonoExtra: 0 }
    const sim = simulateStrategy(sources, base, { ...base, abonoExtra: 500 }, ctx)
    expect(sim.comparacion.mesLibre.diferencia).toBeLessThan(0)
    expect(sim.comparacion.interesCargos.diferencia).toBeLessThan(0)
    expect(sim.libreSinDeuda).toBe(2000)
    // La curva arranca en el mes 0 con la deuda real inicial (saldos + cuotas fuera de saldo).
    expect(sim.serie[0]).toEqual({ periodo: '2026-10-01', a: 10200, b: 10200 })
    expect(sim.serie.at(-1)!.b).toBe(0)
  })

  it('el mismo escenario no tiene diferencias', () => {
    const p = { estrategia: 'cuotas_fijas' as const, presupuestoDeudas: 900, abonoExtra: 0 }
    const sim = simulateStrategy(sources, p, p, ctx)
    expect(sim.comparacion.totalPagado.diferencia).toBe(0)
    expect(sim.comparacion.mesLibre.diferencia).toBe(0)
  })
})

describe('simulador de consolidación', () => {
  const base = { estrategia: 'avalancha' as const, presupuestoDeudas: 900, abonoExtra: 0 }

  it('usa el saldo de cancelación o la deuda real (PENDIENTE)', () => {
    expect(cancellationAmount({ saldo: 6000, saldoCancelacion: 6100 })).toEqual({ monto: 6100, pendiente: false })
    expect(
      cancellationAmount({
        saldo: 4000,
        saldoCancelacion: null,
        installments: [
          { descripcion: 'x', montoCuota: 100, cuotasRestantes: 2, capitalPendiente: null, cargoExtraPorCuota: 0 },
        ],
      }),
    ).toEqual({ monto: 4200, pendiente: true })
  })

  it('sugiere un monto que cubre las deudas elegidas', () => {
    const sim = simulateStrategy(sources, base, base, ctx)
    expect(suggestedLoanAmount(sim.actual.input, ['tc', 'pr'])).toBe(10300)
    expect(suggestedLoanAmount(sim.actual.input, [])).toBe(0)
  })

  it('cancela las deudas, agrega el préstamo y compara contra el plan actual', () => {
    const sim = simulateConsolidation(
      sources,
      base,
      { monto: 10300, plazoMeses: 24, tasaAnual: 0.24, cancelar: ['tc', 'pr'], abonoExtra: 0, redistribuir: false },
      ctx,
    )
    expect(sim.setup.cancelaciones.map((c) => [c.id, c.monto, c.pendiente])).toEqual([
      ['tc', 4200, true],
      ['pr', 6100, false],
    ])
    expect(sim.setup.sobranteLibre).toBe(0)
    expect(sim.escenario.input.debts.map((d) => d.id)).toEqual([CONSOLIDATION_ID])
    expect(sim.escenario.input.estrategia).toBe('cuotas_fijas')
    expect(sim.escenario.result.mesLibre).toBe(24)

    const liq = liquidationTable(sim)
    expect(liq.map((r) => [r.id, r.b === 'cancelada' ? 'cancelada' : r.b === 'no-aplica' ? '-' : 'ok'])).toEqual([
      [CONSOLIDATION_ID, 'ok'],
      ['tc', 'cancelada'],
      ['pr', 'cancelada'],
    ])
    expect(liq[0]!.a).toBe('no-aplica')
  })

  it('con abono extra y redistribución se liquida antes', () => {
    const params = {
      monto: 10300,
      plazoMeses: 24,
      tasaAnual: 0.24,
      cancelar: ['tc', 'pr'],
      abonoExtra: 0,
      redistribuir: false,
    }
    const solo = simulateConsolidation(sources, base, params, ctx)
    const extra = simulateConsolidation(sources, base, { ...params, abonoExtra: 500, redistribuir: true }, ctx)
    expect(extra.escenario.result.mesLibre!).toBeLessThan(solo.escenario.result.mesLibre!)
    expect(extra.escenario.result.totalInteresCargos).toBeLessThan(solo.escenario.result.totalInteresCargos)
  })
})
