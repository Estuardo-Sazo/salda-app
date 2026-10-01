import type { DebtType, Strategy } from '@/lib/finance'

/** Formato de `seed/initial-data.json` (sección 9 del plan). */
export interface SeedDebt {
  key: string
  nombre: string
  entidad?: string | null
  tipo: DebtType
  tasa_anual: number | null
  tasa_efectiva_anual?: number | null
  cuota_mensual: number | null
  seguro_mensual?: number | null
  dia_corte?: number | null
  dia_pago?: number | null
  limite_credito?: number | null
  saldo_base: number
  fecha_base: string
  saldo_cancelacion?: number | null
  saldo_cancelacion_fecha?: string | null
  cuotas_totales?: number | null
  cuota_actual?: number | null
  fecha_vencimiento?: string | null
  activa?: boolean
  cerrada_en?: string | null
  notas?: string | null
}

export interface SeedInstallment {
  debt: string
  descripcion: string
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
  capital_pendiente?: number | null
  cargo_extra_por_cuota?: number
}

export interface SeedPayment {
  debt: string
  fecha: string
  periodo: string
  pago_total: number
  interes: number | null
  cargos: number | null
  saldo_despues: number
  es_estimado: boolean
  fuente?: string | null
  notas?: string | null
}

export interface SeedExpense {
  fecha: string
  periodo: string
  descripcion: string
  categoria: string
  monto: number
  metodo: 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'
  debt?: string | null
}

export interface SeedData {
  profile: { nombre: string; ingreso_mensual: number; moneda: string }
  budget_items: { concepto: string; monto: number }[]
  debts: SeedDebt[]
  debt_installments: SeedInstallment[]
  /** `_columnas` lista las keys de deuda; el resto son 'YYYY-MM' → saldos (null = sin dato). */
  monthly_snapshots_historial: Record<string, (number | null)[] | string[]>
  cuotas_fuera_saldo_oct_2026?: number
  payments: SeedPayment[]
  expenses: SeedExpense[]
  receivables_opcional?: { persona: string; monto: number; saldo: number }[]
  plan_inicial: {
    nombre: string
    estrategia: Strategy
    presupuesto_deudas: number
    abono_extra: number
    fecha_inicio: string
    activo: boolean
  }
}
