import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Loader2, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { ChoiceChip, Collapsible, Field, MoneyInput } from '@/components/form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDebtPayments } from '@/features/debts/api'
import { useDebtStatus, useMonthlyBalances, type DebtStatus } from '@/features/common/queries'
import { addMonths } from '@/lib/finance/period'
import { flatInterestPortion, flatPayoffIn, type FlatLoanTerms } from '@/lib/finance/flat-loan'
import { analyzePayment, expectedBalanceAfter, previousBalance } from '@/lib/finance/payment'
import { formatGTQ, formatPeriod, periodOf, todayISO } from '@/lib/format'
import { parseAmount, toInput } from '@/lib/forms'
import { CreditCard } from 'lucide-react'
import { useDeletePayment, usePayment, usePaymentSources, useSavePayment } from './api'
import { paymentSchema, type PaymentFormInput, type PaymentFormOutput } from './schema'

const emptyValues = (debtId = ''): PaymentFormInput => ({
  debt_id: debtId,
  pago_total: '',
  fecha: todayISO(),
  periodo: periodOf(todayISO()),
  saldo_despues: '',
  interes: '',
  cargos: '',
  fuente: '',
  notas: '',
})

function DebtChips({
  debts,
  value,
  onSelect,
}: {
  debts: DebtStatus[]
  value: string
  onSelect: (debt: DebtStatus) => void
}) {
  return (
    <div role="group" aria-label="Deuda" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {debts.map((d) => (
        <ChoiceChip key={d.debt_id} selected={value === d.debt_id} onClick={() => onSelect(d)}>
          <span className="block truncate font-medium">{d.nombre}</span>
          <span className="text-muted-foreground block text-xs">
            {d.cuota_mensual != null ? `Cuota ${formatGTQ(d.cuota_mensual)}` : 'Sin cuota'}
          </span>
        </ChoiceChip>
      ))}
    </div>
  )
}

