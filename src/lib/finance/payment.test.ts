import { describe, expect, it } from 'vitest'
import { analyzePayment, expectedBalanceAfter, previousBalance } from './payment'

const pay = (id: string, fecha: string, saldo: number, created = '2026-01-01T00:00:00Z') => ({
  id,
  fecha,
  created_at: created,
  saldo_despues: saldo,
})

describe('previousBalance', () => {
  const payments = [
    pay('a', '2026-08-30', 9000),
    pay('b', '2026-09-30', 8500, '2026-09-30T10:00:00Z'),
    pay('c', '2026-09-30', 8400, '2026-09-30T12:00:00Z'),
  ]

  it('usa el saldo base si no hay pagos previos', () => {
    expect(previousBalance([], 10000, '2026-10-05')).toBe(10000)
    expect(previousBalance(payments, 10000, '2026-08-01')).toBe(10000)
  })

  it('toma el pago más reciente por fecha y luego por creación', () => {
    expect(previousBalance(payments, 10000, '2026-10-05')).toBe(8400)
    expect(previousBalance(payments, 10000, '2026-09-15')).toBe(9000)
  })

  it('al editar ignora el propio pago', () => {
    expect(previousBalance(payments, 10000, '2026-09-30', 'c')).toBe(8500)
  })
})

describe('analyzePayment', () => {
  it('con interés informado: capital = pago − interés − cargos', () => {
    const r = analyzePayment({ saldoAnterior: 15000, pagoTotal: 1000, saldoDespues: 14200, interes: 200, cargos: 0 })
    expect(r).toMatchObject({ capital: 800, bajo: 800, interes: 200, esEstimado: false, advertencia: null })
  })

  it('sin interés: lo estima con el cambio de saldo y lo marca como estimado', () => {
    const r = analyzePayment({ saldoAnterior: 1000, pagoTotal: 300, saldoDespues: 750, interes: null, cargos: null })
    expect(r).toEqual({ bajo: 250, capital: 250, interes: 50, cargos: null, esEstimado: true, advertencia: null })
  })

  it('no estima si el saldo bajó más que el pago', () => {
    const r = analyzePayment({ saldoAnterior: 1000, pagoTotal: 100, saldoDespues: 800, interes: null, cargos: null })
    expect(r.interes).toBeNull()
    expect(r.capital).toBe(100)
    expect(r.advertencia).toMatch(/bajó más que el pago/)
  })

  it('no estima si el saldo subió (compras con tarjeta)', () => {
    const r = analyzePayment({ saldoAnterior: 1000, pagoTotal: 100, saldoDespues: 1200, interes: null, cargos: null })
    expect(r.bajo).toBe(-200)
    expect(r.capital).toBe(0)
    expect(r.advertencia).toMatch(/subió/)
  })

  it('avisa si interés + cargos superan el pago', () => {
    const r = analyzePayment({ saldoAnterior: 1000, pagoTotal: 100, saldoDespues: 950, interes: 90, cargos: 20 })
    expect(r.capital).toBe(-10)
    expect(r.advertencia).toMatch(/superan/)
  })
})

describe('expectedBalanceAfter', () => {
  it('saldo × (1 + tasa/12) − pago, nunca negativo', () => {
    expect(expectedBalanceAfter(1000, 0.12, 100)).toBe(910)
    expect(expectedBalanceAfter(50, 0.12, 100)).toBe(0)
    expect(expectedBalanceAfter(1000, null, 100)).toBeNull()
  })
})
