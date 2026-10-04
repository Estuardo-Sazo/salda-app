import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { num, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

export type Expense = Tables<'expenses'>
export type ExpenseValues = Omit<TablesInsert<'expenses'>, 'id' | 'user_id' | 'created_at'>

export const expenseKeys = {
  period: (periodo: string) => ['expenses', 'periodo', periodo] as const,
  detail: (id: string) => ['expenses', id] as const,
  debt: (debtId: string) => ['expenses', 'debt', debtId] as const,
  descriptions: ['expenses', 'descripciones'] as const,
}

const normalize = (e: Expense): Expense => ({ ...e, monto: num(e.monto) })

export function usePeriodExpenses(periodo: string) {
  return useQuery({
    queryKey: expenseKeys.period(periodo),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('expenses')
          .select('*')
          .eq('periodo', periodo)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
      ).map(normalize),
  })
}

/** Compras hechas con una tarjeta (las más recientes primero). */
export function useDebtExpenses(debtId: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.debt(debtId ?? ''),
    enabled: Boolean(debtId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('expenses')
          .select('*')
          .eq('debt_id', debtId!)
          .order('fecha', { ascending: false })
          .limit(50),
      ).map(normalize),
  })
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => normalize(unwrap(await supabase.from('expenses').select('*').eq('id', id!).single())),
  })
}

/** Descripciones usadas antes, la más frecuente primero (para autocompletar). */
export function useExpenseDescriptions() {
  return useQuery({
    queryKey: expenseKeys.descriptions,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('expenses')
          .select('descripcion, categoria')
          .order('fecha', { ascending: false })
          .limit(300),
      )
      const counts = new Map<string, { n: number; categoria: string }>()
      for (const r of rows) {
        const prev = counts.get(r.descripcion)
        counts.set(r.descripcion, { n: (prev?.n ?? 0) + 1, categoria: prev?.categoria ?? r.categoria })
      }
      return [...counts.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .map(([descripcion, { categoria }]) => ({ descripcion, categoria }))
    },
  })
}

export function useSaveExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExpenseValues }) =>
      normalize(
        id
          ? unwrap(await supabase.from('expenses').update(values).eq('id', id).select().single())
          : unwrap(await supabase.from('expenses').insert(values).select().single()),
      ),
    // Las compras con tarjeta cambian v_monthly_totals (alerta del dashboard): se refresca todo.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('expenses').delete().eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
