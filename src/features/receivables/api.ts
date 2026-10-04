import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { num, numOrNull, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

export type ReceivablePayment = Omit<Tables<'receivable_payments'>, 'monto'> & { monto: number }
export type Receivable = Omit<Tables<'receivables'>, 'monto' | 'tasa_mensual'> & {
  monto: number
  tasa_mensual: number | null
  cobros: ReceivablePayment[]
}
export type ReceivableValues = Omit<TablesInsert<'receivables'>, 'id' | 'user_id' | 'created_at'>
export type ReceivablePaymentValues = Omit<TablesInsert<'receivable_payments'>, 'id' | 'user_id' | 'created_at'>

export const receivableKeys = { all: ['receivables'] as const }

/** Préstamos a terceros con sus cobros (abonos), del más reciente al más antiguo. */
export function useReceivables() {
  return useQuery({
    queryKey: receivableKeys.all,
    queryFn: async (): Promise<Receivable[]> =>
      unwrap(
        await supabase
          .from('receivables')
          .select('*, receivable_payments(*)')
          .order('fecha_prestamo', { ascending: false })
          .order('created_at', { ascending: false }),
      ).map(({ receivable_payments, ...r }) => ({
        ...r,
        monto: num(r.monto),
        tasa_mensual: numOrNull(r.tasa_mensual),
        cobros: receivable_payments
          .map((c) => ({ ...c, monto: num(c.monto) }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at)),
      })),
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: receivableKeys.all })
}

export function useSaveReceivable() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ReceivableValues }) =>
      id
        ? unwrap(await supabase.from('receivables').update(values).eq('id', id))
        : unwrap(await supabase.from('receivables').insert(values)),
    onSuccess,
  })
}

export function useDeleteReceivable() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('receivables').delete().eq('id', id)),
    onSuccess,
  })
}

export function useAddReceivablePayment() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: async (values: ReceivablePaymentValues) =>
      unwrap(await supabase.from('receivable_payments').insert(values)),
    onSuccess,
  })
}

export function useDeleteReceivablePayment() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('receivable_payments').delete().eq('id', id)),
    onSuccess,
  })
}
