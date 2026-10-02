import { D, ZERO, dec, toMoney } from './money'

export interface InstallmentState {
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
  capital_pendiente: number | null
  cargo_extra_por_cuota: number
}

export function cuotasRestantes(i: InstallmentState): number {
  return Math.max(0, i.cuotas_totales - i.cuotas_cobradas)
}

/** Capital que aún no está en el saldo (misma regla que public.debt_fuera_saldo). */
export function fueraDeSaldo(i: InstallmentState): number {
  const restantes = cuotasRestantes(i)
  if (restantes === 0) return 0
  if (i.capital_pendiente != null) return i.capital_pendiente
  return toMoney(dec(i.monto_cuota).minus(i.cargo_extra_por_cuota).times(restantes))
}

/**
 * "+1 cuota cobrada": suma una cuota cobrada y, si el banco informó capital pendiente,
 * le descuenta la parte proporcional (la última cuota lo deja en cero).
 */
export function chargeOne(i: InstallmentState): Pick<InstallmentState, 'cuotas_cobradas' | 'capital_pendiente'> {
  const restantes = cuotasRestantes(i)
  if (restantes === 0) throw new Error('Esta cuota ya está cobrada por completo')
  const cuotas_cobradas = i.cuotas_cobradas + 1
  if (i.capital_pendiente == null) return { cuotas_cobradas, capital_pendiente: null }
  const porCuota = dec(i.capital_pendiente).div(restantes)
  const pendiente = restantes === 1 ? ZERO : D.max(ZERO, dec(i.capital_pendiente).minus(porCuota))
  return { cuotas_cobradas, capital_pendiente: toMoney(pendiente) }
}
