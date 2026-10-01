import { parsePeriod, toPeriod } from '@/lib/finance/period'

export const TIME_ZONE = 'America/Guatemala'

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const currencyCompact = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const percent = new Intl.NumberFormat('es-GT', { style: 'percent', maximumFractionDigits: 2 })

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** es-GT separa el símbolo con un espacio ("Q 1,234.56"); el plan usa "Q1,234.56". */
const tightSymbol = (text: string) => text.replace(/Q\s/u, 'Q')

/** Q1,234.56 */
export function formatGTQ(value: number | null | undefined): string {
  return tightSymbol(currency.format(value ?? 0))
}

/** Q61.6 mil — para ejes de gráficas. */
export function formatGTQCompact(value: number): string {
  return tightSymbol(currencyCompact.format(value))
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : percent.format(value)
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' sin pasar por Date (evita corrimientos de zona horaria). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** '2026-10-01' → 'oct 2026' */
export function formatPeriod(period: string): string {
  const { year, month } = parsePeriod(period)
  return `${MESES[month - 1]} ${year}`
}

/** '2026-10-01' → 'oct' (para ejes). */
export function formatPeriodShort(period: string): string {
  const { year, month } = parsePeriod(period)
  return month === 1 ? `${MESES[0]} ${String(year).slice(2)}` : (MESES[month - 1] ?? '')
}

export function formatPeriodLong(period: string): string {
  const { year, month } = parsePeriod(period)
  return `${MESES_LARGOS[month - 1]} ${year}`
}

/** Fecha de hoy en Guatemala como 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
}

/** Período (primer día del mes) de una fecha 'YYYY-MM-DD'. */
export function periodOf(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  return toPeriod(Number(y), Number(m))
}

export function currentPeriod(now: Date = new Date()): string {
  return periodOf(todayISO(now))
}
