import { normalizePeriod, projectPlan, type PlanResult } from '@/lib/finance'
import { seedToPlanInput } from './to-plan-input'
import type { SeedData, SeedDebt, SeedExpense, SeedInstallment, SeedPayment } from './types'

/** Payload que recibe la RPC `import_initial_data` (ver supabase/migrations/*_import_reset.sql). */
export interface ImportPayload {
  profile: SeedData['profile']
  budget_items: SeedData['budget_items']
  debts: SeedDebt[]
  debt_installments: SeedInstallment[]
  snapshots: { debt: string; periodo: string; saldo: number; cuotas_fuera_saldo: number; origen: 'historial' }[]
  payments: SeedPayment[]
  expenses: SeedExpense[]
  receivables: { persona: string; monto: number; saldo: number; notas?: string | null }[]
  plan: {
    nombre: string
    estrategia: SeedData['plan_inicial']['estrategia']
    presupuesto_deudas: number
    abono_extra: number
    fecha_inicio: string
    activo: boolean
    supuestos: PlanSupuestos
    rows: PlanRowPayload[]
  }
}

export interface PlanSupuestos {
  supuestos: string[]
  advertencias: string[]
  deudas: {
    key: string
    nombre: string
    tasa_anual: number | null
    cuota_mensual: number
    seguro_mensual: number | null
  }[]
  resumen: {
    deuda_inicial: number
    total_pagado: number
    total_interes_cargos: number
    mes_libre: number | null
    periodo_libre: string | null
  }
}

export interface PlanRowPayload {
  periodo: string
  /** null = fila de totales. */
  debt: string | null
  saldo: number
  pago: number
  interes_cargos: number
}

function fueraSaldo(installments: SeedInstallment[]): number {
  const cents = installments.reduce((acc, i) => {
    const capitalPorCuota = i.monto_cuota - (i.cargo_extra_por_cuota ?? 0)
    const pendiente = i.capital_pendiente ?? capitalPorCuota * (i.cuotas_totales - i.cuotas_cobradas)
    return acc + Math.round(pendiente * 100)
  }, 0)
  return cents / 100
}

/** Matriz `monthly_snapshots_historial` → filas de snapshot. Las cuotas fuera de saldo solo se conocen para el último mes. */
export function historialToSnapshots(seed: SeedData): ImportPayload['snapshots'] {
  const { _columnas, ...meses } = seed.monthly_snapshots_historial
  const columnas = (_columnas ?? []) as string[]
  const periodos = Object.keys(meses).map(normalizePeriod).sort()
  const ultimo = periodos.at(-1)

  return Object.entries(meses).flatMap(([mes, valores]) => {
    const periodo = normalizePeriod(mes)
    return (valores as (number | null)[]).flatMap((saldo, idx) => {
      const debt = columnas[idx]
      if (saldo == null || !debt) return []
      const fuera = periodo === ultimo ? fueraSaldo(seed.debt_installments.filter((i) => i.debt === debt)) : 0
      return [{ debt, periodo, saldo, cuotas_fuera_saldo: fuera, origen: 'historial' as const }]
    })
  })
}

/** Filas de `plan_rows`: una por deuda y mes (saldo incluye cuotas fuera de saldo) más la fila de totales. */
export function planRows(result: PlanResult): PlanRowPayload[] {
  return result.meses.flatMap((m) => [
    ...Object.entries(m.deudas).map(([debt, d]) => ({
      periodo: m.periodo,
      debt,
      saldo: d.total,
      pago: d.pago,
      interes_cargos: Math.round((d.interes + d.cargos) * 100) / 100,
    })),
    { periodo: m.periodo, debt: null, saldo: m.deudaReal, pago: m.pago, interes_cargos: m.interesCargos },
  ])
}

export function planSupuestos(seedDebts: SeedDebt[], result: PlanResult): PlanSupuestos {
  return {
    supuestos: result.supuestos,
    advertencias: result.advertencias,
    deudas: seedDebts
      .filter((d) => d.activa !== false)
      .map((d) => ({
        key: d.key,
        nombre: d.nombre,
        tasa_anual: d.tasa_anual,
        cuota_mensual: d.cuota_mensual ?? 0,
        seguro_mensual: d.seguro_mensual ?? null,
      })),
    resumen: {
      deuda_inicial: result.deudaInicial,
      total_pagado: result.totalPagado,
      total_interes_cargos: result.totalInteresCargos,
      mes_libre: result.mesLibre,
      periodo_libre: result.periodoLibre,
    },
  }
}

export function buildSeedPayload(seed: SeedData, opts: { includeReceivables?: boolean } = {}): ImportPayload {
  const projection = projectPlan(seedToPlanInput(seed))
  const plan = seed.plan_inicial

  return {
    profile: seed.profile,
    budget_items: seed.budget_items,
    debts: seed.debts,
    debt_installments: seed.debt_installments,
    snapshots: historialToSnapshots(seed),
    payments: seed.payments,
    expenses: seed.expenses,
    receivables: opts.includeReceivables ? (seed.receivables_opcional ?? []) : [],
    plan: {
      nombre: plan.nombre,
      estrategia: plan.estrategia,
      presupuesto_deudas: plan.presupuesto_deudas,
      abono_extra: plan.abono_extra,
      fecha_inicio: normalizePeriod(plan.fecha_inicio),
      activo: plan.activo,
      supuestos: planSupuestos(seed.debts, projection),
      rows: planRows(projection),
    },
  }
}
