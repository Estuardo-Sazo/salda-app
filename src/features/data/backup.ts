import { z } from 'zod'
import type { Tables } from '@/lib/supabase/database.types'
import type { PlanSupuestos } from '@/lib/seed/build-payload'

/** Tablas del usuario tal como las devuelve Supabase (numeric puede venir como string). */
export interface RawTables {
  profile: Tables<'profiles'> | null
  budget_items: Tables<'budget_items'>[]
  debts: Tables<'debts'>[]
  debt_installments: Tables<'debt_installments'>[]
  monthly_snapshots: Tables<'monthly_snapshots'>[]
  payments: Tables<'payments'>[]
  expenses: Tables<'expenses'>[]
  extra_incomes: Tables<'extra_incomes'>[]
  receivables: Tables<'receivables'>[]
  plans: Tables<'plans'>[]
  plan_rows: Tables<'plan_rows'>[]
  monthly_totals: Tables<'v_monthly_totals'>[]
}

type Num = number | string | null | undefined
const n = (v: Num): number => (v == null ? 0 : Number(v))
const nn = (v: Num): number | null => (v == null ? null : Number(v))

export interface BackupDebt {
  key: string
  nombre: string
  entidad: string | null
  tipo: 'tarjeta' | 'prestamo'
  tasa_anual: number | null
  tasa_efectiva_anual: number | null
  cuota_mensual: number | null
  seguro_mensual: number | null
  dia_corte: number | null
  dia_pago: number | null
  limite_credito: number | null
  saldo_base: number
  fecha_base: string
  saldo_cancelacion: number | null
  saldo_cancelacion_fecha: string | null
  cuotas_totales: number | null
  cuota_actual: number | null
  fecha_vencimiento: string | null
  prioridad: number | null
  activa: boolean
  cerrada_en: string | null
  notas: string | null
  interes_modo: 'saldo' | 'monto_original'
  monto_original: number | null
  pago_unico: boolean
}

export interface BackupInstallment {
  debt: string
  descripcion: string
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
  capital_pendiente: number | null
  cargo_extra_por_cuota: number
  activa: boolean
}

export interface BackupSnapshot {
  debt: string
  periodo: string
  saldo: number
  cuotas_fuera_saldo: number
  origen: 'historial' | 'registro' | 'manual'
}

export interface BackupPayment {
  debt: string
  fecha: string
  periodo: string
  pago_total: number
  interes: number | null
  cargos: number | null
  saldo_despues: number
  es_estimado: boolean
  fuente: string | null
  notas: string | null
}

export interface BackupExpense {
  debt: string | null
  fecha: string
  periodo: string
  descripcion: string
  categoria: string
  monto: number
  metodo: 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'
}

export interface BackupPlan {
  nombre: string
  estrategia: 'avalancha' | 'bola_nieve' | 'cuotas_fijas'
  presupuesto_deudas: number
  abono_extra: number
  fecha_inicio: string
  activo: boolean
  supuestos: PlanSupuestos | null
  rows: { periodo: string; debt: string | null; saldo: number; pago: number; interes_cargos: number }[]
}

/** Totales que se comparan después de restaurar (criterio de aceptación de la fase 7). */
export interface BackupTotal {
  periodo: string
  saldo_total: number
  total_real: number
  pagos: number
  interes_cargos: number
  gastos_total: number
}

/** Payload de la RPC `import_initial_data` (v2). También es el formato del respaldo JSON. */
export interface RestorePayload {
  profile: { nombre: string | null; ingreso_mensual: number | null; moneda: string } | null
  budget_items: { concepto: string; monto: number; activo: boolean; orden: number }[]
  debts: BackupDebt[]
  debt_installments: BackupInstallment[]
  snapshots: BackupSnapshot[]
  payments: BackupPayment[]
  expenses: BackupExpense[]
  extra_incomes: { periodo: string; concepto: string; monto: number }[]
  receivables: { persona: string; monto: number; saldo: number; notas: string | null }[]
  plans: BackupPlan[]
}

export const BACKUP_FORMAT = 'salda-respaldo'

export interface Backup extends RestorePayload {
  formato: typeof BACKUP_FORMAT
  version: 2
  exportado_en: string
  totales: BackupTotal[]
}

