import type { PlanInput, Strategy } from '@/lib/finance'
import type { SeedData } from './types'

/** Convierte el seed en la entrada del motor de proyección (solo deudas activas). */
export function seedToPlanInput(
  seed: SeedData,
  overrides: Partial<Pick<PlanInput, 'estrategia' | 'presupuestoDeudas' | 'abonoExtra' | 'fechaInicio'>> & {
    estrategia?: Strategy
  } = {},
): PlanInput {
  const debts = seed.debts
    .filter((d) => d.activa !== false)
    .map((d) => ({
      id: d.key,
      nombre: d.nombre,
      tipo: d.tipo,
      saldo: d.saldo_base,
      tasaAnual: d.tasa_anual,
      cuotaMensual: d.cuota_mensual ?? 0,
      seguroMensual: d.seguro_mensual ?? null,
      saldoCancelacion: d.saldo_cancelacion ?? null,
      installments: seed.debt_installments
        .filter((i) => i.debt === d.key)
        .map((i) => ({
          descripcion: i.descripcion,
          montoCuota: i.monto_cuota,
          cuotasRestantes: i.cuotas_totales - i.cuotas_cobradas,
          capitalPendiente: i.capital_pendiente ?? null,
          cargoExtraPorCuota: i.cargo_extra_por_cuota ?? 0,
        })),
    }))

  return {
    debts,
    estrategia: overrides.estrategia ?? seed.plan_inicial.estrategia,
    presupuestoDeudas: overrides.presupuestoDeudas ?? seed.plan_inicial.presupuesto_deudas,
    abonoExtra: overrides.abonoExtra ?? seed.plan_inicial.abono_extra,
    fechaInicio: overrides.fechaInicio ?? seed.plan_inicial.fecha_inicio,
    ingresoMensual: seed.profile.ingreso_mensual,
    moneda: seed.profile.moneda,
    gastosFijos: seed.budget_items.reduce((acc, b) => acc + Math.round(b.monto * 100), 0) / 100,
  }
}
