import { describe, expect, it } from 'vitest'
import { moneyField, optionalIntField, optionalMoneyField, optionalPercentField, parseAmount, toInput } from './forms'

describe('parseAmount', () => {
  it('acepta formatos comunes de quetzales', () => {
    expect(parseAmount('1234.5')).toBe(1234.5)
    expect(parseAmount('Q1,234.56')).toBe(1234.56)
    expect(parseAmount(' q 1 234.56 ')).toBe(1234.56)
    expect(parseAmount('1234,5')).toBe(1234.5)
    expect(parseAmount('12,345')).toBe(12345)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNaN()
  })

  it('acepta símbolos de otras monedas y la coma decimal', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56)
    expect(parseAmount('S/ 10')).toBe(10)
    expect(parseAmount('10 €', ',')).toBe(10)
    expect(parseAmount('$ 1.234,56', ',')).toBe(1234.56)
    expect(parseAmount('1.234.567', ',')).toBe(1234567)
    expect(parseAmount('1.234', ',')).toBe(1234)
    // En monedas con punto decimal, "1.234" sigue siendo uno coma dos.
    expect(parseAmount('1.234', '.')).toBe(1.23)
    expect(parseAmount('12,5', ',')).toBe(12.5)
    expect(parseAmount('Q')).toBeNaN()
  })

  it('toInput convierte de vuelta para editar', () => {
    expect(toInput(null)).toBe('')
    expect(toInput(0.6, 100)).toBe('60')
    expect(toInput(0.594, 100)).toBe('59.4')
  })
})

describe('campos zod', () => {
  it('moneyField exige un número ≥ 0', () => {
    expect(moneyField().parse('1,128.48')).toBe(1128.48)
    expect(moneyField().safeParse('').success).toBe(false)
    expect(moneyField().safeParse('-5').success).toBe(false)
    expect(moneyField().safeParse('x').error?.issues[0]?.message).toBe('Ingresá un número válido')
  })

  it('optionalMoneyField: vacío = null (PENDIENTE)', () => {
    expect(optionalMoneyField().parse('')).toBeNull()
    expect(optionalMoneyField().parse('45')).toBe(45)
  })

  it('optionalPercentField guarda fracciones', () => {
    expect(optionalPercentField().parse('60')).toBe(0.6)
    expect(optionalPercentField().parse('59.4')).toBe(0.594)
    expect(optionalPercentField().parse('')).toBeNull()
    expect(optionalPercentField().safeParse('2000').success).toBe(false)
  })

  it('optionalIntField valida rango', () => {
    expect(optionalIntField(1, 31).parse('17')).toBe(17)
    expect(optionalIntField(1, 31).parse('')).toBeNull()
    expect(optionalIntField(1, 31).safeParse('32').success).toBe(false)
    expect(optionalIntField(1, 31).safeParse('1.5').success).toBe(false)
  })
})
