import { D, EPSILON, ZERO, dec, sumMoney, toMoney, type Dec } from './money'
import { addMonths, normalizePeriod } from './period'
import { formatPeriodName } from './period-name'
import type { DebtInput, DebtMonth, Liquidacion, PlanInput, PlanMonth, PlanResult } from './types'

const DEFAULT_MAX_MESES = 120

interface InstallmentState {
  restantes: number
  /** Capital que aún no está en el saldo. */
  pendiente: Dec
  capitalPorCuota: Dec
  cargo: Dec
}

interface DebtState {
  input: DebtInput
  tasa: Dec
  rMensual: Dec
  seguro: Dec
  cuota: Dec
  saldo: Dec
  installments: InstallmentState[]
  /** Interés fijo mensual (préstamos sobre monto original); null = sobre saldo. */
  fijo: Dec | null
  vencimiento: string | null
}

function fueraSaldo(state: DebtState): Dec {
  return sumMoney(state.installments.map((i) => i.pendiente))
}

function totalDeuda(state: DebtState): Dec {
  return state.saldo.plus(fueraSaldo(state))
}

function initState(debt: DebtInput): DebtState {
  const tasa = dec(debt.tasaAnual ?? 0)
  const installments = (debt.installments ?? [])
    .filter((i) => i.cuotasRestantes > 0)
    .map<InstallmentState>((i) => {
      const cargo = dec(i.cargoExtraPorCuota)
      // Sin capital informado, el capital de cada cuota es la cuota menos su cargo extra.
      const capitalPorCuota =
        i.capitalPendiente != null ? dec(i.capitalPendiente).div(i.cuotasRestantes) : dec(i.montoCuota).minus(cargo)
      const pendiente = i.capitalPendiente != null ? dec(i.capitalPendiente) : capitalPorCuota.times(i.cuotasRestantes)
      return { restantes: i.cuotasRestantes, pendiente, capitalPorCuota, cargo }
    })
  return {
    input: debt,
    tasa,
    rMensual: tasa.div(12),
    seguro: dec(debt.seguroMensual ?? 0),
    cuota: dec(debt.cuotaMensual),
    saldo: dec(debt.saldo),
    installments,
    fijo: debt.interesFijoMensual != null ? dec(debt.interesFijoMensual) : null,
    vencimiento: debt.vencimiento ? normalizePeriod(debt.vencimiento) : null,
  }
}

/** Orden de prioridad para aplicar el sobrante según la estrategia. */
function priorityOrder(states: DebtState[], estrategia: PlanInput['estrategia']): DebtState[] {
  const sorted = [...states]
  if (estrategia === 'bola_nieve') {
    sorted.sort((a, b) => a.saldo.comparedTo(b.saldo) || b.tasa.comparedTo(a.tasa))
  } else {
    // Avalancha (y abonos extra en cuotas fijas): mayor tasa primero; empate → menor saldo.
    sorted.sort((a, b) => b.tasa.comparedTo(a.tasa) || a.saldo.comparedTo(b.saldo))
  }
  return sorted
}

