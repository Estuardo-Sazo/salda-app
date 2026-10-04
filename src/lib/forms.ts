import { z } from 'zod'
import { decimalSeparator } from '@/lib/finance/currency'
import { getCurrency } from '@/lib/format'

/**
 * Monto escrito por el usuario → número con 2 decimales; '' → null; texto inválido → NaN.
 * Acepta el símbolo de cualquier moneda ("Q1,234.50", "$ 1.234,56", "S/ 10", "10 €").
 * Si aparecen coma y punto, el último es el decimal. Con un solo tipo de separador:
 * - coma seguida de 1–2 dígitos al final es decimal ("1234,5"); si no, es de miles ("12,345");
 * - punto es decimal, salvo en monedas con coma decimal donde "1.234" o "1.234.567" son miles.
 */
export function parseAmount(raw: string, decimal: '.' | ',' = decimalSeparator(getCurrency())): number | null {
  const trimmed = raw.trim()
  const s = trimmed
    .replace(/^[^\d.,-]+/, '')
    .replace(/[^\d.,]+$/, '')
    .replace(/\s/g, '')
  if (trimmed === '') return null
  if (s === '') return Number.NaN

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized = s
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = /^-?\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot >= 0 && decimal === ',' && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, '')
  }
  if (!/^-?\d*\.?\d+$/.test(normalized)) return Number.NaN
  return Math.round(Number(normalized) * 100) / 100
}

/** number → valor de input ('' si es null). */
export function toInput(value: number | null | undefined, scale = 1): string {
  if (value == null) return ''
  return String(Math.round(value * scale * 10000) / 10000)
}

const numberMsg = { invalid_type_error: 'Ingresá un número válido', required_error: 'Requerido' }

/** Monto obligatorio ≥ 0. */
export const moneyField = (requiredMsg = 'Requerido') =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .transform((s) => parseAmount(s))
    .pipe(z.number(numberMsg).nonnegative('No puede ser negativo'))

/** Monto opcional: vacío → null (en la UI se muestra PENDIENTE cuando aplica). */
export const optionalMoneyField = () =>
  z
    .string()
    .trim()
    .transform((s) => parseAmount(s))
    .pipe(z.number(numberMsg).nonnegative('No puede ser negativo').nullable())

/** Porcentaje en la UI ("60" = 60 %) → fracción en BD (0.6). Vacío → null. */
export const optionalPercentField = () =>
  z
    .string()
    .trim()
    .transform((s) => {
      const n = parseAmount(s)
      return n == null || Number.isNaN(n) ? n : Math.round(n * 100) / 10000
    })
    .pipe(z.number(numberMsg).min(0, 'No puede ser negativa').max(9.99, 'Revisá la tasa').nullable())

/** Entero opcional dentro de un rango. */
export const optionalIntField = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : /^\d+$/.test(s) ? Number(s) : Number.NaN))
    .pipe(z.number(numberMsg).int().min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).nullable())

export const dateField = (msg = 'Fecha requerida') => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg)
export const optionalDateField = () =>
  z
    .string()
    .transform((s) => (s === '' ? null : s))
    .pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
        .nullable(),
    )

export const optionalText = () =>
  z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : s))
