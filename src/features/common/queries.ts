import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentPeriod } from '@/lib/format'
import type { ImportPayload, PlanSupuestos } from '@/lib/seed/build-payload'
import { num, numOrNull, supabase } from '@/lib/supabase/client'
import type { Json, Tables, Views } from '@/lib/supabase/database.types'

export const qk = {
  profile: ['profile'] as const,
  debtStatus: ['v_debt_status'] as const,
  monthlyTotals: ['v_monthly_totals'] as const,
  monthlyBalances: ['v_monthly_balances'] as const,
  activePlan: ['plan', 'active'] as const,
  periodPayments: (periodo: string) => ['payments', 'periodo', periodo] as const,
}

type Result = { data: unknown; error: { message: string } | null }

/** Devuelve los datos o lanza el error de PostgREST. */
function unwrap<R extends Result>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R['data']>
}

/** Igual que unwrap, pero permite null (consultas con maybeSingle). */
function unwrapMaybe<R extends Result>(res: R): R['data'] {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export type DebtStatus = Views<'v_debt_status'>
export type MonthlyTotals = Views<'v_monthly_totals'>
export type MonthlyBalance = Views<'v_monthly_balances'>

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async () => {
      const row = unwrapMaybe(await supabase.from('profiles').select('*').maybeSingle())
      return row ? { ...row, ingreso_mensual: numOrNull(row.ingreso_mensual) } : null
    },
  })
}

export function useDebtStatus() {
  return useQuery({
    queryKey: qk.debtStatus,
    queryFn: async (): Promise<DebtStatus[]> => {
      const rows = unwrap(
        await supabase
          .from('v_debt_status')
          .select('*')
          .order('prioridad', { ascending: true, nullsFirst: false })
          .order('nombre'),
      )
      return rows.map((r) => ({
        ...r,
        tasa_anual: numOrNull(r.tasa_anual),
        cuota_mensual: numOrNull(r.cuota_mensual),
        seguro_mensual: numOrNull(r.seguro_mensual),
        limite_credito: numOrNull(r.limite_credito),
        saldo_cancelacion: numOrNull(r.saldo_cancelacion),
        saldo_base: num(r.saldo_base),
        saldo_actual: num(r.saldo_actual),
        cuotas_fuera_saldo: num(r.cuotas_fuera_saldo),
        deuda_real: num(r.deuda_real),
        interes_acumulado: num(r.interes_acumulado),
        capital_acumulado: num(r.capital_acumulado),
        pagado_acumulado: num(r.pagado_acumulado),
      }))
    },
  })
}

export function useMonthlyTotals() {
  return useQuery({
    queryKey: qk.monthlyTotals,
    queryFn: async (): Promise<MonthlyTotals[]> => {
      const rows = unwrap(await supabase.from('v_monthly_totals').select('*').order('periodo'))
      return rows.map((r) => ({
        ...r,
        saldo_total: num(r.saldo_total),
        cuotas_fuera_saldo: num(r.cuotas_fuera_saldo),
        total_real: num(r.total_real),
        pagos: num(r.pagos),
        interes_cargos: num(r.interes_cargos),
        capital: num(r.capital),
        compras_tarjeta: num(r.compras_tarjeta),
        gastos_total: num(r.gastos_total),
        ingreso_mensual: numOrNull(r.ingreso_mensual),
        gastos_fijos: num(r.gastos_fijos),
        flujo_libre: num(r.flujo_libre),
      }))
    },
  })
}

export function useMonthlyBalances() {
  return useQuery({
    queryKey: qk.monthlyBalances,
    queryFn: async (): Promise<MonthlyBalance[]> => {
      const rows = unwrap(await supabase.from('v_monthly_balances').select('*').order('periodo'))
      return rows.map((r) => ({
        ...r,
        saldo: num(r.saldo),
        cuotas_fuera_saldo: num(r.cuotas_fuera_saldo),
        total_real: num(r.total_real),
      }))
    },
  })
}

export interface ActivePlan {
  plan: Omit<Tables<'plans'>, 'supuestos'> & { supuestos: PlanSupuestos | null }
  /** Fila de totales por período (debt_id null). */
  totals: { periodo: string; saldo: number; pago: number; interes_cargos: number }[]
}

export function useActivePlan() {
  return useQuery({
    queryKey: qk.activePlan,
    queryFn: async (): Promise<ActivePlan | null> => {
      const plan = unwrapMaybe(await supabase.from('plans').select('*').eq('activo', true).maybeSingle())
      if (!plan) return null
      const rows = unwrap(
        await supabase
          .from('plan_rows')
          .select('periodo, saldo, pago, interes_cargos')
          .eq('plan_id', plan.id)
          .is('debt_id', null)
          .order('periodo'),
      )
      return {
        plan: {
          ...plan,
          presupuesto_deudas: num(plan.presupuesto_deudas),
          abono_extra: num(plan.abono_extra),
          supuestos: plan.supuestos as unknown as PlanSupuestos | null,
        },
        totals: rows.map((r) => ({
          periodo: r.periodo,
          saldo: num(r.saldo),
          pago: num(r.pago),
          interes_cargos: num(r.interes_cargos),
        })),
      }
    },
  })
}

/** Pagos registrados en un período (para el estado pagado/pendiente de los próximos pagos). */
export function usePeriodPayments(periodo: string = currentPeriod()) {
  return useQuery({
    queryKey: qk.periodPayments(periodo),
    queryFn: async () =>
      unwrap(await supabase.from('payments').select('id, debt_id, fecha, pago_total').eq('periodo', periodo)),
  })
}

export function useImportData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ImportPayload) =>
      unwrap(await supabase.rpc('import_initial_data', { payload: payload as unknown as Json })),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useResetData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(await supabase.rpc('reset_my_data'))
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
