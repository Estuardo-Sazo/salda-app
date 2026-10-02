import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { normalizePayment, type Payment } from '@/features/debts/api'
import { supabase, unwrap } from '@/lib/supabase/client'
import type { TablesInsert } from '@/lib/supabase/database.types'

export type PaymentValues = Omit<TablesInsert<'payments'>, 'id' | 'user_id' | 'created_at' | 'capital'>

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: ['payments', id ?? ''],
    enabled: Boolean(id),
    queryFn: async () => normalizePayment(unwrap(await supabase.from('payments').select('*').eq('id', id!).single())),
  })
}

/** Fuentes usadas antes (para sugerirlas en el formulario). */
export function usePaymentSources() {
  return useQuery({
    queryKey: ['payments', 'fuentes'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('payments').select('fuente').not('fuente', 'is', null).limit(200))
      return [...new Set(rows.map((r) => r.fuente).filter((f): f is string => Boolean(f)))].sort()
    },
  })
}

export function useSavePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PaymentValues }): Promise<Payment> =>
      normalizePayment(
        id
          ? unwrap(await supabase.from('payments').update(values).eq('id', id).select().single())
          : unwrap(await supabase.from('payments').insert(values).select().single()),
      ),
    // El trigger ya actualizó el snapshot del mes: refrescamos todo (dashboard, deudas, vistas).
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('payments').delete().eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
