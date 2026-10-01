/** Utilidades de período (primer día del mes, `YYYY-MM-01`) sin depender de la zona horaria. */

const PERIOD_RE = /^(\d{4})-(\d{2})(?:-\d{2})?$/

export function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD_RE.exec(period)
  if (!match) throw new Error(`Período inválido: ${period}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

export function toPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Normaliza 'YYYY-MM' o 'YYYY-MM-DD' al primer día del mes. */
export function normalizePeriod(value: string): string {
  const { year, month } = parsePeriod(value)
  return toPeriod(year, month)
}

export function addMonths(period: string, months: number): string {
  const { year, month } = parsePeriod(period)
  const index = year * 12 + (month - 1) + months
  return toPeriod(Math.floor(index / 12), (index % 12) + 1)
}

export function monthsBetween(from: string, to: string): number {
  const a = parsePeriod(from)
  const b = parsePeriod(to)
  return (b.year - a.year) * 12 + (b.month - a.month)
}
