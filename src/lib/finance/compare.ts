import { ZERO, dec, toMoney } from './money'
import type { PlanResult } from './types'

export interface MetricComparison {
  a: number
  b: number
  /** b − a: negativo significa que B es menor (mejor, en costos). */
  diferencia: number
}

export interface ScenarioComparison {
  totalPagado: MetricComparison
  interesCargos: MetricComparison
  mesLibre: { a: number | null; b: number | null; diferencia: number | null }
  /** Flujo libre acumulado en el mismo horizonte para ambos escenarios. */
  flujoLibre: MetricComparison
  horizonte: number
}

function metric(a: number, b: number): MetricComparison {
  return { a, b, diferencia: toMoney(dec(b).minus(a)) }
}

/** Flujo libre acumulado; después de liquidar se asume el flujo del último mes sin pagos. */
function flujoAcumulado(plan: PlanResult, horizonte: number, libreSinDeuda: number) {
  let total = ZERO
  for (let i = 0; i < horizonte; i++) {
    const mes = plan.meses[i]
    total = total.plus(mes ? mes.flujoLibre : libreSinDeuda)
  }
  return toMoney(total)
}

export function compareScenarios(a: PlanResult, b: PlanResult, libreSinDeuda = 0): ScenarioComparison {
  const horizonte = Math.max(a.meses.length, b.meses.length)
  return {
    totalPagado: metric(a.totalPagado, b.totalPagado),
    interesCargos: metric(a.totalInteresCargos, b.totalInteresCargos),
    mesLibre: {
      a: a.mesLibre,
      b: b.mesLibre,
      diferencia: a.mesLibre != null && b.mesLibre != null ? b.mesLibre - a.mesLibre : null,
    },
    flujoLibre: metric(flujoAcumulado(a, horizonte, libreSinDeuda), flujoAcumulado(b, horizonte, libreSinDeuda)),
    horizonte,
  }
}
