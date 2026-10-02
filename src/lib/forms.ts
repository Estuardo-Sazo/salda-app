import { z } from 'zod'

/** "Q1,234.50" / "1234,5" / " 1234.5 " → 1234.5; '' → null; texto inválido → NaN. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/^Q\s*/i, '').replace(/\s/g, '')
  if (s === '') return null
  // Coma como separador decimal solo si no hay punto ("1234,5"); si no, la coma es de miles.
  const normalized = /^\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
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
    .transform(parseAmount)
    .pipe(z.number(numberMsg).nonnegative('No puede ser negativo'))

/** Monto opcional: vacío → null (en la UI se muestra PENDIENTE cuando aplica). */
export const optionalMoneyField = () =>
  z.string().trim().transform(parseAmount).pipe(z.number(numberMsg).nonnegative('No puede ser negativo').nullable())

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
