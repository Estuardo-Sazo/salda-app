import { describe, expect, it } from 'vitest'
import { buildWizardPayload, monthlyRoom, sumCuotas, type WizardState } from './wizard-model'

// Datos sintéticos (no son los del seed real).
const state: WizardState = {
  nombre: ' Ana ',
  ingreso: 6000,
  gastosFijos: [
    { concepto: 'Comida', monto: 2000 },
    { concepto: 'Luz', monto: 250.5 },
  ],
  deudas: [
    {
      key: 'w1',
      nombre: 'Visa',
      entidad: 'Banco',
      tipo: 'tarjeta',
      saldo: 5000,
      tasa_anual: 0.6,
      cuota_mensual: 600,
      seguro_mensual: null,
      dia_pago: 17,
      dia_corte: 24,
      limite_credito: 8000,
      cuotas_totales: 12,
      cuota_actual: 3,
    },
    {
      key: 'w2',
      nombre: 'Moto',
      entidad: null,
      tipo: 'prestamo',
      saldo: 9000,
      tasa_anual: null,
      cuota_mensual: 700,
      seguro_mensual: 99,
      dia_pago: 5,
      dia_corte: 1,
      limite_credito: 1,
      cuotas_totales: 24,
      cuota_actual: 10,
    },
  ],
  cuotas: [
    { debt: 'w1', descripcion: 'Celular', monto_cuota: 200, cuotas_totales: 10, cuotas_cobradas: 4 },
    { debt: 'borrada', descripcion: 'X', monto_cuota: 1, cuotas_totales: 1, cuotas_cobradas: 0 },
  ],
}

describe('asistente desde cero', () => {
  const p = buildWizardPayload(state, { estrategia: 'avalancha', presupuestoDeudas: 1500 }, '2026-10-04', '2026-10-01')

  it('arma perfil, gastos fijos y deudas con fecha base de hoy', () => {
    expect(p.profile).toEqual({ nombre: 'Ana', ingreso_mensual: 6000, moneda: 'GTQ' })
    expect(p.budget_items.map((b) => [b.concepto, b.monto, b.orden])).toEqual([
      ['Comida', 2000, 0],
      ['Luz', 250.5, 1],
    ])
    expect(p.debts.map((d) => [d.key, d.saldo_base, d.fecha_base, d.prioridad])).toEqual([
      ['w1', 5000, '2026-10-04', 1],
      ['w2', 9000, '2026-10-04', 2],
    ])
  })

  it('limpia los campos que no aplican a cada tipo y deja null lo pendiente', () => {
    expect(p.debts[0]).toMatchObject({
      seguro_mensual: null,
      limite_credito: 8000,
      cuotas_totales: null,
      cuota_actual: null,
    })
    expect(p.debts[1]).toMatchObject({ tasa_anual: null, seguro_mensual: null, dia_corte: null, cuotas_totales: 24 })
  })

  it('ignora cuotas de deudas quitadas y registra el saldo del mes con sus cuotas fuera', () => {
    expect(p.debt_installments).toHaveLength(1)
    expect(p.snapshots).toEqual([
      { debt: 'w1', periodo: '2026-10-01', saldo: 5000, cuotas_fuera_saldo: 1200, origen: 'historial' },
      { debt: 'w2', periodo: '2026-10-01', saldo: 9000, cuotas_fuera_saldo: 0, origen: 'historial' },
    ])
  })

  it('crea el plan inicial activo desde el mes siguiente', () => {
    expect(p.plans).toHaveLength(1)
    expect(p.plans[0]).toMatchObject({ activo: true, fecha_inicio: '2026-11-01', presupuesto_deudas: 1500 })
    expect(p.plans[0]!.supuestos?.resumen.deuda_inicial).toBe(15200)
    expect(p.plans[0]!.supuestos?.advertencias.join(' ')).toMatch(/Moto: tasa PENDIENTE/)
  })

  it('sin presupuesto no crea plan', () => {
    expect(
      buildWizardPayload(state, { estrategia: 'avalancha', presupuestoDeudas: 0 }, '2026-10-04', '2026-10-01').plans,
    ).toEqual([])
  })

  it('calcula lo que queda libre y la suma de cuotas', () => {
    expect(monthlyRoom(state)).toBe(3749.5)
    expect(monthlyRoom({ ingreso: null, gastosFijos: [] })).toBeNull()
    expect(sumCuotas(state.deudas)).toBe(1300)
  })
})
