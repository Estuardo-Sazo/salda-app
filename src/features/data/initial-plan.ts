import { projectPlan, type Strategy } from '@/lib/finance'
import { flatBalanceAt, flatPayoffIn } from '@/lib/finance/flat-loan'
import {
  buildPlanInput,
  buildSavePlanPayload,
  defaultPlanName,
  defaultPlanStart,
  type PlanDebtSource,
  type PlanSources,
} from '@/features/plan/plan-input'
import type { BackupPlan, RestorePayload } from './backup'

/** Fuentes de la proyección a partir de un payload que todavía no está en la BD. */
export function sourcesFromPayload(p: RestorePayload, periodoActual: string): PlanSources {
  const fuera = new Map<string, number>()
  for (const i of p.debt_installments.filter((x) => x.activa && x.cuotas_cobradas < x.cuotas_totales)) {
    const capital =
      i.capital_pendiente ?? (i.monto_cuota - i.cargo_extra_por_cuota) * (i.cuotas_totales - i.cuotas_cobradas)
    fuera.set(i.debt, (fuera.get(i.debt) ?? 0) + capital)
  }

  const debts = p.debts.map<PlanDebtSource>((d) => {
    const pagos = p.payments
      .filter((x) => x.debt === d.key)
      .map((x, i) => ({ ...x, created_at: String(i).padStart(6, '0') }))
    const ultimo = [...pagos].sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at),
    )[0]
    const saldoActual = ultimo?.saldo_despues ?? d.saldo_base
    const fijo = d.interes_modo === 'monto_original' && d.monto_original != null && d.tasa_anual != null
    const terms = fijo
      ? {
          montoOriginal: d.monto_original!,
          tasaAnual: d.tasa_anual!,
          fechaBase: d.fecha_base,
          saldoBase: d.saldo_base,
          fechaVencimiento: d.fecha_vencimiento,
        }
      : null
    const cerrada = !d.activa || d.cerrada_en != null
    return {
      debt_id: d.key,
      nombre: d.nombre,
      tipo: d.tipo,
      estado: cerrada ? 'cerrada' : saldoActual + (fuera.get(d.key) ?? 0) <= 0 ? 'liquidada' : 'activa',
      tasa_anual: d.tasa_anual,
      cuota_mensual: d.cuota_mensual,
      seguro_mensual: d.seguro_mensual,
      saldo_cancelacion: d.saldo_cancelacion,
      saldo_actual: saldoActual,
      interes_modo: d.interes_modo,
      monto_original: d.monto_original,
      pago_unico: d.pago_unico,
      fecha_vencimiento: d.fecha_vencimiento,
      interes_devengado: terms ? flatBalanceAt(terms, pagos, periodoActual) - saldoActual : 0,
      saldo_para_cancelar: terms ? flatPayoffIn(terms, pagos, periodoActual) : null,
    }
  })

  return {
    debts,
    installments: p.debt_installments.map((i) => ({ ...i, debt_id: i.debt })),
    ingresoMensual: p.profile?.ingreso_mensual ?? null,
    gastosFijos: p.budget_items.filter((b) => b.activo).reduce((acc, b) => acc + Math.round(b.monto * 100), 0) / 100,
    ingresosExtra: p.extra_incomes,
    moneda: p.profile?.moneda ?? null,
  }
}

export interface InitialPlanOptions {
  estrategia: Strategy
  presupuestoDeudas: number
  abonoExtra?: number
  periodoActual: string
  nombre?: string
}

/** Plan inicial activo para una cuenta nueva (onboarding "desde cero" o importación de Excel). */
export function initialPlan(p: RestorePayload, opts: InitialPlanOptions): BackupPlan {
  const fechaInicio = defaultPlanStart(opts.periodoActual)
  const input = buildPlanInput(sourcesFromPayload(p, opts.periodoActual), {
    estrategia: opts.estrategia,
    presupuestoDeudas: opts.presupuestoDeudas,
    abonoExtra: opts.abonoExtra ?? 0,
    fechaInicio,
    periodoActual: opts.periodoActual,
  })
  const result = projectPlan(input)
  const saved = buildSavePlanPayload(input, result, {
    nombre: opts.nombre ?? defaultPlanName(opts.estrategia, fechaInicio),
    activo: true,
    periodoActual: opts.periodoActual,
  })
  const { rows, ...plan } = saved
  return { ...plan, rows: rows.map(({ debt_id, ...r }) => ({ ...r, debt: debt_id })) }
}
