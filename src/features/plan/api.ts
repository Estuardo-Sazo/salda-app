import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useDebtStatus, useProfile } from '@/features/common/queries'
import { useExtraIncomes } from '@/features/income/api'
import type { PlanSupuestos } from '@/lib/seed/build-payload'
import { num, numOrNull, supabase, unwrap } from '@/lib/supabase/client'
import type { Json, Tables } from '@/lib/supabase/database.types'
import type { PlanRowSource } from './model'
import type { PlanInstallmentSource, PlanSources, SavePlanPayload } from './plan-input'

export const planKeys = {
  all: ['plans'] as const,
  rows: (planId: string) => ['plans', planId, 'rows'] as const,
  installments: ['installments', 'activas'] as const,
  budget: ['budget_items'] as const,
}

export type Plan = Omit<Tables<'plans'>, 'supuestos'> & { supuestos: PlanSupuestos | null }

/** Todos los planes del usuario, el más reciente primero. */
export function usePlans() {
  return useQuery({
    queryKey: planKeys.all,
    queryFn: async (): Promise<Plan[]> =>
      unwrap(await supabase.from('plans').select('*').order('created_at', { ascending: false })).map((p) => ({
        ...p,
        presupuesto_deudas: num(p.presupuesto_deudas),
        abono_extra: num(p.abono_extra),
        supuestos: p.supuestos as unknown as PlanSupuestos | null,
      })),
  })
}

/** Filas del plan: una por deuda y mes más la de totales (debt_id null). */
export function usePlanRows(planId: string | undefined) {
  return useQuery({
    queryKey: planKeys.rows(planId ?? ''),
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanRowSource[]> =>
      unwrap(
        await supabase
          .from('plan_rows')
          .select('periodo, debt_id, saldo, pago, interes_cargos')
          .eq('plan_id', planId!)
          .order('periodo'),
      ).map((r) => ({
        periodo: r.periodo,
        debt_id: r.debt_id,
        saldo: num(r.saldo),
        pago: num(r.pago),
        interes_cargos: num(r.interes_cargos),
      })),
  })
}

/** Cuotas fuera de saldo vigentes de todas las deudas (para proyectar). */
export function useActiveInstallments() {
  return useQuery({
    queryKey: planKeys.installments,
    queryFn: async (): Promise<PlanInstallmentSource[]> =>
      unwrap(await supabase.from('debt_installments').select('*').eq('activa', true)).map((i) => ({
        debt_id: i.debt_id,
        descripcion: i.descripcion,
        monto_cuota: num(i.monto_cuota),
        cuotas_totales: i.cuotas_totales,
        cuotas_cobradas: i.cuotas_cobradas,
        capital_pendiente: numOrNull(i.capital_pendiente),
        cargo_extra_por_cuota: num(i.cargo_extra_por_cuota),
        activa: i.activa,
      })),
  })
}

/** Suma de los gastos fijos activos. */
export function useFixedExpensesTotal() {
  return useQuery({
    queryKey: planKeys.budget,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('budget_items').select('monto').eq('activo', true))
      return rows.reduce((acc, r) => acc + Math.round(num(r.monto) * 100), 0) / 100
    },
  })
}

/** Todo lo que necesita la proyección: deudas, cuotas fuera de saldo, ingreso, gastos fijos e ingresos extra. */
export function usePlanSources(): { sources: PlanSources | null; error: Error | null } {
  const debts = useDebtStatus()
  const installments = useActiveInstallments()
  const profile = useProfile()
  const fixed = useFixedExpensesTotal()
  const extras = useExtraIncomes()

  const sources = useMemo<PlanSources | null>(() => {
    if (!debts.data || !installments.data || profile.data === undefined || fixed.data === undefined || !extras.data) {
      return null
    }
    return {
      debts: debts.data,
      installments: installments.data,
      ingresoMensual: profile.data?.ingreso_mensual ?? null,
      gastosFijos: fixed.data,
      ingresosExtra: extras.data,
    }
  }, [debts.data, installments.data, profile.data, fixed.data, extras.data])

  const error = [debts, installments, profile, fixed, extras].find((q) => q.error)?.error ?? null
  return { sources, error }
}

export function useSavePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SavePlanPayload) =>
      unwrap(await supabase.rpc('save_plan', { payload: payload as unknown as Json })),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useActivatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await supabase.rpc('activate_plan', { p_plan_id: planId })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** Corrige a mano el saldo de una deuda en un mes (origen = manual). */
export function useSaveManualSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: { debt_id: string; periodo: string; saldo: number; cuotas_fuera_saldo: number }) =>
      unwrap(
        await supabase
          .from('monthly_snapshots')
          .upsert({ ...values, origen: 'manual' }, { onConflict: 'debt_id,periodo' }),
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