/** Convierte las tablas del usuario en un respaldo autocontenido (las llaves de deuda son sus uuid). */
export function buildBackup(t: RawTables, exportadoEn: string): Backup {
  const byPlan = new Map<string, Tables<'plan_rows'>[]>()
  for (const r of t.plan_rows) byPlan.set(r.plan_id, [...(byPlan.get(r.plan_id) ?? []), r])
  const byPeriodo = <T extends { periodo: string }>(a: T, b: T) => a.periodo.localeCompare(b.periodo)

  return {
    formato: BACKUP_FORMAT,
    version: 2,
    exportado_en: exportadoEn,
    profile: t.profile
      ? { nombre: t.profile.nombre, ingreso_mensual: nn(t.profile.ingreso_mensual), moneda: t.profile.moneda ?? 'GTQ' }
      : null,
    budget_items: [...t.budget_items]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((b, i) => ({ concepto: b.concepto, monto: n(b.monto), activo: b.activo ?? true, orden: b.orden ?? i })),
    debts: [...t.debts]
      .sort((a, b) => (a.prioridad ?? 99) - (b.prioridad ?? 99) || a.nombre.localeCompare(b.nombre))
      .map((d) => ({
        key: d.id,
        nombre: d.nombre,
        entidad: d.entidad,
        tipo: d.tipo,
        tasa_anual: nn(d.tasa_anual),
        tasa_efectiva_anual: nn(d.tasa_efectiva_anual),
        cuota_mensual: nn(d.cuota_mensual),
        seguro_mensual: nn(d.seguro_mensual),
        dia_corte: d.dia_corte,
        dia_pago: d.dia_pago,
        limite_credito: nn(d.limite_credito),
        saldo_base: n(d.saldo_base),
        fecha_base: d.fecha_base,
        saldo_cancelacion: nn(d.saldo_cancelacion),
        saldo_cancelacion_fecha: d.saldo_cancelacion_fecha,
        cuotas_totales: d.cuotas_totales,
        cuota_actual: d.cuota_actual,
        fecha_vencimiento: d.fecha_vencimiento,
        prioridad: d.prioridad,
        activa: d.activa ?? true,
        cerrada_en: d.cerrada_en,
        notas: d.notas,
        interes_modo: d.interes_modo === 'monto_original' ? 'monto_original' : 'saldo',
        monto_original: nn(d.monto_original),
        pago_unico: d.pago_unico ?? false,
      })),
    debt_installments: t.debt_installments.map((i) => ({
      debt: i.debt_id,
      descripcion: i.descripcion,
      monto_cuota: n(i.monto_cuota),
      cuotas_totales: i.cuotas_totales,
      cuotas_cobradas: i.cuotas_cobradas,
      capital_pendiente: nn(i.capital_pendiente),
      cargo_extra_por_cuota: n(i.cargo_extra_por_cuota),
      activa: i.activa ?? true,
    })),
    snapshots: [...t.monthly_snapshots].sort(byPeriodo).map((s) => ({
      debt: s.debt_id,
      periodo: s.periodo,
      saldo: n(s.saldo),
      cuotas_fuera_saldo: n(s.cuotas_fuera_saldo),
      origen: s.origen,
    })),
    payments: [...t.payments]
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .map((p) => ({
        debt: p.debt_id,
        fecha: p.fecha,
        periodo: p.periodo,
        pago_total: n(p.pago_total),
        interes: nn(p.interes),
        cargos: nn(p.cargos),
        saldo_despues: n(p.saldo_despues),
        es_estimado: p.es_estimado ?? false,
        fuente: p.fuente,
        notas: p.notas,
      })),
    expenses: [...t.expenses]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((e) => ({
        debt: e.debt_id,
        fecha: e.fecha,
        periodo: e.periodo,
        descripcion: e.descripcion,
        categoria: e.categoria,
        monto: n(e.monto),
        metodo: e.metodo,
      })),
    extra_incomes: [...t.extra_incomes]
      .sort(byPeriodo)
      .map((x) => ({ periodo: x.periodo, concepto: x.concepto, monto: n(x.monto) })),
    receivables: t.receivables.map((r) => ({
      persona: r.persona,
      monto: n(r.monto),
      saldo: n(r.saldo),
      notas: r.notas,
    })),
    plans: [...t.plans]
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .map((p) => ({
        nombre: p.nombre,
        estrategia: p.estrategia,
        presupuesto_deudas: n(p.presupuesto_deudas),
        abono_extra: n(p.abono_extra),
        fecha_inicio: p.fecha_inicio,
        activo: p.activo,
        supuestos: p.supuestos as unknown as PlanSupuestos | null,
        rows: (byPlan.get(p.id) ?? []).sort(byPeriodo).map((r) => ({
          periodo: r.periodo,
          debt: r.debt_id,
          saldo: n(r.saldo),
          pago: n(r.pago),
          interes_cargos: n(r.interes_cargos),
        })),
      })),
    totales: totalsOf(t.monthly_totals),
  }
}

