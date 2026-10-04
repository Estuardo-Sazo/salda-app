import { describe, expect, it } from 'vitest'
import { monthlyInterestOn, summarizeExpenses, type ExpenseLike } from './expenses'

const e = (
  monto: number,
  categoria: string,
  metodo: ExpenseLike['metodo'],
  debt_id: string | null = null,
): ExpenseLike => ({
  monto,
  categoria,
  metodo,
  debt_id,
})

describe('summarizeExpenses', () => {
  const gastos = [
    e(312.45, 'Comida', 'tarjeta', 'oro'),
    e(89, 'Suscripción', 'tarjeta', 'clasica'),
    e(25, 'Recargas', 'tarjeta', 'sin-tasa'),
    e(45, 'Comida', 'efectivo'),
    e(28.55, 'Otro', 'debito'),
  ]
  const s = summarizeExpenses(gastos, { oro: 0.54, clasica: 0.48, 'sin-tasa': null })

  it('suma total, compras con tarjeta y por método', () => {
    expect(s.total).toBe(500)
    expect(s.tarjeta).toBe(426.45)
    expect(s.porMetodo).toEqual({ efectivo: 45, debito: 28.55, tarjeta: 426.45, transferencia: 0 })
  })

  it('ordena categorías por monto con su porcentaje', () => {
    expect(s.porCategoria[0]).toEqual({ categoria: 'Comida', total: 357.45, pct: 0.7149 })
    expect(s.porCategoria.map((c) => c.categoria)).toEqual(['Comida', 'Suscripción', 'Otro', 'Recargas'])
  })

  it('pondera la tasa por monto e ignora tarjetas con tasa PENDIENTE', () => {
    // (312.45 × 0.54 + 89 × 0.48) / 401.45
    expect(s.tasaTarjeta).toBeCloseTo(0.5267, 4)
    expect(s.interesMensualTarjeta).toBeCloseTo((312.45 * 0.54 + 89 * 0.48) / 12, 2)
  })

  it('sin gastos o sin tasas conocidas', () => {
    expect(summarizeExpenses([])).toMatchObject({ total: 0, tarjeta: 0, porCategoria: [], tasaTarjeta: null })
    expect(summarizeExpenses([e(10, 'Otro', 'tarjeta', 'x')]).tasaTarjeta).toBeNull()
  })
})

describe('monthlyInterestOn', () => {
  it('monto × tasa / 12', () => {
    expect(monthlyInterestOn(600, 0.6)).toBe(30)
    expect(monthlyInterestOn(600, null)).toBeNull()
  })
})
