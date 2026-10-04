import { D, ZERO, dec, sumMoney, toMoney } from './money'
import { addMonths, monthsBetween, normalizePeriod } from './period'

/** Préstamo con cargo fijo mensual sobre el monto original (p. ej. "5 % mensual sobre Q5,000"). */
export interface FlatLoanTerms {
  montoOriginal: number
  tasaAnual: number
  /** El saldo base incluye el interés hasta el mes anterior a esta fecha. */
  fechaBase: string
  saldoBase: number
  /** Desde el mes de vencimiento ya no se suman cargos. */
  fechaVencimiento: string | null
}

export interface FlatPaymentRef {
  id?: string
  periodo: string
  fecha: string
  created_at?: string
  saldo_despues: number
  capital?: number | null
}

/** Cargo fijo de cada mes: monto original × tasa anual / 12. */
export function flatMonthlyCharge(t: Pick<FlatLoanTerms, 'montoOriginal' | 'tasaAnual'>): number {
  return toMoney(dec(t.montoOriginal).times(t.tasaAnual).div(12))
}

/**
 * Saldo al INICIO de un período (cargos de los meses completos anteriores).
 * Mismo cálculo que public.flat_balance_at en la BD.
 */
export function flatBalanceAt(terms: FlatLoanTerms, payments: FlatPaymentRef[], periodo: string): number {
  const p = normalizePeriod(periodo)
  const ref = payments
    .filter((x) => x.periodo < p)
    .sort(
      (a, b) =>
        b.periodo.localeCompare(a.periodo) ||
        b.fecha.localeCompare(a.fecha) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )[0]

  const saldo = ref ? ref.saldo_despues : terms.saldoBase
  const desde = ref ? addMonths(ref.periodo, 1) : normalizePeriod(terms.fechaBase)
  if (saldo <= 0) return saldo

  let hasta = addMonths(p, -1)
  if (terms.fechaVencimiento) {
    const venc = normalizePeriod(terms.fechaVencimiento)
    if (venc < hasta) hasta = venc
  }
  const meses = Math.max(0, monthsBetween(desde, hasta) + 1)
  return toMoney(dec(saldo).plus(dec(flatMonthlyCharge(terms)).times(meses)))
}

/** Lo que se debe si se cancela durante el período (incluye el cargo de ese mes). */
export function flatPayoffIn(terms: FlatLoanTerms, payments: FlatPaymentRef[], periodo: string): number {
  return flatBalanceAt(terms, payments, addMonths(normalizePeriod(periodo), 1))
}

/**
 * Parte de un pago que es interés: el interés acumulado sin pagar (lo que se debe menos el capital
 * pendiente). El capital pendiente es el monto original menos el capital ya pagado.
 */
export function flatInterestPortion(
  terms: Pick<FlatLoanTerms, 'montoOriginal'>,
  previousPayments: FlatPaymentRef[],
  adeudado: number,
  pago: number,
): number {
  const capitalPagado = sumMoney(previousPayments.map((x) => dec(x.capital ?? 0)))
  const capitalPendiente = D.max(ZERO, dec(terms.montoOriginal).minus(capitalPagado))
  const interesPendiente = D.max(ZERO, dec(adeudado).minus(capitalPendiente))
  return toMoney(D.min(interesPendiente, pago))
}
