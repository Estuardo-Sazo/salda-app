import { describe, expect, it } from 'vitest'
import { addMonthsToDate, monthlyInterest, monthsStarted, nextDay, owedAt, receivableStatus } from './receivable'

// Ejemplo sintético: Q1,000 al 10 % mensual (Q100 por mes).
const prestamo = { monto: 1000, tasaMensual: 0.1, fechaPrestamo: '2026-10-01' }

describe('meses iniciados', () => {
  it('del 1 al 30 es un mes; el aniversario todavía cuenta como ese mes', () => {
    expect(monthsStarted('2026-10-01', '2026-10-01')).toBe(1)
    expect(monthsStarted('2026-10-01', '2026-10-30')).toBe(1)
    expect(monthsStarted('2026-10-01', '2026-11-01')).toBe(1)
    expect(monthsStarted('2026-10-01', '2026-11-02')).toBe(2)
    expect(monthsStarted('2026-10-01', '2026-12-01')).toBe(2)
    expect(monthsStarted('2026-10-01', '2026-12-02')).toBe(3)
    expect(monthsStarted('2026-10-01', '2026-09-30')).toBe(0)
  })

  it('ajusta fines de mes y cambios de año', () => {
    expect(monthsStarted('2026-01-31', '2026-02-28')).toBe(1)
    expect(monthsStarted('2026-01-31', '2026-03-01')).toBe(2)
    expect(monthsStarted('2026-12-15', '2027-01-15')).toBe(1)
    expect(monthsStarted('2026-12-15', '2027-01-16')).toBe(2)
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDate('2026-11-30', 3)).toBe('2027-02-28')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
  })
})

describe('lo que te deben', () => {
  it('Q1,000 al 10 %: un mes Q1,100, dos meses Q1,200', () => {
    expect(monthlyInterest(prestamo)).toBe(100)
    expect(owedAt(prestamo, '2026-10-30')).toBe(1100)
    expect(owedAt(prestamo, '2026-11-15')).toBe(1200)
    expect(owedAt({ ...prestamo, tasaMensual: null }, '2027-05-01')).toBe(1000)
  })

  it('sin cobros: pendiente a hoy y fecha del próximo aumento', () => {
    expect(receivableStatus(prestamo, [], '2026-10-04')).toEqual({
      meses: 1,
      interesMensual: 100,
      interesGenerado: 100,
      total: 1100,
      cobrado: 0,
      pendiente: 1100,
      liquidado: false,
      fechaLiquidacion: null,
      gananciaCobrada: 0,
      proximoAumento: '2026-11-02',
    })
    expect(receivableStatus(prestamo, [], '2026-11-20')).toMatchObject({
      meses: 2,
      pendiente: 1200,
      proximoAumento: '2026-12-02',
    })
  })

  it('un cobro completo dentro del mes lo liquida y deja de generar interés', () => {
    const s = receivableStatus(prestamo, [{ fecha: '2026-10-30', monto: 1100 }], '2027-03-01')
    expect(s).toMatchObject({
      meses: 1,
      total: 1100,
      pendiente: 0,
      liquidado: true,
      fechaLiquidacion: '2026-10-30',
      gananciaCobrada: 100,
      proximoAumento: null,
    })
  })

  it('abonos: primero cubren interés; se liquida cuando lo cobrado alcanza lo adeudado', () => {
    const cobros = [
      { fecha: '2026-10-31', monto: 100 },
      { fecha: '2026-12-01', monto: 1100 },
    ]
    // Al 01/12 van 2 meses: debe 1200 y le cobraste 1200 en total.
    const s = receivableStatus(prestamo, cobros, '2027-01-10')
    expect(s).toMatchObject({
      liquidado: true,
      fechaLiquidacion: '2026-12-01',
      meses: 2,
      gananciaCobrada: 200,
      pendiente: 0,
    })
    // Si el segundo cobro llega el 02/12 ya son 3 meses: le falta Q100.
    const tarde = receivableStatus(prestamo, [cobros[0]!, { fecha: '2026-12-02', monto: 1100 }], '2026-12-05')
    expect(tarde).toMatchObject({
      liquidado: false,
      meses: 3,
      total: 1300,
      cobrado: 1200,
      pendiente: 100,
      gananciaCobrada: 300,
    })
  })

  it('abono en la quincena: al mes te deben Q600; si no pagan, el 10 % sigue corriendo sobre los Q1,000', () => {
    const abono = [{ fecha: '2026-10-15', monto: 500 }]
    expect(receivableStatus(prestamo, abono, '2026-10-30')).toMatchObject({ meses: 1, total: 1100, pendiente: 600 })
    expect(receivableStatus(prestamo, abono, '2026-11-10')).toMatchObject({ meses: 2, total: 1200, pendiente: 700 })
    const pagado = receivableStatus(prestamo, [...abono, { fecha: '2026-10-31', monto: 600 }], '2027-01-01')
    expect(pagado).toMatchObject({
      liquidado: true,
      fechaLiquidacion: '2026-10-31',
      pendiente: 0,
      gananciaCobrada: 100,
    })
  })

  it('sin interés: solo se cobra lo prestado', () => {
    const s = receivableStatus({ ...prestamo, tasaMensual: null }, [{ fecha: '2027-01-01', monto: 400 }], '2027-02-01')
    expect(s).toMatchObject({ meses: 0, total: 1000, pendiente: 600, liquidado: false, proximoAumento: null })
  })

  it('un préstamo con fecha futura todavía no genera meses extra', () => {
    expect(receivableStatus(prestamo, [], '2026-09-15')).toMatchObject({ meses: 1, pendiente: 1100 })
  })
})
