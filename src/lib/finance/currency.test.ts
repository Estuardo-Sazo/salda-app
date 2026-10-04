import { describe, expect, it } from 'vitest'
import {
  currencySymbol,
  decimalSeparator,
  formatCurrency,
  formatCurrencyCompact,
  guessCurrency,
  isValidCurrency,
} from './currency'

describe('monedas', () => {
  it('GTQ se ve igual que siempre', () => {
    expect(formatCurrency(12345.67)).toBe('Q12,345.67')
    expect(formatCurrency(-1234.5, 'GTQ')).toBe('-Q1,234.50')
    expect(formatCurrency(null)).toBe('Q0.00')
    expect(formatCurrencyCompact(61600)).toMatch(/^Q61[.,]6/)
  })

  it('cada moneda usa las convenciones de su país', () => {
    expect(formatCurrency(1234.567, 'USD')).toBe('$1,234.57')
    expect(formatCurrency(1234.567, 'MXN')).toBe('$1,234.57')
    // Peso colombiano y chileno sin centavos, con punto de miles.
    expect(formatCurrency(1234.567, 'COP')).toMatch(/^\$\s?1\.235$/)
    expect(formatCurrency(1234.567, 'CLP')).toMatch(/^\$\s?1\.235$/)
    expect(formatCurrency(12345.67, 'EUR')).toMatch(/^12\.345,67\s€$/)
    // Un código válido fuera de la lista también funciona.
    expect(formatCurrency(10, 'CAD')).toMatch(/10\.00|10,00/)
  })

  it('símbolo y separador decimal', () => {
    expect(currencySymbol('GTQ')).toBe('Q')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('PEN')).toBe('S/')
    expect(currencySymbol('EUR')).toBe('€')
    expect(decimalSeparator('GTQ')).toBe('.')
    expect(decimalSeparator('ARS')).toBe(',')
    expect(decimalSeparator('EUR')).toBe(',')
  })

  it('valida códigos ISO y adivina la moneda por el idioma', () => {
    expect(isValidCurrency('USD')).toBe(true)
    expect(isValidCurrency('usd')).toBe(false)
    expect(isValidCurrency('ZZ1')).toBe(false)
    expect(guessCurrency('es-MX')).toBe('MXN')
    expect(guessCurrency('es-SV')).toBe('USD')
    expect(guessCurrency('es')).toBe('GTQ')
    expect(guessCurrency(undefined)).toBe('GTQ')
  })
})
