import { D, ZERO, dec, toMoney } from './money'

/**
 * Dinero que te deben con interés fijo mensual sobre lo prestado (como un préstamo de
 * "10 % mensual sobre Q1,000"). Cada mes iniciado cuenta completo:
 * prestado el 01/10 → hasta el 01/11 es 1 mes; desde el 02/11 son 2 meses.
 */
export interface ReceivableTerms {
  monto: number
  /** Fracción mensual (0.10 = 10 %); null = sin interés. */
  tasaMensual: number | null
  /** 'YYYY-MM-DD' */
  fechaPrestamo: string
}

export interface ReceivableCobro {
  fecha: string
  monto: number
}

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Misma fecha `n` meses después; si el día no existe, el último día del mes (31/01 → 28/02). */
export function addMonthsToDate(fecha: string, n: number): string {
  const { y, m, d } = parse(fecha)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return iso(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

/** Día siguiente a una fecha. */
export function nextDay(fecha: string): string {
  const { y, m, d } = parse(fecha)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Meses iniciados entre el préstamo y una fecha (mínimo 1 desde el día del préstamo; 0 si es antes). */
export function monthsStarted(desde: string, hasta: string): number {
  if (hasta < desde) return 0
  const a = parse(desde)
  const b = parse(hasta)
  let meses = (b.y - a.y) * 12 + (b.m - a.m)
  // Pasado el aniversario del mes (con el día ajustado al fin de mes) empieza otro mes.
  if (hasta > addMonthsToDate(desde, meses)) meses += 1
  return Math.max(1, meses)
}

export const monthlyInterest = (t: Pick<ReceivableTerms, 'monto' | 'tasaMensual'>): number =>
  t.tasaMensual == null ? 0 : toMoney(dec(t.monto).times(t.tasaMensual))

/** Lo que te deben en total (capital + interés de los meses iniciados) si te pagan en `fecha`. */
export function owedAt(t: ReceivableTerms, fecha: string): number {
  const meses = t.tasaMensual == null ? 0 : monthsStarted(t.fechaPrestamo, fecha)
  return toMoney(dec(t.monto).plus(dec(monthlyInterest(t)).times(meses)))
}

export interface ReceivableStatus {
  /** Meses que cuentan: hasta hoy o hasta el cobro que lo liquidó. */
  meses: number
  interesMensual: number
  interesGenerado: number
  /** Capital + interés generado. */
  total: number
  cobrado: number
  /** Lo que falta cobrar hoy (0 si está liquidado). */
  pendiente: number
  liquidado: boolean
  fechaLiquidacion: string | null
  /** Interés ya cobrado: los cobros van primero al interés y luego al capital. */
  gananciaCobrada: number
  /** Si sigue pendiente: desde esta fecha se suma otro mes de interés. */
  proximoAumento: string | null
}

/** Estado a una fecha. El préstamo se liquida con el primer cobro que cubre lo adeudado a esa fecha. */
export function receivableStatus(t: ReceivableTerms, cobros: ReceivableCobro[], hoy: string): ReceivableStatus {
  const interesMensual = monthlyInterest(t)
  const ordenados = [...cobros].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let cobrado = ZERO
  let liquidacion: string | null = null
  for (const c of ordenados) {
    cobrado = cobrado.plus(c.monto)
    if (liquidacion == null && cobrado.gte(owedAt(t, c.fecha) - 0.005)) liquidacion = c.fecha
  }

  const corte = liquidacion ?? (hoy < t.fechaPrestamo ? t.fechaPrestamo : hoy)
  const meses = t.tasaMensual == null ? 0 : monthsStarted(t.fechaPrestamo, corte)
  const interesGenerado = toMoney(dec(interesMensual).times(meses))
  const total = toMoney(dec(t.monto).plus(interesGenerado))
  const pendiente = liquidacion ? 0 : toMoney(D.max(ZERO, dec(total).minus(cobrado)))

  return {
    meses,
    interesMensual,
    interesGenerado,
    total,
    cobrado: toMoney(cobrado),
    pendiente,
    liquidado: liquidacion != null,
    fechaLiquidacion: liquidacion,
    gananciaCobrada: toMoney(D.min(cobrado, interesGenerado)),
    proximoAumento:
      liquidacion || t.tasaMensual == null || interesMensual === 0
        ? null
        : nextDay(addMonthsToDate(t.fechaPrestamo, Math.max(1, meses))),
  }
}
