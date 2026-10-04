export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      budget_items: {
        Row: {
          activo: boolean
          concepto: string
          created_at: string
          id: string
          monto: number
          orden: number
          user_id: string
        }
        Insert: {
          activo?: boolean
          concepto: string
          created_at?: string
          id?: string
          monto: number
          orden?: number
          user_id?: string
        }
        Update: {
          activo?: boolean
          concepto?: string
          created_at?: string
          id?: string
          monto?: number
          orden?: number
          user_id?: string
        }
        Relationships: []
      }
      debt_installments: {
        Row: {
          activa: boolean
          capital_pendiente: number | null
          cargo_extra_por_cuota: number
          created_at: string
          cuotas_cobradas: number
          cuotas_totales: number
          debt_id: string
          descripcion: string
          id: string
          monto_cuota: number
          user_id: string
        }
        Insert: {
          activa?: boolean
          capital_pendiente?: number | null
          cargo_extra_por_cuota?: number
          created_at?: string
          cuotas_cobradas?: number
          cuotas_totales: number
          debt_id: string
          descripcion: string
          id?: string
          monto_cuota: number
          user_id?: string
        }
        Update: {
          activa?: boolean
          capital_pendiente?: number | null
          cargo_extra_por_cuota?: number
          created_at?: string
          cuotas_cobradas?: number
          cuotas_totales?: number
          debt_id?: string
          descripcion?: string
          id?: string
          monto_cuota?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'debt_installments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'debts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'debt_installments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_debt_status'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'debt_installments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_monthly_balances'
            referencedColumns: ['debt_id']
          },
        ]
      }
      debts: {
        Row: {
          activa: boolean
          cerrada_en: string | null
          created_at: string
          cuota_actual: number | null
          cuota_mensual: number | null
          cuotas_totales: number | null
          dia_corte: number | null
          dia_pago: number | null
          entidad: string | null
          fecha_base: string
          fecha_vencimiento: string | null
          id: string
          interes_modo: string
          limite_credito: number | null
          monto_original: number | null
          nombre: string
          notas: string | null
          pago_unico: boolean
          prioridad: number | null
          saldo_base: number
          saldo_cancelacion: number | null
          saldo_cancelacion_fecha: string | null
          seguro_mensual: number | null
          tasa_anual: number | null
          tasa_efectiva_anual: number | null
          tipo: Database['public']['Enums']['debt_type']
          user_id: string
        }
        Insert: {
          activa?: boolean
          cerrada_en?: string | null
          created_at?: string
          cuota_actual?: number | null
          cuota_mensual?: number | null
          cuotas_totales?: number | null
          dia_corte?: number | null
          dia_pago?: number | null
          entidad?: string | null
          fecha_base: string
          fecha_vencimiento?: string | null
          id?: string
          interes_modo?: string
          limite_credito?: number | null
          monto_original?: number | null
          nombre: string
          notas?: string | null
          pago_unico?: boolean
          prioridad?: number | null
          saldo_base: number
          saldo_cancelacion?: number | null
          saldo_cancelacion_fecha?: string | null
          seguro_mensual?: number | null
          tasa_anual?: number | null
          tasa_efectiva_anual?: number | null
          tipo: Database['public']['Enums']['debt_type']
          user_id?: string
        }
        Update: {
          activa?: boolean
          cerrada_en?: string | null
          created_at?: string
          cuota_actual?: number | null
          cuota_mensual?: number | null
          cuotas_totales?: number | null
          dia_corte?: number | null
          dia_pago?: number | null
          entidad?: string | null
          fecha_base?: string
          fecha_vencimiento?: string | null
          id?: string
          interes_modo?: string
          limite_credito?: number | null
          monto_original?: number | null
          nombre?: string
          notas?: string | null
          pago_unico?: boolean
          prioridad?: number | null
          saldo_base?: number
          saldo_cancelacion?: number | null
          saldo_cancelacion_fecha?: string | null
          seguro_mensual?: number | null
          tasa_anual?: number | null
          tasa_efectiva_anual?: number | null
          tipo?: Database['public']['Enums']['debt_type']
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categoria: string
          created_at: string
          debt_id: string | null
          descripcion: string
          fecha: string
          id: string
          metodo: Database['public']['Enums']['payment_method']
          monto: number
          periodo: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          debt_id?: string | null
          descripcion: string
          fecha: string
          id?: string
          metodo: Database['public']['Enums']['payment_method']
          monto: number
          periodo: string
          user_id?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          debt_id?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          metodo?: Database['public']['Enums']['payment_method']
          monto?: number
          periodo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'debts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_debt_status'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'expenses_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_monthly_balances'
            referencedColumns: ['debt_id']
          },
        ]
      }
      extra_incomes: {
        Row: {
          concepto: string
          created_at: string
          id: string
          monto: number
          periodo: string
          user_id: string
        }
        Insert: {
          concepto: string
          created_at?: string
          id?: string
          monto: number
          periodo: string
          user_id?: string
        }
        Update: {
          concepto?: string
          created_at?: string
          id?: string
          monto?: number
          periodo?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          cuotas_fuera_saldo: number
          debt_id: string
          id: string
          origen: Database['public']['Enums']['snapshot_origin']
          periodo: string
          saldo: number
          user_id: string
        }
        Insert: {
          cuotas_fuera_saldo?: number
          debt_id: string
          id?: string
          origen: Database['public']['Enums']['snapshot_origin']
          periodo: string
          saldo: number
          user_id?: string
        }
        Update: {
          cuotas_fuera_saldo?: number
          debt_id?: string
          id?: string
          origen?: Database['public']['Enums']['snapshot_origin']
          periodo?: string
          saldo?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monthly_snapshots_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'debts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'monthly_snapshots_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_debt_status'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'monthly_snapshots_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_monthly_balances'
            referencedColumns: ['debt_id']
          },
        ]
      }
      payments: {
        Row: {
          capital: number | null
          cargos: number | null
          created_at: string
          debt_id: string
          es_estimado: boolean
          fecha: string
          fuente: string | null
          id: string
          interes: number | null
          notas: string | null
          pago_total: number
          periodo: string
          saldo_despues: number
          user_id: string
        }
        Insert: {
          capital?: number | null
          cargos?: number | null
          created_at?: string
          debt_id: string
          es_estimado?: boolean
          fecha: string
          fuente?: string | null
          id?: string
          interes?: number | null
          notas?: string | null
          pago_total: number
          periodo: string
          saldo_despues: number
          user_id?: string
        }
        Update: {
          capital?: number | null
          cargos?: number | null
          created_at?: string
          debt_id?: string
          es_estimado?: boolean
          fecha?: string
          fuente?: string | null
          id?: string
          interes?: number | null
          notas?: string | null
          pago_total?: number
          periodo?: string
          saldo_despues?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'debts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_debt_status'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'payments_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_monthly_balances'
            referencedColumns: ['debt_id']
          },
        ]
      }
      plan_rows: {
        Row: {
          debt_id: string | null
          id: string
          interes_cargos: number | null
          pago: number | null
          periodo: string
          plan_id: string
          saldo: number | null
          user_id: string
        }
        Insert: {
          debt_id?: string | null
          id?: string
          interes_cargos?: number | null
          pago?: number | null
          periodo: string
          plan_id: string
          saldo?: number | null
          user_id?: string
        }
        Update: {
          debt_id?: string | null
          id?: string
          interes_cargos?: number | null
          pago?: number | null
          periodo?: string
          plan_id?: string
          saldo?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_rows_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'debts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_rows_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_debt_status'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'plan_rows_debt_id_fkey'
            columns: ['debt_id']
            isOneToOne: false
            referencedRelation: 'v_monthly_balances'
            referencedColumns: ['debt_id']
          },
          {
            foreignKeyName: 'plan_rows_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          abono_extra: number
          activo: boolean
          created_at: string
          estrategia: Database['public']['Enums']['plan_strategy']
          fecha_inicio: string
          id: string
          nombre: string
          presupuesto_deudas: number
          supuestos: Json | null
          user_id: string
        }
        Insert: {
          abono_extra?: number
          activo?: boolean
          created_at?: string
          estrategia: Database['public']['Enums']['plan_strategy']
          fecha_inicio: string
          id?: string
          nombre: string
          presupuesto_deudas: number
          supuestos?: Json | null
          user_id?: string
        }
        Update: {
          abono_extra?: number
          activo?: boolean
          created_at?: string
          estrategia?: Database['public']['Enums']['plan_strategy']
          fecha_inicio?: string
          id?: string
          nombre?: string
          presupuesto_deudas?: number
          supuestos?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          ingreso_mensual: number | null
          moneda: string
          nombre: string | null
        }
        Insert: {
          created_at?: string
          id: string
          ingreso_mensual?: number | null
          moneda?: string
          nombre?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingreso_mensual?: number | null
          moneda?: string
          nombre?: string | null
        }
        Relationships: []
      }
      receivables: {
        Row: {
          created_at: string
          id: string
          monto: number
          notas: string | null
          persona: string
          saldo: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto: number
          notas?: string | null
          persona: string
          saldo: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          monto?: number
          notas?: string | null
          persona?: string
          saldo?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_debt_status: {
        Row: {
          activa: boolean | null
          capital_acumulado: number | null
          cerrada_en: string | null
          cuota_mensual: number | null
          cuotas_fuera_saldo: number | null
          debt_id: string | null
          deuda_real: number | null
          dia_corte: number | null
          dia_pago: number | null
          entidad: string | null
          estado: string | null
          fecha_base: string | null
          fecha_vencimiento: string | null
          interes_acumulado: number | null
          interes_devengado: number | null
          interes_modo: string | null
          limite_credito: number | null
          monto_original: number | null
          nombre: string | null
          notas: string | null
          pagado_acumulado: number | null
          pago_unico: boolean | null
          prioridad: number | null
          saldo_actual: number | null
          saldo_base: number | null
          saldo_cancelacion: number | null
          saldo_cancelacion_fecha: string | null
          saldo_para_cancelar: number | null
          seguro_mensual: number | null
          tasa_anual: number | null
          tipo: Database['public']['Enums']['debt_type'] | null
          ultimo_pago: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_monthly_balances: {
        Row: {
          cuotas_fuera_saldo: number | null
          debt_id: string | null
          es_registrado: boolean | null
          nombre: string | null
          origen: Database['public']['Enums']['snapshot_origin'] | null
          periodo: string | null
          saldo: number | null
          total_real: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_monthly_totals: {
        Row: {
          capital: number | null
          compras_tarjeta: number | null
          cuotas_fuera_saldo: number | null
          flujo_libre: number | null
          gastos_fijos: number | null
          gastos_total: number | null
          ingreso_mensual: number | null
          ingresos_extra: number | null
          interes_cargos: number | null
          pagos: number | null
          periodo: string | null
          saldo_total: number | null
          total_real: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_user_periods: {
        Row: {
          periodo: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_period: { Args: never; Returns: string }
      debt_fuera_saldo: { Args: { p_debt_id: string }; Returns: number }
      flat_balance_at: {
        Args: { p_debt_id: string; p_periodo: string }
        Returns: number
      }
      import_initial_data: { Args: { payload: Json }; Returns: Json }
      refresh_snapshot: {
        Args: { p_debt_id: string; p_periodo: string }
        Returns: undefined
      }
      reset_my_data: { Args: never; Returns: undefined }
    }
    Enums: {
      debt_type: 'tarjeta' | 'prestamo'
      payment_method: 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'
      plan_strategy: 'avalancha' | 'bola_nieve' | 'cuotas_fijas'
      snapshot_origin: 'historial' | 'registro' | 'manual'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      debt_type: ['tarjeta', 'prestamo'],
      payment_method: ['efectivo', 'debito', 'tarjeta', 'transferencia'],
      plan_strategy: ['avalancha', 'bola_nieve', 'cuotas_fijas'],
      snapshot_origin: ['historial', 'registro', 'manual'],
    },
  },
} as const
