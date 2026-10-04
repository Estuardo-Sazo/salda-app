import { describe, expect, it } from 'vitest'
import { flatBalanceAt, flatInterestPortion, flatMonthlyCharge, flatPayoffIn, type FlatLoanTerms } from './flat-loan'

// Ficticio: Q5,000 al 5 % mensual (60 % anual) = Q250 por mes, 4 meses, base con 1 mes ya devengado.
const terms: FlatLoanTerms = {
  montoOriginal: 5000,
  tasaAnual: 0.6,
  fechaBase: '2026-03-01',
  saldoBase: 5250,
  fechaVencimiento: '2026-05-20',
}

describe('préstamo de interés fijo', () => {
  it('cargo mensual sobre el monto original', () => {
    expect(flatMonthlyCharge(terms)).toBe(250)
  })

  it('el saldo crece un cargo por mes completo y se detiene en el vencimiento', () => {
    expect(flatBalanceAt(terms, [], '2026-03-01')).toBe(5250)
    expect(flatBalanceAt(terms, [], '2026-04-01')).toBe(5500)
    expect(flatBalanceAt(terms, [], '2026-05-01')).toBe(5750)
    expect(flatBalanceAt(terms, [], '2026-06-01')).toBe(6000)
    expect(flatBalanceAt(terms, [], '2026-09-01')).toBe(6000)
  })

  it('cancelar antes cuesta menos: solo se pagan los meses usados', () => {
    expect(flatPayoffIn(terms, [], '2026-05-01')).toBe(6000)
    expect(flatPayoffIn(terms, [], '2026-04-01')).toBe(5750)
    expect(flatPayoffIn(terms, [], '2026-03-01')).toBe(5500)
  })

  it('un pago reinicia la referencia; un saldo en cero ya no genera interés', () => {
    const abono = { periodo: '2026-03-01', fecha: '2026-03-15', saldo_despues: 3000, capital: 2000 }
    expect(flatBalanceAt(terms, [abono], '2026-04-01')).toBe(3000)
    expect(flatBalanceAt(terms, [abono], '2026-05-01')).toBe(3250)
    const cancelado = { periodo: '2026-04-01', fecha: '2026-04-10', saldo_despues: 0 }
    expect(flatBalanceAt(terms, [abono, cancelado], '2026-07-01')).toBe(0)
  })

  it('el interés del pago es lo acumulado sobre el capital pendiente', () => {
    expect(flatInterestPortion(terms, [], 6000, 6000)).toBe(1000)
    expect(flatInterestPortion(terms, [], 6000, 400)).toBe(400)
    const previo = { periodo: '2026-03-01', fecha: '2026-03-15', saldo_despues: 3000, capital: 2000 }
    expect(flatInterestPortion(terms, [previo], 3250, 3250)).toBe(250)
  })
})
