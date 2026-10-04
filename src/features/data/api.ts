import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ImportPayload } from '@/lib/seed/build-payload'
import { supabase, unwrap } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import {
  compareTotals,
  totalsOf,
  type BackupTotal,
  type RawTables,
  type RestorePayload,
  type TotalsMismatch,
} from './backup'

const PAGE = 1000

type TableName =
  | 'budget_items'
  | 'debts'
  | 'debt_installments'
  | 'monthly_snapshots'
  | 'payments'
  | 'expenses'
  | 'extra_incomes'
  | 'receivables'
  | 'receivable_payments'
  | 'plans'
  | 'plan_rows'

/** Lee una tabla completa en páginas (PostgREST corta en 1000 filas). */
async function fetchAll<T extends TableName>(table: T): Promise<RawTables[T]> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(
      await supabase
        .from(table)
        .select('*')
        .order('id')
        .range(from, from + PAGE - 1),
    ) as unknown[]
    out.push(...rows)
    if (rows.length < PAGE) return out as RawTables[T]
  }
}

/** Todas las tablas del usuario (RLS limita a sus filas) más los totales mensuales para verificar. */
export async function fetchAllTables(): Promise<RawTables> {
  const [profile, monthlyTotals, ...rest] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('v_monthly_totals').select('*').order('periodo'),
    fetchAll('budget_items'),
    fetchAll('debts'),
    fetchAll('debt_installments'),
    fetchAll('monthly_snapshots'),
    fetchAll('payments'),
    fetchAll('expenses'),
    fetchAll('extra_incomes'),
    fetchAll('receivables'),
    fetchAll('receivable_payments'),
    fetchAll('plans'),
    fetchAll('plan_rows'),
  ])
  if (profile.error) throw new Error(profile.error.message)
  const [
    budget_items,
    debts,
    debt_installments,
    monthly_snapshots,
    payments,
    expenses,
    extra_incomes,
    receivables,
    receivable_payments,
    plans,
    plan_rows,
  ] = rest as [
    RawTables['budget_items'],
    RawTables['debts'],
    RawTables['debt_installments'],
    RawTables['monthly_snapshots'],
    RawTables['payments'],
    RawTables['expenses'],
    RawTables['extra_incomes'],
    RawTables['receivables'],
    RawTables['receivable_payments'],
    RawTables['plans'],
    RawTables['plan_rows'],
  ]
  return {
    profile: profile.data,
    budget_items,
    debts,
    debt_installments,
    monthly_snapshots,
    payments,
    expenses,
    extra_incomes,
    receivables,
    receivable_payments,
    plans,
    plan_rows,
    monthly_totals: unwrap(monthlyTotals),
  }
}

export interface ImportResult {
  counts: Record<string, number>
  /** Solo al restaurar un respaldo: diferencias contra los totales exportados (vacío = coinciden). */
  mismatches: TotalsMismatch[] | null
}

/** Importa en una sola transacción (RPC) y, si es un respaldo, verifica que los totales coincidan. */
export function useImportPayload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      payload,
      expectedTotals,
    }: {
      payload: RestorePayload | ImportPayload
      expectedTotals?: BackupTotal[]
    }): Promise<ImportResult> => {
      const counts = unwrap(
        await supabase.rpc('import_initial_data', { payload: payload as unknown as Json }),
      ) as Record<string, number>
      if (!expectedTotals) return { counts, mismatches: null }
      const totals = unwrap(await supabase.from('v_monthly_totals').select('*').order('periodo'))
      return { counts, mismatches: compareTotals(expectedTotals, totalsOf(totals)) }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** Descarga un archivo generado en el navegador. */
export function downloadFile(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
