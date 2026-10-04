import { flatMonthlyCharge } from '@/lib/finance/flat-loan'
import { addMonths, normalizePeriod } from '@/lib/finance/period'
import type { DebtInput, PlanInput, PlanResult, Strategy } from '@/lib/finance'
import { formatPeriod } from '@/lib/format'
import type { PlanRowPayload, PlanSupuestos } from '@/lib/seed/build-payload'
import { planRows, planSupuestos } from '@/lib/seed/build-payload'

/** Lo mínimo de v_debt_status que necesita la proyección. */
export interface PlanDebtSource {
  debt_id: string
  nombre: string
  tipo: DebtInput['tipo']
  estado: 'activa' | 'liquidada' | 'cerrada'
  tasa_anual: number | null
  cuota_mensual: number | null
  seguro_mensual: number | null
  saldo_cancelacion: number | null
  saldo_actual: number
  interes_modo?: string | null
  monto_original: number | null
  pago_unico?: boolean | null
  fecha_vencimiento?: string | null
  interes_devengado?: number | null
  saldo_para_cancelar: number | null
}

export interface PlanInstallmentSource {
  debt_id: string
  descripcion: string
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
  capital_pendiente: number | null
  cargo_extra_por_cuota: number
  activa: boolean
}

export interface PlanSources {
  debts: PlanDebtSource[]
  installments: PlanInstallmentSource[]
  ingresoMensual: number | null
  gastosFijos: number
  ingresosExtra: { periodo: string; monto: number }[]
}

export interface PlanOptions {
  estrategia: Strategy
  presupuestoDeudas: number
  abonoExtra: number
  /** Primer mes del plan (YYYY-MM-01). */
  fechaInicio: string
  /** Período en curso: define desde qué saldo arranca un préstamo de interés fijo. */
  periodoActual: string
}

export const ESTRATEGIA_LABEL: Record<Strategy, string> = {
  avalancha: 'Avalancha',
  bola_nieve: 'Bola de nieve',
  cuotas_fijas: 'Cuotas fijas',
}

/** Saldo con el que arranca cada deuda: el último conocido al cierre del mes anterior al plan. */
function saldoInicial(d: PlanDebtSource, opts: PlanOptions): number {
  if (d.interes_modo !== 'monto_original') return d.saldo_actual
  // Interés fijo: si el plan arranca el mes siguiente, ya se cuenta el cargo de este mes.
  if (opts.fechaInicio > opts.periodoActual && d.saldo_para_cancelar != null) return d.saldo_para_cancelar
  return d.saldo_actual + (d.interes_devengado ?? 0)
}

/** Convierte las deudas activas de la BD en la entrada del motor de proyección. */
export function buildPlanInput(src: PlanSources, opts: PlanOptions): PlanInput {
  const debts = src.debts
    .filter((d) => d.estado === 'activa')
    .map<DebtInput>((d) => {
      const fijo =
        d.interes_modo === 'monto_original' && d.monto_original != null && d.tasa_anual != null
          ? flatMonthlyCharge({ montoOriginal: d.monto_original, tasaAnual: d.tasa_anual })
          : null
      return {
        id: d.debt_id,
        nombre: d.nombre,
        tipo: d.tipo,
        saldo: saldoInicial(d, opts),
        tasaAnual: d.tasa_anual,
        cuotaMensual: d.pago_unico ? 0 : (d.cuota_mensual ?? 0),
        seguroMensual: d.seguro_mensual,
        saldoCancelacion: d.saldo_cancelacion,
        interesFijoMensual: fijo,
        vencimiento: d.pago_unico && d.fecha_vencimiento ? normalizePeriod(d.fecha_vencimiento) : null,
        installments: src.installments
          .filter((i) => i.debt_id === d.debt_id && i.activa && i.cuotas_cobradas < i.cuotas_totales)
          .map((i) => ({
            descripcion: i.descripcion,
            montoCuota: i.monto_cuota,
            cuotasRestantes: i.cuotas_totales - i.cuotas_cobradas,
            capitalPendiente: i.capital_pendiente,
            cargoExtraPorCuota: i.cargo_extra_por_cuota,
          })),
      }
    })

  const ingresosExtra: Record<string, number> = {}
  for (const x of src.ingresosExtra) {
    const p = normalizePeriod(x.periodo)
    ingresosExtra[p] = Math.round(((ingresosExtra[p] ?? 0) + x.monto) * 100) / 100
  }

  return {
    debts,
    estrategia: opts.estrategia,
    presupuestoDeudas: opts.presupuestoDeudas,
    abonoExtra: opts.abonoExtra,
    fechaInicio: normalizePeriod(opts.fechaInicio),
    ingresoMensual: src.ingresoMensual ?? undefined,
    gastosFijos: src.gastosFijos,
    ingresosExtra,
  }
}

/** Presupuesto sugerido: el del plan activo o, si no hay, la suma de cuotas de las deudas activas. */
export function suggestedBudget(debts: PlanDebtSource[], activo: number | null | undefined): number {
  if (activo != null && activo > 0) return activo
  const cents = debts
    .filter((d) => d.estado === 'activa' && !d.pago_unico)
    .reduce((acc, d) => acc + Math.round((d.cuota_mensual ?? 0) * 100), 0)
  return cents / 100
}

export function defaultPlanName(estrategia: Strategy, fechaInicio: string): string {
  return `Plan ${ESTRATEGIA_LABEL[estrategia].toLowerCase()} · ${formatPeriod(fechaInicio)}`
}

/** Payload de la RPC `save_plan`. */
export interface SavePlanPayload {
  nombre: string
  estrategia: Strategy
  presupuesto_deudas: number
  abono_extra: number
  fecha_inicio: string
  activo: boolean
  supuestos: PlanSupuestos
  rows: (Omit<PlanRowPayload, 'debt'> & { debt_id: string | null })[]
}

export function buildSavePlanPayload(
  input: PlanInput,
  result: PlanResult,
  meta: { nombre: string; activo: boolean; periodoActual: string },
): SavePlanPayload {
  const supuestos = planSupuestos(
    input.debts.map((d) => ({
      key: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      tasa_anual: d.tasaAnual,
      cuota_mensual: d.cuotaMensual,
      seguro_mensual: d.seguroMensual,
      saldo_base: d.saldo,
      fecha_base: input.fechaInicio,
    })),
    result,
  )
  supuestos.supuestos.unshift(
    `Saldos iniciales: último saldo registrado de cada deuda al ${formatPeriod(meta.periodoActual)}.`,
  )
  return {
    nombre: meta.nombre.trim(),
    estrategia: input.estrategia,
    presupuesto_deudas: input.presupuestoDeudas,
    abono_extra: input.abonoExtra ?? 0,
    fecha_inicio: input.fechaInicio,
    activo: meta.activo,
    supuestos,
    rows: planRows(result).map(({ debt, ...r }) => ({ ...r, debt_id: debt })),
  }
}

/** Primer mes por defecto de un plan nuevo: el siguiente al período en curso. */
export const defaultPlanStart = (periodoActual: string) => addMonths(periodoActual, 1)
