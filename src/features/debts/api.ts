import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chargeOne, type InstallmentState } from '@/lib/finance/installments'
import { periodOf, todayISO } from '@/lib/format'
import { num, numOrNull, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

export const debtKeys = {
  detail: (id: string) => ['debts', id] as const,
  payments: (id: string) => ['payments', 'debt', id] as const,
  installments: (id: string) => ['installments', id] as const,
}

export type Debt = Tables<'debts'>
export type Payment = Tables<'payments'>
export type Installment = Tables<'debt_installments'>
export type DebtInput = Omit<TablesInsert<'debts'>, 'id' | 'user_id' | 'created_at'>
export type InstallmentInput = Omit<TablesInsert<'debt_installments'>, 'id' | 'user_id' | 'created_at' | 'debt_id'>

const normalizeDebt = (d: Debt): Debt => ({
  ...d,
  tasa_anual: numOrNull(d.tasa_anual),
  tasa_efectiva_anual: numOrNull(d.tasa_efectiva_anual),
  cuota_mensual: numOrNull(d.cuota_mensual),
  seguro_mensual: numOrNull(d.seguro_mensual),
  limite_credito: numOrNull(d.limite_credito),
  saldo_base: num(d.saldo_base),
  saldo_cancelacion: numOrNull(d.saldo_cancelacion),
  monto_original: numOrNull(d.monto_original),
})

export const normalizePayment = (p: Payment): Payment => ({
  ...p,
  pago_total: num(p.pago_total),
  interes: numOrNull(p.interes),
  cargos: numOrNull(p.cargos),
  capital: numOrNull(p.capital),
  saldo_despues: num(p.saldo_despues),
})

const normalizeInstallment = (i: Installment): Installment => ({
  ...i,
  monto_cuota: num(i.monto_cuota),
  capital_pendiente: numOrNull(i.capital_pendiente),
  cargo_extra_por_cuota: num(i.cargo_extra_por_cuota),
})

export function useDebt(id: string | undefined) {
  return useQuery({
    queryKey: debtKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => normalizeDebt(unwrap(await supabase.from('debts').select('*').eq('id', id!).single())),
  })
}

export function useDebtPayments(debtId: string | undefined) {
  return useQuery({
    queryKey: debtKeys.payments(debtId ?? ''),
    enabled: Boolean(debtId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('payments')
          .select('*')
          .eq('debt_id', debtId!)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
      ).map(normalizePayment),
  })
}

export function useInstallments(debtId: string | undefined) {
  return useQuery({
    queryKey: debtKeys.installments(debtId ?? ''),
    enabled: Boolean(debtId),
    queryFn: async () =>
      unwrap(await supabase.from('debt_installments').select('*').eq('debt_id', debtId!).order('created_at')).map(
        normalizeInstallment,
      ),
  })
}

/** Toda mutación invalida la caché completa: dashboard, deudas y vistas se refrescan sin recargar. */
function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useSaveDebt() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: DebtInput }) => {
      const debt = id
        ? unwrap(await supabase.from('debts').update(values).eq('id', id).select().single())
        : unwrap(await supabase.from('debts').insert(values).select().single())

      // Sin pagos, el saldo base es el saldo conocido: se refleja en el mes de la fecha base.
      const pagos = unwrap(await supabase.from('payments').select('id').eq('debt_id', debt.id).limit(1))
      if (pagos.length === 0) {
        unwrap(
          await supabase
            .from('monthly_snapshots')
            .upsert(
              { debt_id: debt.id, periodo: periodOf(debt.fecha_base), saldo: debt.saldo_base, origen: 'manual' },
              { onConflict: 'debt_id,periodo', ignoreDuplicates: !id },
            ),
        )
      }
      return normalizeDebt(debt)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteDebt() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from('debts').delete().eq('id', id)
      if (res.error?.code === '23503') {
        throw new Error('Tiene pagos o gastos registrados. Marcala como liquidada en lugar de borrarla.')
      }
      unwrap(res)
    },
    onSuccess: invalidate,
  })
}

export function useSetDebtClosed() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) =>
      unwrap(
        await supabase
          .from('debts')
          .update(closed ? { activa: false, cerrada_en: todayISO() } : { activa: true, cerrada_en: null })
          .eq('id', id),
      ),
    onSuccess: invalidate,
  })
}

export function useSaveInstallment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, debtId, values }: { id?: string; debtId: string; values: InstallmentInput }) =>
      id
        ? unwrap(await supabase.from('debt_installments').update(values).eq('id', id))
        : unwrap(await supabase.from('debt_installments').insert({ ...values, debt_id: debtId })),
    onSuccess: invalidate,
  })
}

export function useDeleteInstallment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('debt_installments').delete().eq('id', id)),
    onSuccess: invalidate,
  })
}

export function useChargeInstallment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (installment: Installment & InstallmentState) =>
      unwrap(await supabase.from('debt_installments').update(chargeOne(installment)).eq('id', installment.id)),
    onSuccess: invalidate,
  })
}