export function PaymentFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const volver = params.get('volver') ?? '/'
  const editing = Boolean(id)

  const debts = useDebtStatus()
  const existing = usePayment(id)
  const sources = usePaymentSources()
  const save = useSavePayment()
  const remove = useDeletePayment()

  // Al editar, el formulario toma los valores del pago (el interés estimado se recalcula).
  const editValues = useMemo<PaymentFormInput | undefined>(() => {
    const p = existing.data
    if (!p) return undefined
    return {
      debt_id: p.debt_id,
      pago_total: toInput(p.pago_total),
      fecha: p.fecha,
      periodo: p.periodo,
      saldo_despues: toInput(p.saldo_despues),
      interes: p.es_estimado ? '' : toInput(p.interes),
      cargos: toInput(p.cargos),
      fuente: p.fuente ?? '',
      notas: p.notas ?? '',
    }
  }, [existing.data])

  const form = useForm<PaymentFormInput, unknown, PaymentFormOutput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: emptyValues(params.get('deuda') ?? ''),
    values: editValues,
    resetOptions: { keepDirtyValues: true },
  })
  const { register, setValue, control, formState } = form
  const errors = formState.errors
  const [debtId, pagoRaw, fecha, periodo, saldoRaw, interesRaw, cargosRaw] = useWatch({
    control,
    name: ['debt_id', 'pago_total', 'fecha', 'periodo', 'saldo_despues', 'interes', 'cargos'],
  })
  // Mientras el usuario no toque el monto o el período, se completan solos.
  const [periodoTouched, setPeriodoTouched] = useState(editing)
  const [pagoTouched, setPagoTouched] = useState(editing)
  const loaded = !editing || Boolean(existing.data)

  const activeDebts = useMemo(
    () => (debts.data ?? []).filter((d) => d.estado === 'activa' || d.debt_id === existing.data?.debt_id),
    [debts.data, existing.data],
  )
  const debt = activeDebts.find((d) => d.debt_id === debtId)

  // Período automático = mes de la fecha, hasta que el usuario lo cambie.
  useEffect(() => {
    if (!periodoTouched && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) setValue('periodo', periodOf(fecha))
  }, [fecha, setValue, periodoTouched])

  const payments = useDebtPayments(debtId || undefined)
  const balances = useMonthlyBalances()
  // Sin pagos previos, el saldo anterior es el saldo base; si el pago es anterior a la fecha base
  // (el saldo base ya lo incluye), se usa el saldo mensual del período previo.
  const saldoInicial = useMemo(() => {
    if (!debt) return null
    if (fecha >= debt.fecha_base || !balances.data) return debt.saldo_base
    const previo = addMonths(periodo, -1)
    return balances.data.find((b) => b.debt_id === debt.debt_id && b.periodo === previo)?.saldo ?? debt.saldo_base
  }, [debt, fecha, periodo, balances.data])
  // Préstamo de interés fijo: lo adeudado en el período incluye el cargo de cada mes.
  const flatTerms = useMemo<FlatLoanTerms | null>(
    () =>
      debt?.interes_modo === 'monto_original' && debt.monto_original != null && debt.tasa_anual != null
        ? {
            montoOriginal: debt.monto_original,
            tasaAnual: debt.tasa_anual,
            fechaBase: debt.fecha_base,
            saldoBase: debt.saldo_base,
            fechaVencimiento: debt.fecha_vencimiento,
          }
        : null,
    [debt],
  )
  const otrosPagos = useMemo(() => (payments.data ?? []).filter((p) => p.id !== id), [payments.data, id])
  const saldoAnterior = !payments.data
    ? null
    : flatTerms
      ? flatPayoffIn(flatTerms, otrosPagos, periodo)
      : saldoInicial != null
        ? previousBalance(payments.data, saldoInicial, fecha, id)
        : null

  // Monto sugerido: la cuota, o el total para cancelar si no hay cuota (pago único / interés fijo).
  const montoSugerido = debt?.cuota_mensual ? debt.cuota_mensual : flatTerms ? saldoAnterior : debt?.cuota_mensual
  useEffect(() => {
    if (!pagoTouched && montoSugerido != null) setValue('pago_total', toInput(montoSugerido))
  }, [montoSugerido, pagoTouched, setValue])

  const pago = parseAmount(pagoRaw)
  const saldoDespues = parseAmount(saldoRaw)
  const interes = parseAmount(interesRaw)
  const cargos = parseAmount(cargosRaw)
  const valid = (n: number | null): n is number => n != null && !Number.isNaN(n)
  // Interés fijo: el interés del pago sale de las condiciones (no se estima).
  const interesFijo =
    flatTerms && saldoAnterior != null && valid(pago)
      ? flatInterestPortion(
          flatTerms,
          otrosPagos.filter((p) => p.periodo < periodo),
          saldoAnterior,
          pago,
        )
      : null
  const analysis =
    saldoAnterior != null && valid(pago) && valid(saldoDespues)
      ? analyzePayment({
          saldoAnterior,
          pagoTotal: pago,
          saldoDespues,
          interes: valid(interes) ? interes : interesFijo,
          cargos: valid(cargos) ? cargos : null,
        })
      : null
  const sugerido =
    saldoAnterior == null || !valid(pago)
      ? null
      : flatTerms
        ? Math.max(0, Math.round((saldoAnterior - pago) * 100) / 100)
        : debt?.tipo === 'prestamo'
          ? expectedBalanceAfter(saldoAnterior, debt.tasa_anual, pago)
          : null

  const periodoBase = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? periodOf(fecha) : periodOf(todayISO())
  const periodos = [-1, 0, 1].map((n) => addMonths(periodoBase, n))

  const selectDebt = (d: DebtStatus) => {
    setValue('debt_id', d.debt_id, { shouldValidate: true })
    if (!pagoTouched) setValue('pago_total', d.cuota_mensual ? toInput(d.cuota_mensual) : '')
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (saldoAnterior == null || !debt) return
    const a = analyzePayment({
      saldoAnterior,
      pagoTotal: values.pago_total,
      saldoDespues: values.saldo_despues,
      interes: values.interes ?? interesFijo,
      cargos: values.cargos,
    })
    try {
      await save.mutateAsync({
        id,
        values: {
          debt_id: values.debt_id,
          fecha: values.fecha,
          periodo: values.periodo,
          pago_total: values.pago_total,
          saldo_despues: values.saldo_despues,
          interes: a.interes,
          cargos: values.cargos,
          es_estimado: a.esEstimado,
          fuente: values.fuente,
          notas: values.notas,
        },
      })
      const verbo = a.bajo >= 0 ? 'bajó' : 'subió'
      const detalle = a.interes != null ? `; interés ${formatGTQ(a.interes)}${a.esEstimado ? ' (estimado)' : ''}` : ''
      toast.success(`${debt.nombre} ${verbo} ${formatGTQ(Math.abs(a.bajo))}${detalle}`)
      navigate(volver, { replace: true })
    } catch (e) {
      toast.error((e as Error).message)
    }
  })

  if (debts.error) return <ErrorState error={debts.error} />
  if (existing.error) return <ErrorState error={existing.error} />
  if (!debts.data || !loaded) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }
  if (activeDebts.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No hay deudas activas"
        description="Agregá una deuda antes de registrar pagos."
        action={
          <Button asChild>
            <Link to="/deudas/nueva">Nueva deuda</Link>
          </Button>
        }
      />
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto grid max-w-xl gap-5">
      <PageHeader
        title={editing ? 'Editar pago' : 'Registrar pago'}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={volver}>
              <ArrowLeft /> Volver
            </Link>
          </Button>
        }
      />

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">¿A qué deuda?</h2>
        <DebtChips debts={activeDebts} value={debtId} onSelect={selectDebt} />
        {errors.debt_id && (
          <p role="alert" className="text-destructive text-xs">
            {errors.debt_id.message}
          </p>
        )}
      </section>

      <Field id="pago_total" label="Monto pagado" error={errors.pago_total?.message}>
        <MoneyInput
          id="pago_total"
          large
          placeholder="0.00"
          aria-invalid={!!errors.pago_total}
          {...register('pago_total', { onChange: () => setPagoTouched(true) })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="fecha" label="Fecha" error={errors.fecha?.message}>
          <Input id="fecha" type="date" className="h-11" {...register('fecha')} />
        </Field>
        <Field id="periodo" label="Corresponde a" error={errors.periodo?.message}>
          <select
            id="periodo"
            className="border-input bg-background h-11 rounded-lg border px-3 text-sm"
            {...register('periodo', { onChange: () => setPeriodoTouched(true) })}
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {formatPeriod(p)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        id="saldo_despues"
        label="Saldo después del pago"
        error={errors.saldo_despues?.message}
        hint={
          saldoAnterior == null
            ? undefined
            : flatTerms
              ? `Para cancelarlo en ${formatPeriod(periodo)}: ${formatGTQ(saldoAnterior)} (incluye el interés fijo)`
              : `Saldo anterior ${formatGTQ(saldoAnterior)}`
        }
      >
        <MoneyInput
          id="saldo_despues"
          placeholder="Lo ves en la app del banco"
          aria-invalid={!!errors.saldo_despues}
          {...register('saldo_despues')}
        />
        {sugerido != null && saldoDespues == null && (
          <button
            type="button"
            onClick={() => setValue('saldo_despues', toInput(sugerido), { shouldValidate: true })}
            className="text-primary inline-flex w-fit items-center gap-1 text-xs font-medium hover:underline"
          >
            <Sparkles className="size-3.5" aria-hidden />
            {flatTerms ? `Usar ${formatGTQ(sugerido)}` : `Usar estimado ${formatGTQ(sugerido)}`}
          </button>
        )}
      </Field>

      {analysis && (
        <div aria-live="polite" className="bg-muted/60 grid gap-1 rounded-xl p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{analysis.bajo >= 0 ? 'El saldo baja' : 'El saldo sube'}</span>
            <Money value={Math.abs(analysis.bajo)} className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capital</span>
            <Money value={analysis.capital} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              Interés
              {analysis.esEstimado && <Badge variant="warning">estimado</Badge>}
            </span>
            {analysis.interes != null ? <Money value={analysis.interes} /> : <span>—</span>}
          </div>
          {analysis.advertencia && (
            <p className="text-warning-foreground mt-1 flex gap-1.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {analysis.advertencia}
            </p>
          )}
        </div>
      )}

      <Collapsible title="Interés y cargos (opcional)" defaultOpen={editing && Boolean(interesRaw || cargosRaw)}>
        <p className="text-muted-foreground text-xs">
          Si los dejás vacíos, el interés se estima con el cambio de saldo y se marca como estimado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="interes" label="Interés" error={errors.interes?.message}>
            <MoneyInput id="interes" placeholder="0.00" {...register('interes')} />
          </Field>
          <Field id="cargos" label="Seguro / cargos" error={errors.cargos?.message}>
            <MoneyInput id="cargos" placeholder="0.00" {...register('cargos')} />
          </Field>
        </div>
      </Collapsible>

      <Collapsible title="Fuente y notas" defaultOpen={editing}>
        <Field id="fuente" label="Fuente">
          <Input
            id="fuente"
            className="h-11"
            placeholder="App del banco, estado de cuenta…"
            list="fuentes"
            {...register('fuente')}
          />
          <datalist id="fuentes">
            {(sources.data ?? []).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field id="notas" label="Notas">
          <Textarea id="notas" rows={2} {...register('notas')} />
        </Field>
      </Collapsible>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {editing ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="h-11">
                <Trash2 /> Borrar pago
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar este pago?</AlertDialogTitle>
                <AlertDialogDescription>
                  El saldo del mes se recalcula con los pagos que queden. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    remove.mutate(id!, {
                      onSuccess: () => {
                        toast.success('Pago borrado')
                        navigate(volver, { replace: true })
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Borrar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" className="h-12 text-base sm:min-w-48" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar pago
        </Button>
      </div>
    </form>
  )
}
