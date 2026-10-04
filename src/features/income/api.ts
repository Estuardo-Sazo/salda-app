import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { num, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

export type ExtraIncome = Tables<'extra_incomes'>
export type ExtraIncomeValues = Omit<TablesInsert<'extra_incomes'>, 'id' | 'user_id' | 'created_at'>

export const extraIncomeKeys = { all: ['extra_incomes'] as const }

export function useExtraIncomes() {
  return useQuery({
    queryKey: extraIncomeKeys.all,
    queryFn: async () =>
      unwrap(await supabase.from('extra_incomes').select('*').order('periodo', { ascending: false })).map((x) => ({
        ...x,
        monto: num(x.monto),
      })),
  })
}

export function useSaveExtraIncome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExtraIncomeValues }) =>
      id
        ? unwrap(await supabase.from('extra_incomes').update(values).eq('id', id))
        : unwrap(await supabase.from('extra_incomes').insert(values)),
    // Cambia el flujo libre (v_monthly_totals) y la cobertura de pagos únicos.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteExtraIncome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('extra_incomes').delete().eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
