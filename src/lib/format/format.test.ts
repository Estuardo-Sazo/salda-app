import { describe, expect, it } from 'vitest'
import { currentPeriod, formatDate, formatGTQ, formatPeriod, formatPeriodShort, periodOf, todayISO } from './index'

describe('formato GTQ y fechas', () => {
  it('formatea quetzales como en el plan', () => {
    expect(formatGTQ(12345.67)).toBe('Q12,345.67')
    expect(formatGTQ(null)).toBe('Q0.00')
    expect(formatGTQ(-1234.5)).toBe('-Q1,234.50')
  })

  it('fechas dd/mm/yyyy y meses "oct 2026"', () => {
    expect(formatDate('2026-09-30')).toBe('30/09/2026')
    expect(formatDate(null)).toBe('—')
    expect(formatPeriod('2026-10-01')).toBe('oct 2026')
    expect(formatPeriodShort('2027-01-01')).toBe('ene 27')
    expect(periodOf('2026-09-30')).toBe('2026-09-01')
  })

  it('usa la zona America/Guatemala (UTC−6)', () => {
    // 1-nov 03:00 UTC todavía es 31-oct en Guatemala.
    const now = new Date('2026-11-01T03:00:00Z')
    expect(todayISO(now)).toBe('2026-10-31')
    expect(currentPeriod(now)).toBe('2026-10-01')
  })
})