function describeAssumptions(input: PlanInput, states: DebtState[]): { supuestos: string[]; advertencias: string[] } {
  const supuestos = [
    'Interés mensual = saldo de cierre del mes anterior × tasa anual nominal / 12.',
    'El seguro de las tarjetas se cobra solo mientras haya saldo.',
    'Cada mes se agrega al saldo una cuota pendiente de las intracuotas/visacuotas; su cargo extra cuenta como costo.',
    'El pago base de cada deuda es min(cuota mensual, saldo).',
  ]
  if (input.estrategia === 'avalancha') {
    supuestos.push('El sobrante del presupuesto se aplica a la deuda con mayor tasa (empate → menor saldo).')
  } else if (input.estrategia === 'bola_nieve') {
    supuestos.push('El sobrante del presupuesto se aplica a la deuda con menor saldo.')
  } else {
    supuestos.push(
      'Cuotas fijas: lo que se libera al liquidar una deuda pasa a flujo libre; solo el abono extra se redistribuye.',
    )
  }

  const advertencias: string[] = []
  for (const s of states) {
    const d = s.input
    if (d.tasaAnual == null) advertencias.push(`${d.nombre}: tasa PENDIENTE DE CONFIRMAR, se proyecta con 0 %.`)
    if (d.tipo === 'tarjeta' && d.seguroMensual == null) {
      advertencias.push(`${d.nombre}: seguro PENDIENTE DE CONFIRMAR, se proyecta con Q0.`)
    }
    if (d.tipo === 'tarjeta' && s.seguro.gt(0)) {
      supuestos.push(`${d.nombre}: seguro de Q${s.seguro.toFixed(2)} mientras haya saldo.`)
    }
    if (s.fijo) {
      supuestos.push(`${d.nombre}: interés fijo de Q${s.fijo.toFixed(2)} por mes sobre el monto original.`)
    }
    if (s.vencimiento) {
      supuestos.push(
        `${d.nombre}: se paga todo el saldo en ${formatPeriodName(s.vencimiento)}, fuera del presupuesto mensual.`,
      )
    }
    for (const i of s.installments) {
      if (i.cargo.gt(0)) {
        supuestos.push(`${d.nombre}: cargo extra de Q${i.cargo.toFixed(2)} en cada cuota pendiente (${i.restantes}).`)
      }
    }
  }
  return { supuestos, advertencias }
}

