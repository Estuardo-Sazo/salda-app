import { describe, expect, it } from 'vitest'
import { bulletAlerts, type BulletDebt } from './bullet'

// Ficticio: Q5,000 al 5 % mensual fijo (Q250/mes), debe Q5,250 al inicio de marzo, vence en mayo.
const fijo: BulletDebt = {
  debt_id: 'f',
  nombre: 'Préstamo familiar',
  estado: 'activa',
  pago_unico: true,
  fecha_vencimiento: '2026-05-20',
  interes_modo: 'monto_original',
  monto_original: 5000,
  tasa_anual: 0.6,
  deuda_real: 5250,
  saldo_para_cancelar: 5500,
}

describe('bulletAlerts', () => {
  it('calcula el monto al vencimiento, la cobertura y cuánto apartar por mes', () => {
    const [a] = bulletAlerts([fijo], [{ periodo: '2026-05-01', monto: 3000 }], '2026-03-01')
    expect(a).toEqual({
      debtId: 'f',
      nombre: 'Préstamo familiar',
      periodo: '2026-05-01',
      mesesFaltan: 2,
      monto: 6000,
      ingresosExtra: 3000,
      faltante: 3000,
      apartarPorMes: 1000,
      cancelarHoy: { monto: 5500, ahorro: 500 },
    })
  })

  it('el mes del vencimiento no ofrece "cancelar hoy" y con extras suficientes no falta nada', () => {
    const [a] = bulletAlerts([{ ...fijo, deuda_real: 5750 }], [{ periodo: '2026-05-01', monto: 7000 }], '2026-05-01')
    expect(a).toMatchObject({ mesesFaltan: 0, monto: 6000, faltante: 0, apartarPorMes: 0, cancelarHoy: null })
  })

  it('ignora deudas sin pago único, liquidadas o fuera del horizonte', () => {
    expect(bulletAlerts([{ ...fijo, pago_unico: false }], [], '2026-03-01')).toHaveLength(0)
    expect(bulletAlerts([{ ...fijo, estado: 'liquidada' }], [], '2026-03-01')).toHaveLength(0)
    expect(bulletAlerts([fijo], [], '2026-01-01')).toHaveLength(0)
    expect(bulletAlerts([fijo], [], '2026-06-01')).toHaveLength(0)
  })

  it('un pago único sin interés fijo usa la deuda actual', () => {
    const [a] = bulletAlerts(
      [{ ...fijo, interes_modo: 'saldo', monto_original: null, saldo_para_cancelar: null, deuda_real: 4000 }],
      [],
      '2026-04-01',
    )
    expect(a).toMatchObject({ monto: 4000, faltante: 4000, apartarPorMes: 2000, cancelarHoy: null })
  })
})
