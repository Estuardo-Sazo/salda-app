import { zodResolver } from '@hookform/resolvers/zod'
import { AlertOctagon, ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, PageHeader } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebtStatus } from '@/features/common/queries'
import { CATEGORIAS, monthlyInterestOn } from '@/lib/finance/expenses'
import { addMonths } from '@/lib/finance/period'
import { formatMoney, formatPercent, formatPeriod, periodOf, todayISO } from '@/lib/format'
import { parseAmount, toInput } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { useDeleteExpense, useExpense, useExpenseDescriptions, useSaveExpense } from './api'
import { expenseSchema, METODOS, type ExpenseFormInput, type ExpenseFormOutput } from './schema'

const emptyValues = (): ExpenseFormInput => ({
  monto: '',
  descripcion: '',
  categoria: '',
  metodo: 'efectivo',
  debt_id: '',
  fecha: todayISO(),
  periodo: periodOf(todayISO()),
})

export function ExpenseFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const volver = params.get('volver') ?? '/gastos'
  const editing = Boolean(id)

  const debts = useDebtStatus()
  const existing = useExpense(id)
  const descriptions = useExpenseDescriptions()
  const save = useSaveExpense()
  const remove = useDeleteExpense()

  const editValues = useMemo<ExpenseFormInput | undefined>(() => {
    const e = existing.data
    if (!e) return undefined
    return {
      monto: toInput(e.monto),
      descripcion: e.descripcion,
      categoria: e.categoria,
      metodo: e.metodo,
      debt_id: e.debt_id ?? '',
      fecha: e.fecha,
      periodo: e.periodo,
    }
  }, [existing.data])

  const form = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues(),
    values: editValues,
    resetOptions: { keepDirtyValues: true },
  })
  const { register, setValue, control, formState } = form
  const errors = formState.errors
  const [montoRaw, descripcion, categoria, metodo, debtId, fecha] = useWatch({
    control,
    name: ['monto', 'descripcion', 'categoria', 'metodo', 'debt_id', 'fecha'],
  })
  const [periodoTouched, setPeriodoTouched] = useState(editing)
  const [categoriaTouched, setCategoriaTouched] = useState(editing)
  const loaded = !editing || Boolean(existing.data)

  const tarjetas = useMemo(
    () => (debts.data ?? []).filter((d) => d.tipo === 'tarjeta' && (d.estado === 'activa' || d.debt_id === debtId)),
    [debts.data, debtId],
  )
  const tarjeta = tarjetas.find((t) => t.debt_id === debtId)

  // Período automático = mes de la fecha, hasta que el usuario lo cambie.
  useEffect(() => {
    if (!periodoTouched && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) setValue('periodo', periodOf(fecha))
  }, [fecha, setValue, periodoTouched])

  // Una descripción conocida sugiere su categoría.
  useEffect(() => {
    if (categoriaTouched) return
    const known = descriptions.data?.find((d) => d.descripcion.toLowerCase() === descripcion.trim().toLowerCase())
    if (known) setValue('categoria', known.categoria, { shouldValidate: true })
  }, [descripcion, descriptions.data, categoriaTouched, setValue])

  // Con una sola tarjeta activa, se elige sola.
  useEffect(() => {
    if (metodo === 'tarjeta' && !debtId && tarjetas.length === 1) setValue('debt_id', tarjetas[0]!.debt_id)
  }, [metodo, debtId, tarjetas, setValue])

  const monto = parseAmount(montoRaw)
  const interesMes = tarjeta && monto && !Number.isNaN(monto) ? monthlyInterestOn(monto, tarjeta.tasa_anual) : null
  const periodoBase = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? periodOf(fecha) : periodOf(todayISO())
  const periodos = [-1, 0, 1].map((n) => addMonths(periodoBase, n))

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id, values })
      if (values.metodo === 'tarjeta') {
        toast.warning(`Deuda nueva: ${formatMoney(values.monto)} en ${tarjeta?.nombre ?? 'la tarjeta'}`)
      } else {
        toast.success(`Gasto de ${formatMoney(values.monto)} registrado`)
      }
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
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto grid max-w-xl gap-5">
      <PageHeader
        title={editing ? 'Editar gasto' : 'Registrar gasto'}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={volver}>
              <ArrowLeft /> Volver
            </Link>
          </Button>
        }
      />

      <Field id="monto" label="Monto" error={errors.monto?.message}>
        <MoneyInput id="monto" large placeholder="0.00" aria-invalid={!!errors.monto} {...register('monto')} />
      </Field>

      <Field id="descripcion" label="Descripción" error={errors.descripcion?.message}>
        <Input
          id="descripcion"
          className="h-11"
          placeholder="Supermercado, recarga, streaming…"
          list="descripciones"
          autoComplete="off"
          aria-invalid={!!errors.descripcion}
          {...register('descripcion')}
        />
        <datalist id="descripciones">
          {(descriptions.data ?? []).slice(0, 30).map((d) => (
            <option key={d.descripcion} value={d.descripcion} />
          ))}
        </datalist>
      </Field>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">Categoría</h2>
        <div role="group" aria-label="Categoría" className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <ChoiceChip
              key={c}
              selected={categoria === c}
              className="py-2"
              onClick={() => {
                setCategoriaTouched(true)
                setValue('categoria', c, { shouldValidate: true })
              }}
            >
              {c}
            </ChoiceChip>
          ))}
        </div>
        {errors.categoria && (
          <p role="alert" className="text-destructive text-xs">
            {errors.categoria.message}
          </p>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">¿Cómo pagaste?</h2>
        <div role="group" aria-label="Método de pago" className="grid grid-cols-2 gap-2">
          {METODOS.map((m) => (
            <ChoiceChip
              key={m.value}
              selected={metodo === m.value}
              className={cn(
                m.value === 'tarjeta' &&
                  metodo === 'tarjeta' &&
                  'border-destructive bg-danger-soft ring-destructive/30',
              )}
              onClick={() => setValue('metodo', m.value, { shouldValidate: true })}
            >
              {m.label}
            </ChoiceChip>
          ))}
        </div>
      </section>

      {metodo === 'tarjeta' && (
        <section className="border-destructive/40 bg-danger-soft grid gap-3 rounded-2xl border p-4">
          <div className="flex gap-3">
            <AlertOctagon className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="text-destructive font-semibold">Esto es deuda nueva</p>
              <p className="text-muted-foreground">
                {tarjeta && monto && !Number.isNaN(monto) ? (
                  <>
                    Sumás <span className="text-foreground font-medium">{formatMoney(monto)}</span> a {tarjeta.nombre}
                    {tarjeta.tasa_anual != null ? (
                      <>
                        {' '}
                        al {formatPercent(tarjeta.tasa_anual)} anual. Si no la pagás completa al corte, cuesta ≈{' '}
                        <span className="text-foreground font-medium">{formatMoney(interesMes)}</span> de interés por mes.
                      </>
                    ) : (
                      ' (tasa PENDIENTE DE CONFIRMAR).'
                    )}
                  </>
                ) : (
                  'Las compras con tarjeta aumentan lo que debés y se muestran en rojo en el inicio.'
                )}
              </p>
            </div>
          </div>
          {tarjetas.length === 0 ? (
            <p className="text-sm">
              No tenés tarjetas activas.{' '}
              <Link to="/deudas/nueva" className="text-primary font-medium underline-offset-4 hover:underline">
                Agregá una
              </Link>
              .
            </p>
          ) : (
            <div role="group" aria-label="Tarjeta" className="grid grid-cols-2 gap-2">
              {tarjetas.map((t) => (
                <ChoiceChip
                  key={t.debt_id}
                  selected={debtId === t.debt_id}
                  onClick={() => setValue('debt_id', t.debt_id, { shouldValidate: true })}
                >
                  <span className="block truncate font-medium">{t.nombre}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t.tasa_anual != null ? `${formatPercent(t.tasa_anual)} anual` : 'Tasa pendiente'}
                  </span>
                </ChoiceChip>
              ))}
            </div>
          )}
          {errors.debt_id && (
            <p role="alert" className="text-destructive text-xs">
              {errors.debt_id.message}
            </p>
          )}
        </section>
      )}

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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {editing ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="h-11">
                <Trash2 /> Borrar gasto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar este gasto?</AlertDialogTitle>
                <AlertDialogDescription>No se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    remove.mutate(id!, {
                      onSuccess: () => {
                        toast.success('Gasto borrado')
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
        <Button
          type="submit"
          size="lg"
          variant={metodo === 'tarjeta' ? 'destructive' : 'default'}
          className={cn(
            'h-12 text-base sm:min-w-48',
            metodo === 'tarjeta' && 'bg-destructive hover:bg-destructive/90 text-white',
          )}
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          {metodo === 'tarjeta' ? 'Guardar compra con tarjeta' : 'Guardar gasto'}
        </Button>
      </div>
    </form>
  )
}
