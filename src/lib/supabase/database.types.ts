// Tipos de la BD escritos a mano a partir de supabase/migrations.
// Cuando el proyecto esté enlazado, regenera este archivo con `npm run db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type DebtType = 'tarjeta' | 'prestamo'
type PaymentMethod = 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'
type SnapshotOrigin = 'historial' | 'registro' | 'manual'
type PlanStrategy = 'avalancha' | 'bola_nieve' | 'cuotas_fijas'

type Table<Row, Required extends keyof Row, Generated extends keyof Row = never> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>
  Update: Partial<Omit<Row, Generated>>
  Relationships: []
}

type ProfileRow = {
  id: string
  nombre: string | null
  ingreso_mensual: number | null
  moneda: string
  created_at: string
}

type BudgetItemRow = {
  id: string
  user_id: string
  concepto: string
  monto: number
  activo: boolean
  orden: number
  created_at: string
}

type DebtRow = {
  id: string
  user_id: string
  nombre: string
  entidad: string | null
  tipo: DebtType
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
  created_at: string
}

type DebtInstallmentRow = {
  id: string
  user_id: string
  debt_id: string
  descripcion: string
  monto_cuota: number
  cuotas_totales: number
  cuotas_cobradas: number
  capital_pendiente: number | null
  cargo_extra_por_cuota: number
  activa: boolean
  created_at: string
}

type PaymentRow = {
  id: string
  user_id: string
  debt_id: string
  fecha: string
  periodo: string
  pago_total: number
  interes: number | null
  cargos: number | null
  capital: number | null
  saldo_despues: number
  es_estimado: boolean
  fuente: string | null
  notas: string | null
  created_at: string
}

type ExpenseRow = {
  id: string
  user_id: string
  fecha: string
  periodo: string
  descripcion: string
  categoria: string
  monto: number
  metodo: PaymentMethod
  debt_id: string | null
  created_at: string
}

type MonthlySnapshotRow = {
  id: string
  user_id: string
  debt_id: string
  periodo: string
  saldo: number
  cuotas_fuera_saldo: number
  origen: SnapshotOrigin
}

type PlanRow = {
  id: string
  user_id: string
  nombre: string
  estrategia: PlanStrategy
  presupuesto_deudas: number
  abono_extra: number
  fecha_inicio: string
  activo: boolean
  supuestos: Json | null
  created_at: string
}

type PlanRowRow = {
  id: string
  plan_id: string
  user_id: string
  periodo: string
  debt_id: string | null
  saldo: number | null
  pago: number | null
  interes_cargos: number | null
}

type ReceivableRow = {
  id: string
  user_id: string
  persona: string
  monto: number
  saldo: number
  notas: string | null
  created_at: string
}

type DebtStatusView = {
  debt_id: string
  user_id: string
  nombre: string
  entidad: string | null
  tipo: DebtType
  tasa_anual: number | null
  cuota_mensual: number | null
  seguro_mensual: number | null
  dia_corte: number | null
  dia_pago: number | null
  limite_credito: number | null
  saldo_base: number
  fecha_base: string
  saldo_cancelacion: number | null
  saldo_cancelacion_fecha: string | null
  prioridad: number | null
  notas: string | null
  activa: boolean
  cerrada_en: string | null
  saldo_actual: number
  cuotas_fuera_saldo: number
  deuda_real: number
  interes_acumulado: number
  capital_acumulado: number
  pagado_acumulado: number
  ultimo_pago: string | null
  estado: 'activa' | 'liquidada' | 'cerrada'
}

type MonthlyBalanceView = {
  user_id: string
  periodo: string
  debt_id: string
  nombre: string
  saldo: number
  cuotas_fuera_saldo: number
  total_real: number
  origen: SnapshotOrigin
  es_registrado: boolean
}

type MonthlyTotalsView = {
  user_id: string
  periodo: string
  saldo_total: number
  cuotas_fuera_saldo: number
  total_real: number
  pagos: number
  interes_cargos: number
  capital: number
  compras_tarjeta: number
  gastos_total: number
  ingreso_mensual: number | null
  gastos_fijos: number
  flujo_libre: number
}

type View<Row> = { Row: Row; Relationships: [] }

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id', 'created_at'>
      budget_items: Table<BudgetItemRow, 'concepto' | 'monto', 'id' | 'created_at'>
      debts: Table<DebtRow, 'nombre' | 'tipo' | 'saldo_base' | 'fecha_base', 'id' | 'created_at'>
      debt_installments: Table<
        DebtInstallmentRow,
        'debt_id' | 'descripcion' | 'monto_cuota' | 'cuotas_totales',
        'id' | 'created_at'
      >
      payments: Table<
        PaymentRow,
        'debt_id' | 'fecha' | 'periodo' | 'pago_total' | 'saldo_despues',
        'id' | 'created_at' | 'capital'
      >
      expenses: Table<
        ExpenseRow,
        'fecha' | 'periodo' | 'descripcion' | 'categoria' | 'monto' | 'metodo',
        'id' | 'created_at'
      >
      monthly_snapshots: Table<MonthlySnapshotRow, 'debt_id' | 'periodo' | 'saldo' | 'origen', 'id'>
      plans: Table<PlanRow, 'nombre' | 'estrategia' | 'presupuesto_deudas' | 'fecha_inicio', 'id' | 'created_at'>
      plan_rows: Table<PlanRowRow, 'plan_id' | 'periodo', 'id'>
      receivables: Table<ReceivableRow, 'persona' | 'monto' | 'saldo', 'id' | 'created_at'>
    }
    Views: {
      v_debt_status: View<DebtStatusView>
      v_user_periods: View<{ user_id: string; periodo: string }>
      v_monthly_balances: View<MonthlyBalanceView>
      v_monthly_totals: View<MonthlyTotalsView>
    }
    Functions: {
      import_initial_data: { Args: { payload: Json }; Returns: Json }
      reset_my_data: { Args: Record<string, never>; Returns: undefined }
      debt_fuera_saldo: { Args: { p_debt_id: string }; Returns: number }
      refresh_snapshot: { Args: { p_debt_id: string; p_periodo: string }; Returns: undefined }
      current_period: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      debt_type: DebtType
      payment_method: PaymentMethod
      snapshot_origin: SnapshotOrigin
      plan_strategy: PlanStrategy
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
