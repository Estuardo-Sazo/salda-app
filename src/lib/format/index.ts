import { useSyncExternalStore } from 'react'
import { DEFAULT_CURRENCY, formatCurrency, formatCurrencyCompact, isValidCurrency } from '@/lib/finance/currency'
import { parsePeriod, toPeriod } from '@/lib/finance/period'

export const TIME_ZONE = 'America/Guatemala'

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

/* ------------------------------------------------------------------ moneda del usuario */

const CURRENCY_KEY = 'salda-moneda'
const currencyListeners = new Set<() => void>()

function readStoredCurrency(): string {
  try {
    const c = localStorage.getItem(CURRENCY_KEY)
    return c && isValidCurrency(c) ? c : DEFAULT_CURRENCY
  } catch {
    return DEFAULT_CURRENCY
  }
}

/** Se recuerda en el dispositivo para que la app abra con la moneda correcta antes de leer el perfil. */
let currentCurrency = typeof window === 'undefined' ? DEFAULT_CURRENCY : readStoredCurrency()

export const getCurrency = () => currentCurrency

/** Cambia la moneda con la que se formatean todos los montos (la del perfil del usuario). */
export function setCurrency(code: string | null | undefined) {
  const next = code && isValidCurrency(code) ? code : DEFAULT_CURRENCY
  if (next === currentCurrency) return
  currentCurrency = next
  try {
    localStorage.setItem(CURRENCY_KEY, next)
  } catch {
    // Sin almacenamiento: dura solo esta sesión.
  }
  currencyListeners.forEach((l) => l())
}

/** Moneda actual como estado de React (para volver a pintar al cambiarla). */
export function useCurrency(): string {
  return useSyncExternalStore(
    (l) => {
      currencyListeners.add(l)
      return () => currencyListeners.delete(l)
    },
    getCurrency,
    () => DEFAULT_CURRENCY,
  )
}

/** Monto en la moneda del usuario: "Q1,234.56", "$1,234.56"… */
export function formatMoney(value: number | null | undefined): string {
  return formatCurrency(value, currentCurrency)
}

/** "Q61.6 mil" — para ejes de gráficas. */
export function formatMoneyCompact(value: number): string {
  return formatCurrencyCompact(value, currentCurrency)
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

export const TIPO_LABEL = { tarjeta: 'Tarjeta', prestamo: 'Préstamo' } as const
