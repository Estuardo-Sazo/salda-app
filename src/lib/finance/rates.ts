/** Tasa mensual nominal a partir de la tasa anual nominal. */
export function monthlyRate(tasaAnual: number): number {
  return tasaAnual / 12
}

/** Cuota fija (sistema francés) para un préstamo de P a n meses con tasa mensual r. */
export function loanPayment(principal: number, rMensual: number, meses: number): number {
  if (meses <= 0) throw new Error('El plazo debe ser mayor a 0')
  if (rMensual === 0) return round2(principal / meses)
  return round2((principal * rMensual) / (1 - (1 + rMensual) ** -meses))
}

/**
 * Tasa mensual implícita de una oferta de préstamo (bisección).
 * Devuelve 0 si la cuota no alcanza a cubrir el capital sin interés.
 */
export function impliedMonthlyRate(principal: number, meses: number, cuota: number): number {
  if (principal <= 0 || meses <= 0 || cuota * meses <= principal) return 0
  const present = (r: number) => (cuota * (1 - (1 + r) ** -meses)) / r
  let lo = 1e-12
  let hi = 1
  for (let i = 0; i < 200 && hi - lo > 1e-14; i++) {
    const mid = (lo + hi) / 2
    // A mayor tasa, menor valor presente de las cuotas.
    if (present(mid) > principal) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Meses para liquidar un saldo con cuota fija; null si la cuota no cubre el interés. */
export function monthsToPayoff(saldo: number, rMensual: number, cuota: number): number | null {
  if (saldo <= 0) return 0
  if (cuota <= 0) return null
  if (rMensual === 0) return Math.ceil(saldo / cuota - 1e-9)
  if (cuota <= saldo * rMensual) return null
  const n = -Math.log(1 - (rMensual * saldo) / cuota) / Math.log(1 + rMensual)
  return Math.ceil(n - 1e-9)
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
