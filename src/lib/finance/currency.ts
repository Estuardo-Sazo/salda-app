/**
 * Monedas: una por usuario y sin conversiones. Cada moneda se formatea con las convenciones de su
 * país (separadores, posición del símbolo y decimales), por ejemplo GTQ → "Q1,234.56" y
 * COP → "$ 1.235". Los montos se siguen guardando con dos decimales.
 */

export const DEFAULT_CURRENCY = 'GTQ'

export interface CurrencyInfo {
  code: string
  nombre: string
  /** Configuración regional con la que se formatea. */
  locale: string
}

/** Monedas sugeridas en la app; cualquier otro código ISO 4217 válido también funciona. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'GTQ', nombre: 'Quetzal', locale: 'es-GT' },
  { code: 'USD', nombre: 'Dólar estadounidense', locale: 'es-US' },
  { code: 'MXN', nombre: 'Peso mexicano', locale: 'es-MX' },
  { code: 'HNL', nombre: 'Lempira', locale: 'es-HN' },
  { code: 'NIO', nombre: 'Córdoba', locale: 'es-NI' },
  { code: 'CRC', nombre: 'Colón costarricense', locale: 'es-CR' },
  { code: 'PAB', nombre: 'Balboa', locale: 'es-PA' },
  { code: 'DOP', nombre: 'Peso dominicano', locale: 'es-DO' },
  { code: 'COP', nombre: 'Peso colombiano', locale: 'es-CO' },
  { code: 'PEN', nombre: 'Sol peruano', locale: 'es-PE' },
  { code: 'BOB', nombre: 'Boliviano', locale: 'es-BO' },
  { code: 'CLP', nombre: 'Peso chileno', locale: 'es-CL' },
  { code: 'ARS', nombre: 'Peso argentino', locale: 'es-AR' },
  { code: 'UYU', nombre: 'Peso uruguayo', locale: 'es-UY' },
  { code: 'PYG', nombre: 'Guaraní', locale: 'es-PY' },
  { code: 'EUR', nombre: 'Euro', locale: 'es-ES' },
]

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]))

/** true si el navegador reconoce el código ISO 4217. */
export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false
  try {
    new Intl.NumberFormat('es', { style: 'currency', currency: code })
    return true
  } catch {
    return false
  }
}

const localeOf = (code: string) => byCode.get(code)?.locale ?? 'es'

const cache = new Map<string, Intl.NumberFormat>()
function formatter(code: string, compact: boolean): Intl.NumberFormat {
  const key = `${code}|${compact}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(localeOf(code), {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    })
    cache.set(key, f)
  }
  return f
}

/** es-GT separa el símbolo con un espacio ("Q 1,234.56"); en Saldá siempre fue "Q1,234.56". */
const tidy = (code: string, text: string) => (code === 'GTQ' ? text.replace(/Q\s/u, 'Q') : text)

/** Monto con símbolo según la moneda: GTQ → "Q1,234.56", USD → "$1,234.56", COP → "$ 1.235". */
export function formatCurrency(value: number | null | undefined, code: string = DEFAULT_CURRENCY): string {
  return tidy(code, formatter(code, false).format(value ?? 0))
}

/** Versión corta para ejes de gráficas: "Q61.6 mil". */
export function formatCurrencyCompact(value: number, code: string = DEFAULT_CURRENCY): string {
  return tidy(code, formatter(code, true).format(value))
}

/** Símbolo corto de la moneda ("Q", "$", "S/", "€"). */
export function currencySymbol(code: string = DEFAULT_CURRENCY): string {
  return (
    formatter(code, false)
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? code
  )
}

/** Separador decimal de la moneda en su país ("." en GTQ, "," en COP o EUR). */
export function decimalSeparator(code: string = DEFAULT_CURRENCY): '.' | ',' {
  return formatter(code, false)
    .formatToParts(1.5)
    .find((p) => p.type === 'decimal')?.value === ','
    ? ','
    : '.'
}

const REGION_CURRENCY: Record<string, string> = {
  GT: 'GTQ',
  US: 'USD',
  MX: 'MXN',
  HN: 'HNL',
  NI: 'NIO',
  CR: 'CRC',
  PA: 'PAB',
  SV: 'USD',
  EC: 'USD',
  DO: 'DOP',
  CO: 'COP',
  PE: 'PEN',
  BO: 'BOB',
  CL: 'CLP',
  AR: 'ARS',
  UY: 'UYU',
  PY: 'PYG',
  ES: 'EUR',
}

/** Moneda probable según el idioma del navegador ("es-MX" → MXN); si no se sabe, quetzales. */
export function guessCurrency(language: string | undefined): string {
  const region = language?.split('-')[1]?.toUpperCase()
  return (region && REGION_CURRENCY[region]) || DEFAULT_CURRENCY
}
