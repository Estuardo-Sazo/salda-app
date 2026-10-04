import { useQuery } from '@tanstack/react-query'
import { num, numOrNull, supabase, unwrap } from '@/lib/supabase/client'
import type { ExpenseRow, PaymentRow } from './model'

export const reportKeys = {
  payments: (desde: string, hasta: string) => ['payments', 'rango', desde, hasta] as const,
  expenses: (desde: string, hasta: string) => ['expenses', 'rango', desde, hasta] as const,
}

/** Pagos con período entre `desde` y `hasta` (inclusive). */
export function usePaymentsRange(desde: string | null, hasta: string | null) {
  return useQuery({
    queryKey: reportKeys.payments(desde ?? '', hasta ?? ''),
    enabled: Boolean(desde && hasta),
    queryFn: async (): Promise<PaymentRow[]> =>
      unwrap(
        await supabase
          .from('payments')
          .select('id, debt_id, fecha, periodo, pago_total, interes, cargos, capital, saldo_despues, es_estimado')
          .gte('periodo', desde!)
          .lte('periodo', hasta!)
          .order('fecha'),
      ).map((p) => ({
        ...p,
        pago_total: num(p.pago_total),
        interes: numOrNull(p.interes),
        cargos: numOrNull(p.cargos),
        capital: numOrNull(p.capital),
        saldo_despues: num(p.saldo_despues),
        es_estimado: p.es_estimado ?? false,
      })),
  })
}

/** Gastos con período entre `desde` y `hasta` (inclusive). */
export function useExpensesRange(desde: string | null, hasta: string | null) {
  return useQuery({
    queryKey: reportKeys.expenses(desde ?? '', hasta ?? ''),
    enabled: Boolean(desde && hasta),
    queryFn: async (): Promise<ExpenseRow[]> =>
      unwrap(
        await supabase
          .from('expenses')
          .select('id, fecha, periodo, descripcion, categoria, monto, metodo, debt_id')
          .gte('periodo', desde!)
          .lte('periodo', hasta!)
          .order('fecha'),
      ).map((e) => ({ ...e, monto: num(e.monto) })),
  })
}