export function totalsOf(rows: Tables<'v_monthly_totals'>[]): BackupTotal[] {
  return rows
    .filter((r) => r.periodo != null)
    .map((r) => ({
      periodo: r.periodo!,
      saldo_total: n(r.saldo_total),
      total_real: n(r.total_real),
      pagos: n(r.pagos),
      interes_cargos: n(r.interes_cargos),
      gastos_total: n(r.gastos_total),
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

export interface TotalsMismatch {
  periodo: string
  campo: keyof Omit<BackupTotal, 'periodo'>
  esperado: number
  obtenido: number
}

/** Diferencias entre los totales del respaldo y los de la cuenta restaurada (tolerancia de 1 centavo). */
export function compareTotals(esperados: BackupTotal[], obtenidos: BackupTotal[]): TotalsMismatch[] {
  const got = new Map(obtenidos.map((t) => [t.periodo, t]))
  const campos = ['saldo_total', 'total_real', 'pagos', 'interes_cargos', 'gastos_total'] as const
  const out: TotalsMismatch[] = []
  for (const e of esperados) {
    const o = got.get(e.periodo)
    for (const campo of campos) {
      const obtenido = o?.[campo] ?? 0
      if (Math.abs(obtenido - e[campo]) > 0.005) out.push({ periodo: e.periodo, campo, esperado: e[campo], obtenido })
    }
  }
  return out
}

/* ---------------------------------------------------------------- lectura */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().finite()
const backupSchema = z
  .object({
    formato: z.literal(BACKUP_FORMAT),
    version: z.literal(2),
    exportado_en: z.string(),
    debts: z.array(
      z
        .object({
          key: z.string().min(1),
          nombre: z.string().min(1),
          tipo: z.enum(['tarjeta', 'prestamo']),
          saldo_base: money,
          fecha_base: date,
        })
        .passthrough(),
    ),
    debt_installments: z.array(z.object({ debt: z.string() }).passthrough()),
    snapshots: z.array(z.object({ debt: z.string(), periodo: date, saldo: money }).passthrough()),
    payments: z.array(
      z.object({ debt: z.string(), fecha: date, periodo: date, pago_total: money, saldo_despues: money }).passthrough(),
    ),
    expenses: z.array(z.object({ fecha: date, periodo: date, monto: money }).passthrough()),
    extra_incomes: z.array(z.object({ periodo: date, monto: money }).passthrough()),
    receivables: z.array(z.object({ persona: z.string() }).passthrough()),
    budget_items: z.array(z.object({ concepto: z.string(), monto: money }).passthrough()),
    plans: z.array(
      z.object({ nombre: z.string(), rows: z.array(z.object({ periodo: date }).passthrough()) }).passthrough(),
    ),
    totales: z.array(z.object({ periodo: date }).passthrough()),
  })
  .passthrough()

export function isBackup(json: unknown): boolean {
  return typeof json === 'object' && json != null && (json as { formato?: unknown }).formato === BACKUP_FORMAT
}

/** Valida un respaldo JSON exportado por Saldá. */
export function parseBackup(json: unknown): Backup {
  const res = backupSchema.safeParse(json)
  if (!res.success) {
    const issue = res.error.issues[0]
    throw new Error(`Respaldo inválido${issue ? ` en ${issue.path.join('.')}: ${issue.message}` : ''}`)
  }
  const data = res.data as unknown as Backup
  const keys = new Set(data.debts.map((d) => d.key))
  const refs = [
    ...data.debt_installments.map((x) => x.debt),
    ...data.snapshots.map((x) => x.debt),
    ...data.payments.map((x) => x.debt),
    ...data.expenses.flatMap((x) => (x.debt ? [x.debt] : [])),
    ...data.plans.flatMap((p) => p.rows.flatMap((r) => (r.debt ? [r.debt] : []))),
  ]
  const missing = refs.find((k) => !keys.has(k))
  if (missing) throw new Error('Respaldo inválido: hace referencia a una deuda que no existe')
  return data
}

/** Quita los metadatos del respaldo y deja solo lo que recibe la RPC. */
export function toRestorePayload(b: RestorePayload): RestorePayload {
  const {
    profile,
    budget_items,
    debts,
    debt_installments,
    snapshots,
    payments,
    expenses,
    extra_incomes,
    receivables,
    plans,
  } = b
  return {
    profile,
    budget_items,
    debts,
    debt_installments,
    snapshots,
    payments,
    expenses,
    extra_incomes,
    receivables,
    plans,
  }
}

export interface BackupSummary {
  deudas: number
  pagos: number
  gastos: number
  saldos: number
  planes: number
  desde: string | null
  hasta: string | null
}

export function summarizeRestore(b: RestorePayload): BackupSummary {
  const periodos = [...b.snapshots.map((s) => s.periodo), ...b.payments.map((p) => p.periodo)].sort()
  return {
    deudas: b.debts.length,
    pagos: b.payments.length,
    gastos: b.expenses.length,
    saldos: b.snapshots.length,
    planes: b.plans.length,
    desde: periodos[0] ?? null,
    hasta: periodos.at(-1) ?? null,
  }
}
