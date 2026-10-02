import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CreditCard, Landmark, Loader2, Save } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, PageHeader } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { todayISO } from '@/lib/format'
import { toInput } from '@/lib/forms'
import { useDebt, useSaveDebt, type Debt } from './api'
import { debtSchema, type DebtFormInput, type DebtFormOutput } from './schema'

const PENDIENTE_HINT = 'Vacío = PENDIENTE DE CONFIRMAR'

function toFormValues(d?: Debt): DebtFormInput {
  return {
    nombre: d?.nombre ?? '',
    entidad: d?.entidad ?? '',
    tipo: d?.tipo ?? 'tarjeta',
    saldo_base: toInput(d?.saldo_base),
    fecha_base: d?.fecha_base ?? todayISO(),
    tasa_anual: toInput(d?.tasa_anual, 100),
    tasa_efectiva_anual: toInput(d?.tasa_efectiva_anual, 100),
    cuota_mensual: toInput(d?.cuota_mensual),
    seguro_mensual: toInput(d?.seguro_mensual),
    dia_corte: d?.dia_corte?.toString() ?? '',
    dia_pago: d?.dia_pago?.toString() ?? '',
    limite_credito: toInput(d?.limite_credito),
    saldo_cancelacion: toInput(d?.saldo_cancelacion),
    saldo_cancelacion_fecha: d?.saldo_cancelacion_fecha ?? '',
    cuotas_totales: d?.cuotas_totales?.toString() ?? '',
    cuota_actual: d?.cuota_actual?.toString() ?? '',
    fecha_vencimiento: d?.fecha_vencimiento ?? '',
    notas: d?.notas ?? '',
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

export function DebtFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useDebt(id)
  const save = useSaveDebt()
  const loaded = !id || Boolean(existing.data)
  const editValues = useMemo(() => (existing.data ? toFormValues(existing.data) : undefined), [existing.data])

  const form = useForm<DebtFormInput, unknown, DebtFormOutput>({
    resolver: zodResolver(debtSchema),
    defaultValues: toFormValues(),
    values: editValues,
    resetOptions: { keepDirtyValues: true },
  })
  const { register, setValue, control, formState } = form
  const e = formState.errors
  const tipo = useWatch({ control, name: 'tipo' })

  const onSubmit = form.handleSubmit(async (values) => {
    // Los campos que no aplican al tipo se guardan vacíos.
    const clean =
      values.tipo === 'tarjeta'
        ? { ...values, cuotas_totales: null, cuota_actual: null, fecha_vencimiento: null }
        : { ...values, dia_corte: null, limite_credito: null }
    try {
      const debt = await save.mutateAsync({ id, values: clean })
      toast.success(id ? 'Deuda actualizada' : `${debt.nombre} agregada`)
      navigate(`/deudas/${debt.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    }
  })

  if (existing.error) return <ErrorState error={existing.error} />
  if (!loaded) return <Skeleton className="h-96 rounded-xl" />

  const money = (
    name: 'saldo_base' | 'cuota_mensual' | 'seguro_mensual' | 'limite_credito' | 'saldo_cancelacion',
    label: string,
    hint?: string,
  ) => (
    <Field id={name} label={label} error={e[name]?.message} hint={hint}>
      <MoneyInput id={name} aria-invalid={!!e[name]} {...register(name)} />
    </Field>
  )
  const text = (
    name: 'tasa_anual' | 'tasa_efectiva_anual' | 'dia_corte' | 'dia_pago' | 'cuotas_totales' | 'cuota_actual',
    label: string,
    hint?: string,
    suffix?: string,
  ) => (
    <Field id={name} label={label} error={e[name]?.message} hint={hint}>
      <div className="relative">
        <Input id={name} inputMode="decimal" className="tabular h-11" aria-invalid={!!e[name]} {...register(name)} />
        {suffix && (
          <span aria-hidden className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
  const date = (name: 'fecha_base' | 'saldo_cancelacion_fecha' | 'fecha_vencimiento', label: string, hint?: string) => (
    <Field id={name} label={label} error={e[name]?.message} hint={hint}>
      <Input id={name} type="date" className="h-11" {...register(name)} />
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto grid max-w-2xl gap-4">
      <PageHeader
        title={id ? 'Editar deuda' : 'Nueva deuda'}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={id ? `/deudas/${id}` : '/deudas'}>
              <ArrowLeft /> Volver
            </Link>
          </Button>
        }
      />

      <Section title="Datos básicos">
        <div className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-medium">Tipo</span>
          <div role="group" aria-label="Tipo de deuda" className="grid grid-cols-2 gap-2">
            {(
              [
                ['tarjeta', 'Tarjeta de crédito', CreditCard],
                ['prestamo', 'Préstamo', Landmark],
              ] as const
            ).map(([value, label, Icon]) => (
              <ChoiceChip
                key={value}
                selected={tipo === value}
                onClick={() => setValue('tipo', value)}
                className="flex items-center gap-2"
              >
                <Icon className="size-4" aria-hidden /> {label}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <Field id="nombre" label="Nombre" error={e.nombre?.message}>
          <Input id="nombre" className="h-11" aria-invalid={!!e.nombre} {...register('nombre')} />
        </Field>
        <Field id="entidad" label="Banco o entidad">
          <Input id="entidad" className="h-11" {...register('entidad')} />
        </Field>
        {money('saldo_base', 'Saldo al empezar el seguimiento')}
        {date('fecha_base', 'Fecha de ese saldo')}
      </Section>

      <Section title="Condiciones" description="Dejá vacío lo que no sepás: se marca como PENDIENTE DE CONFIRMAR.">
        {text('tasa_anual', 'Tasa anual nominal', PENDIENTE_HINT, '%')}
        {text('tasa_efectiva_anual', 'Tasa efectiva anual (TEA)', undefined, '%')}
        {money('cuota_mensual', 'Cuota mensual planeada')}
        {money('seguro_mensual', 'Seguro mensual', PENDIENTE_HINT)}
        {text('dia_pago', 'Día de pago', 'Del 1 al 31')}
        {tipo === 'tarjeta' ? (
          <>
            {text('dia_corte', 'Día de corte', 'Del 1 al 31')}
            {money('limite_credito', 'Límite de crédito')}
          </>
        ) : (
          <>
            {text('cuotas_totales', 'Cuotas totales')}
            {text('cuota_actual', 'Cuota actual')}
            {date('fecha_vencimiento', 'Fecha de vencimiento')}
          </>
        )}
      </Section>

      <Section title="Saldo de cancelación" description="Lo que pide el banco para cancelar la deuda hoy.">
        {money('saldo_cancelacion', 'Saldo de cancelación', PENDIENTE_HINT)}
        {date('saldo_cancelacion_fecha', 'Fecha del dato')}
        <Field id="notas" label="Notas" className="sm:col-span-2">
          <Textarea id="notas" rows={3} {...register('notas')} />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base sm:w-auto sm:min-w-48"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          {id ? 'Guardar cambios' : 'Agregar deuda'}
        </Button>
      </div>
    </form>
  )
}
