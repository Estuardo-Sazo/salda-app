import { D, ZERO, dec, toMoney } from './money'

export interface PaymentRef {
  id: string
  fecha: string
  created_at: string
  saldo_despues: number
}

/**
 * Saldo antes de un pago: el saldo_despues del pago anterior (por fecha y creación) o el saldo base.
 * `excludeId` permite recalcularlo al editar un pago existente.
 */
export function previousBalance(payments: PaymentRef[], saldoBase: number, fecha: string, excludeId?: string): number {
  const prev = payments
    .filter((p) => p.id !== excludeId && p.fecha <= fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at))[0]
  return prev ? prev.saldo_despues : saldoBase
}

export interface PaymentInput {
  saldoAnterior: number
  pagoTotal: number
  saldoDespues: number
  interes: number | null
  cargos: number | null
}

export interface PaymentAnalysis {
  /** Lo que bajó el saldo (negativo si subió, p. ej. por compras con tarjeta). */
  bajo: number
  capital: number
  interes: number | null
  cargos: number | null
  esEstimado: boolean
  /** Motivo por el que no se pudo estimar el interés, si aplica. */
  advertencia: string | null
}

/**
 * Regla 4 del plan: capital = pago − interés − cargos. Si interés y cargos vienen vacíos,
 * capital = saldo anterior − saldo después y el interés estimado = pago − capital (es_estimado).
 */
export function analyzePayment({
  saldoAnterior,
  pagoTotal,
  saldoDespues,
  interes,
  cargos,
}: PaymentInput): PaymentAnalysis {
  const bajo = dec(saldoAnterior).minus(saldoDespues)

  if (interes != null || cargos != null) {
    const capital = dec(pagoTotal)
      .minus(interes ?? 0)
      .minus(cargos ?? 0)
    return {
      bajo: toMoney(bajo),
      capital: toMoney(capital),
      interes,
      cargos,
      esEstimado: false,
      advertencia: capital.lt(0) ? 'El interés y los cargos superan el pago.' : null,
    }
  }

  const estimado = dec(pagoTotal).minus(bajo)
  if (estimado.lt(0) || estimado.gt(pagoTotal)) {
    return {
      bajo: toMoney(bajo),
      capital: toMoney(D.max(ZERO, D.min(bajo, pagoTotal))),
      interes: null,
      cargos: null,
      esEstimado: false,
      advertencia: estimado.lt(0)
        ? 'El saldo bajó más que el pago: revisá el saldo después o ingresá el interés.'
        : 'El saldo subió (¿compras nuevas?): ingresá el interés del estado de cuenta.',
    }
  }
  return {
    bajo: toMoney(bajo),
    capital: toMoney(bajo),
    interes: toMoney(estimado),
    cargos: null,
    esEstimado: true,
    advertencia: null,
  }
}

/** Saldo esperado tras un pago: saldo × (1 + tasa/12) − pago. Sirve como sugerencia, nunca como dato. */
export function expectedBalanceAfter(
  saldoAnterior: number,
  tasaAnual: number | null,
  pagoTotal: number,
): number | null {
  if (tasaAnual == null) return null
  const saldo = dec(saldoAnterior).times(dec(tasaAnual).div(12).plus(1)).minus(pagoTotal)
  return toMoney(D.max(ZERO, saldo))
}
