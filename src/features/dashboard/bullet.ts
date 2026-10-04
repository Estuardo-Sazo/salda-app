import { monthsBetween, normalizePeriod } from '@/lib/finance/period'

export interface BulletDebt {
  debt_id: string
  nombre: string
  estado: string
  pago_unico: boolean | null
  fecha_vencimiento: string | null
  interes_modo: string | null
  monto_original: number | null
  tasa_anual: number | null
  /** Lo que se debe al inicio del mes actual (incluye interés fijo devengado). */
  deuda_real: number
  /** Lo que cuesta cancelar este mes (solo interés fijo). */
  saldo_para_cancelar: number | null
}

export interface BulletAlert {
  debtId: string
  nombre: string
  periodo: string
  /** Meses que faltan (0 = vence este mes). */
  mesesFaltan: number
  monto: number
  ingresosExtra: number
  faltante: number
  /** Cuánto apartar por mes, desde este mes hasta el vencimiento, para cubrir el faltante. */
  apartarPorMes: number
  /** Si tiene interés fijo: lo que costaría cancelarlo este mes y cuánto se ahorra. */
  cancelarHoy: { monto: number; ahorro: number } | null
}

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Pagos únicos que vencen dentro del horizonte (meses), con su cobertura por ingresos extra.
 * El monto al vencimiento suma el cargo fijo de cada mes que falta (incluido el del vencimiento).
 */
export function bulletAlerts(
  debts: BulletDebt[],
  extras: { periodo: string; monto: number }[],
  periodoActual: string,
  horizonte = 3,
): BulletAlert[] {
  return debts
    .filter((d) => d.estado === 'activa' && d.pago_unico && d.fecha_vencimiento)
    .flatMap((d) => {
      const periodo = normalizePeriod(d.fecha_vencimiento!)
      const meses = monthsBetween(periodoActual, periodo)
      if (meses < 0 || meses >= horizonte) return []

      const fijo = d.interes_modo === 'monto_original' && d.monto_original != null && d.tasa_anual != null
      const cargo = fijo ? round2((d.monto_original! * d.tasa_anual!) / 12) : 0
      const monto = round2(d.deuda_real + cargo * (meses + 1))
      const ingresosExtra = round2(extras.filter((x) => x.periodo === periodo).reduce((a, x) => a + x.monto, 0))
      const faltante = Math.max(0, round2(monto - ingresosExtra))
      const cancelarHoy =
        fijo && d.saldo_para_cancelar != null && meses > 0
          ? { monto: d.saldo_para_cancelar, ahorro: round2(monto - d.saldo_para_cancelar) }
          : null

      return [
        {
          debtId: d.debt_id,
          nombre: d.nombre,
          periodo,
          mesesFaltan: meses,
          monto,
          ingresosExtra,
          faltante,
          apartarPorMes: round2(faltante / (meses + 1)),
          cancelarHoy,
        },
      ]
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}
