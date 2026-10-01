import { EPSILON, ZERO, dec, sumMoney, toMoney } from './money'
import { impliedMonthlyRate, loanPayment } from './rates'
import type { DebtInput, PlanInput } from './types'

export const CONSOLIDATION_ID = 'consolidacion'

export interface ConsolidationOptions {
  monto: number
  plazoMeses: number
  /** Cuota ofrecida por el banco; si se omite, se calcula con `tasaAnual`. */
  cuota?: number | null
  tasaAnual?: number | null
  /** Ids de las deudas que se cancelan con el préstamo nuevo. */
  cancelar: string[]
  /** Deuda que recibe el sobrante del préstamo (si queda). */
  aplicarSobranteA?: string | null
  nombre?: string
}

export interface Cancelacion {
  id: string
  nombre: string
  monto: number
  /** true cuando el banco no informó saldo de cancelación y se usó la deuda real. */
  pendiente: boolean
  /** true cuando el préstamo no alcanzó y la deuda quedó cancelada solo en parte. */
  parcial: boolean
}

export interface ConsolidationSetup {
  input: PlanInput
  tasaAnual: number
  cuota: number
  cancelaciones: Cancelacion[]
  totalCancelado: number
  /** Diferencia entre lo que pide el banco para cancelar y la deuda real registrada. */
  costoCancelacion: number
  sobranteAplicado: number
  /** Efectivo que queda libre después de cancelar y aplicar el sobrante. */
  sobranteLibre: number
  advertencias: string[]
}

function deudaReal(debt: DebtInput) {
  const fuera = (debt.installments ?? []).map((i) =>
    i.capitalPendiente != null
      ? dec(i.capitalPendiente)
      : dec(i.montoCuota).minus(i.cargoExtraPorCuota).times(i.cuotasRestantes),
  )
  return dec(debt.saldo).plus(sumMoney(fuera))
}

/**
 * Arma el escenario de consolidación: cancela las deudas elegidas con el préstamo nuevo,
 * aplica el sobrante a la deuda indicada y devuelve el PlanInput listo para `projectPlan`.
 */
export function buildConsolidation(base: PlanInput, opts: ConsolidationOptions): ConsolidationSetup {
  if (opts.monto <= 0 || opts.plazoMeses <= 0) throw new Error('Monto y plazo deben ser mayores a 0')
  if (opts.cuota == null && opts.tasaAnual == null) throw new Error('Indica la cuota o la tasa del préstamo')

  const advertencias: string[] = []
  const rMensual =
    opts.cuota != null ? impliedMonthlyRate(opts.monto, opts.plazoMeses, opts.cuota) : opts.tasaAnual! / 12
  const cuota = opts.cuota ?? loanPayment(opts.monto, rMensual, opts.plazoMeses)

  let disponible = dec(opts.monto)
  let costoCancelacion = ZERO
  const cancelaciones: Cancelacion[] = []
  const debts = new Map(base.debts.map((d) => [d.id, { ...d, installments: [...(d.installments ?? [])] }]))

  for (const id of opts.cancelar) {
    const debt = debts.get(id)
    if (!debt) continue
    const real = deudaReal(debt)
    const pendiente = debt.saldoCancelacion == null
    const monto = pendiente ? real : dec(debt.saldoCancelacion!)
    if (pendiente) advertencias.push(`${debt.nombre}: saldo de cancelación PENDIENTE, se usa la deuda real.`)

    if (disponible.gte(monto)) {
      disponible = disponible.minus(monto)
      costoCancelacion = costoCancelacion.plus(monto.minus(real))
      debts.delete(id)
      cancelaciones.push({ id, nombre: debt.nombre, monto: toMoney(monto), pendiente, parcial: false })
    } else {
      // El préstamo no alcanza: se abona lo que queda al saldo de esta deuda.
      const abono = disponible
      debt.saldo = toMoney(dec(debt.saldo).minus(abono))
      disponible = ZERO
      cancelaciones.push({ id, nombre: debt.nombre, monto: toMoney(abono), pendiente, parcial: true })
      advertencias.push(`El préstamo no alcanza para cancelar ${debt.nombre} por completo.`)
    }
  }

  let sobranteAplicado = ZERO
  if (opts.aplicarSobranteA && disponible.gt(EPSILON)) {
    const target = debts.get(opts.aplicarSobranteA)
    if (target) {
      const abono = dec(target.saldo).lt(disponible) ? dec(target.saldo) : disponible
      target.saldo = toMoney(dec(target.saldo).minus(abono))
      sobranteAplicado = abono
      disponible = disponible.minus(abono)
    }
  }

  const loan: DebtInput = {
    id: CONSOLIDATION_ID,
    nombre: opts.nombre ?? 'Préstamo de consolidación',
    tipo: 'prestamo',
    saldo: opts.monto,
    tasaAnual: rMensual * 12,
    cuotaMensual: cuota,
    seguroMensual: 0,
  }

  const cuotasCanceladas = cancelaciones
    .filter((c) => !c.parcial)
    .reduce((acc, c) => acc.plus(base.debts.find((d) => d.id === c.id)?.cuotaMensual ?? 0), ZERO)

  const input: PlanInput = {
    ...base,
    debts: [loan, ...debts.values()],
    presupuestoDeudas: toMoney(dec(base.presupuestoDeudas).minus(cuotasCanceladas).plus(cuota)),
  }

  return {
    input,
    tasaAnual: rMensual * 12,
    cuota,
    cancelaciones,
    totalCancelado: toMoney(sumMoney(cancelaciones.map((c) => dec(c.monto)))),
    costoCancelacion: toMoney(costoCancelacion),
    sobranteAplicado: toMoney(sobranteAplicado),
    sobranteLibre: toMoney(disponible),
    advertencias,
  }
}
