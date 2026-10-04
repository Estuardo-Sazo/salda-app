import type { Strategy } from '@/lib/finance'
import type { BackupDebt, BackupInstallment, RestorePayload } from '@/features/data/backup'
import { initialPlan } from '@/features/data/initial-plan'

export interface WizardDebt {
  key: string
  nombre: string
  entidad: string | null
  tipo: 'tarjeta' | 'prestamo'
  saldo: number
  tasa_anual: number | null
  cuota_mensual: number | null
  seguro_mensual: number | null
  dia_pago: number | null
  dia_corte: number | null
  limite_credito: number | null
  cuotas_totales: number | null
  cuota_actual: number | null
}

export interface WizardInstallment {
  debt: string
  descripcion: string
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
}

export interface WizardState {
  nombre: string
  ingreso: number | null
  gastosFijos: { concepto: string; monto: number }[]
  deudas: WizardDebt[]
  cuotas: WizardInstallment[]
}

/** Convierte lo capturado en el asistente en el payload de importación, con el plan inicial activo. */
export function buildWizardPayload(
  w: WizardState,
  plan: { estrategia: Strategy; presupuestoDeudas: number },
  hoy: string,
  periodoActual: string,
): RestorePayload {
  const debts = w.deudas.map<BackupDebt>((d, i) => ({
    key: d.key,
    nombre: d.nombre.trim(),
    entidad: d.entidad,
    tipo: d.tipo,
    tasa_anual: d.tasa_anual,
    tasa_efectiva_anual: null,
    cuota_mensual: d.cuota_mensual,
    seguro_mensual: d.tipo === 'tarjeta' ? d.seguro_mensual : null,
    dia_corte: d.tipo === 'tarjeta' ? d.dia_corte : null,
    dia_pago: d.dia_pago,
    limite_credito: d.tipo === 'tarjeta' ? d.limite_credito : null,
    saldo_base: d.saldo,
    fecha_base: hoy,
    saldo_cancelacion: null,
    saldo_cancelacion_fecha: null,
    cuotas_totales: d.tipo === 'prestamo' ? d.cuotas_totales : null,
    cuota_actual: d.tipo === 'prestamo' ? d.cuota_actual : null,
    fecha_vencimiento: null,
    prioridad: i + 1,
    activa: true,
    cerrada_en: null,
    notas: null,
    interes_modo: 'saldo',
    monto_original: null,
    pago_unico: false,
  }))
  const keys = new Set(debts.map((d) => d.key))
  const installments = w.cuotas
    .filter((c) => keys.has(c.debt))
    .map<BackupInstallment>((c) => ({
      ...c,
      capital_pendiente: null,
      cargo_extra_por_cuota: 0,
      activa: true,
    }))

  const payload: RestorePayload = {
    profile: { nombre: w.nombre.trim() || null, ingreso_mensual: w.ingreso, moneda: 'GTQ' },
    budget_items: w.gastosFijos.map((g, i) => ({
      concepto: g.concepto.trim(),
      monto: g.monto,
      activo: true,
      orden: i,
    })),
    debts,
    debt_installments: installments,
    // El saldo de hoy es el saldo del mes en curso: así el dashboard lo muestra desde el primer día.
    snapshots: debts.map((d) => ({
      debt: d.key,
      periodo: periodoActual,
      saldo: d.saldo_base,
      cuotas_fuera_saldo: installments
        .filter((i) => i.debt === d.key)
        .reduce((acc, i) => Math.round((acc + i.monto_cuota * (i.cuotas_totales - i.cuotas_cobradas)) * 100) / 100, 0),
      origen: 'historial',
    })),
    payments: [],
    expenses: [],
    extra_incomes: [],
    receivables: [],
    plans: [],
  }
  return {
    ...payload,
    plans: plan.presupuestoDeudas > 0 ? [initialPlan(payload, { ...plan, periodoActual })] : [],
  }
}

/** Libre para deudas cada mes: ingreso − gastos fijos (null si no hay ingreso). */
export function monthlyRoom(w: Pick<WizardState, 'ingreso' | 'gastosFijos'>): number | null {
  if (w.ingreso == null) return null
  return Math.round((w.ingreso - w.gastosFijos.reduce((a, g) => a + g.monto, 0)) * 100) / 100
}

export const sumCuotas = (deudas: WizardDebt[]) =>
  Math.round(deudas.reduce((a, d) => a + (d.cuota_mensual ?? 0), 0) * 100) / 100