/** Proyección mes a mes (sección 6.2 del plan). */
export function projectPlan(input: PlanInput): PlanResult {
  const maxMeses = input.maxMeses ?? DEFAULT_MAX_MESES
  const states = input.debts.map(initState)
  const presupuesto = dec(input.presupuestoDeudas)
  const abonoExtra = dec(input.abonoExtra ?? 0)
  const libreBase = dec(input.ingresoMensual ?? 0).minus(input.gastosFijos ?? 0)
  const extras = new Map(Object.entries(input.ingresosExtra ?? {}).map(([p, v]) => [normalizePeriod(p), dec(v)]))
  const { supuestos, advertencias } = describeAssumptions(input, states)

  const deudaInicial = sumMoney(states.map(totalDeuda))
  const liquidaciones: Record<string, Liquidacion | null> = {}
  for (const s of states) {
    liquidaciones[s.input.id] = totalDeuda(s).lt(EPSILON) ? { mes: 0, periodo: addMonths(input.fechaInicio, -1) } : null
  }

  const meses: PlanMonth[] = []
  let totalPagado = ZERO
  let totalCostos = ZERO
  let mesLibre: number | null = deudaInicial.lt(EPSILON) ? 0 : null
  let presupuestoInsuficiente = false

  for (let mes = 1; mes <= maxMeses && mesLibre === null; mes++) {
    const periodo = addMonths(input.fechaInicio, mes - 1)
    const pagos = new Map<DebtState, Dec>()
    const intereses = new Map<DebtState, Dec>()
    const cargos = new Map<DebtState, Dec>()
    /** Pagos únicos al vencimiento: obligatorios y fuera del presupuesto. */
    const obligatorios = new Map<DebtState, Dec>()

    // 1–3. Interés, cargos, cuotas fuera de saldo y pago base.
    for (const s of states) {
      let interes = ZERO
      let cargo = ZERO
      if (s.saldo.gt(0)) {
        interes = s.fijo ?? s.saldo.times(s.rMensual)
        if (s.input.tipo === 'tarjeta') cargo = cargo.plus(s.seguro)
      }
      s.saldo = s.saldo.plus(interes).plus(cargo)

      for (const i of s.installments) {
        if (i.restantes <= 0) continue
        // La última cuota lleva todo el capital pendiente para no dejar residuos.
        const capital = i.restantes === 1 ? i.pendiente : D.min(i.capitalPorCuota, i.pendiente)
        s.saldo = s.saldo.plus(capital).plus(i.cargo)
        i.pendiente = i.pendiente.minus(capital)
        i.restantes -= 1
        cargo = cargo.plus(i.cargo)
      }

      if (s.vencimiento && periodo >= s.vencimiento && s.saldo.gt(0)) {
        obligatorios.set(s, s.saldo)
        pagos.set(s, s.saldo)
        s.saldo = ZERO
        intereses.set(s, interes)
        cargos.set(s, cargo)
        continue
      }
      const pago = s.saldo.gt(0) ? D.min(s.cuota, s.saldo) : ZERO
      s.saldo = s.saldo.minus(pago)
      pagos.set(s, pago)
      intereses.set(s, interes)
      cargos.set(s, cargo)
    }

    // 4. Redistribución del sobrante.
    const pagoBase = sumMoney(pagos.values()).minus(sumMoney(obligatorios.values()))
    let disponible = input.estrategia === 'cuotas_fijas' ? abonoExtra : presupuesto.plus(abonoExtra).minus(pagoBase)
    if (disponible.lt(0)) {
      presupuestoInsuficiente = true
      disponible = ZERO
    }
    for (const s of priorityOrder(states, input.estrategia)) {
      if (disponible.lte(0)) break
      if (s.saldo.lte(0)) continue
      const abono = D.min(disponible, s.saldo)
      s.saldo = s.saldo.minus(abono)
      pagos.set(s, (pagos.get(s) ?? ZERO).plus(abono))
      disponible = disponible.minus(abono)
    }

    // 5. Registro del mes.
    const deudas: Record<string, DebtMonth> = {}
    for (const s of states) {
      if (s.saldo.abs().lt(EPSILON)) s.saldo = ZERO
      const fuera = fueraSaldo(s)
      const interes = intereses.get(s) ?? ZERO
      const cargo = cargos.get(s) ?? ZERO
      deudas[s.input.id] = {
        saldo: toMoney(s.saldo),
        fueraSaldo: toMoney(fuera),
        total: toMoney(s.saldo.plus(fuera)),
        pago: toMoney(pagos.get(s) ?? ZERO),
        interes: toMoney(interes),
        cargos: toMoney(cargo),
      }
      if (liquidaciones[s.input.id] === null && s.saldo.plus(fuera).lt(EPSILON)) {
        liquidaciones[s.input.id] = { mes, periodo }
      }
    }

    const pagoMes = sumMoney(pagos.values())
    const libreMes = libreBase.plus(extras.get(periodo) ?? ZERO).minus(pagoMes)
    for (const [s, monto] of obligatorios) {
      if (libreMes.lt(0)) {
        advertencias.push(
          `En ${formatPeriodName(periodo)} vence ${s.input.nombre} (Q${monto.toFixed(2)}): el flujo libre de ese mes queda en −Q${libreMes.abs().toFixed(2)}.`,
        )
      }
    }
    const costoMes = sumMoney(intereses.values()).plus(sumMoney(cargos.values()))
    const saldoTotal = sumMoney(states.map((s) => s.saldo))
    const fueraTotal = sumMoney(states.map(fueraSaldo))
    const deudaReal = saldoTotal.plus(fueraTotal)
    totalPagado = totalPagado.plus(pagoMes)
    totalCostos = totalCostos.plus(costoMes)

    meses.push({
      mes,
      periodo,
      deudas,
      saldoTotal: toMoney(saldoTotal),
      fueraSaldoTotal: toMoney(fueraTotal),
      deudaReal: toMoney(deudaReal),
      pago: toMoney(pagoMes),
      interesCargos: toMoney(costoMes),
      flujoLibre: toMoney(libreMes),
    })

    // 6. Fin del ciclo.
    if (deudaReal.lt(EPSILON)) mesLibre = mes
  }

  if (presupuestoInsuficiente) {
    advertencias.push('El presupuesto para deudas es menor que la suma de las cuotas en algún mes.')
  }
  if (mesLibre === null) {
    advertencias.push(`La deuda no se liquida dentro de ${maxMeses} meses con este presupuesto.`)
  }

  return {
    meses,
    deudaInicial: toMoney(deudaInicial),
    totalPagado: toMoney(totalPagado),
    totalInteresCargos: toMoney(totalCostos),
    mesLibre,
    periodoLibre: mesLibre ? addMonths(input.fechaInicio, mesLibre - 1) : null,
    liquidaciones,
    supuestos,
    advertencias,
  }
}
