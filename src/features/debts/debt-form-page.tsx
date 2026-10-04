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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatGTQ, todayISO } from '@/lib/format'
import { parseAmount, toInput } from '@/lib/forms'
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
    interes_modo: d?.interes_modo === 'monto_original' ? 'monto_original' : 'saldo',
    monto_original: toInput(d?.monto_original),
    tasa_mensual:
      d?.interes_modo === 'monto_original' ? toInput(d.tasa_anual != null ? d.tasa_anual / 12 : null, 100) : '',
    pago_unico: d?.pago_unico ?? false,
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
  const [tipo, interesModo, pagoUnico, montoOriginalRaw, tasaMensualRaw, fechaVenc] = useWatch({
    control,
    name: ['tipo', 'interes_modo', 'pago_unico', 'monto_original', 'tasa_mensual', 'fecha_vencimiento'],
  })
  const fijo = tipo === 'prestamo' && interesModo === 'monto_original'
  const montoOriginal = parseAmount(montoOriginalRaw)
  const tasaMensual = parseAmount(tasaMensualRaw)
  const cargoMensual =
    fijo && montoOriginal && tasaMensual && !Number.isNaN(montoOriginal) && !Number.isNaN(tasaMensual)
      ? Math.round(montoOriginal * tasaMensual) / 100
      : null

  const onSubmit = form.handleSubmit(async (values) => {
    // Los campos que no aplican al tipo se guardan vacíos.
    const clean =
      values.tipo === 'tarjeta'
        ? { ...values, cuotas_totales: null, cuota_actual: null, fecha_vencimiento: null }
        : {
            ...values,
            dia_corte: null,
            limite_credito: null,
            ...(values.pago_unico ? { cuota_mensual: 0, cuotas_totales: null, cuota_actual: null } : {}),
          }
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
    name: 'saldo_base' | 'cuota_mensual' | 'seguro_mensual' | 'limite_credito' | 'saldo_cancelacion' | 'monto_original',
    label: string,
    hint?: string,
  ) => (
    <Field id={name} label={label} error={e[name]?.message} hint={hint}>
      <MoneyInput id={name} aria-invalid={!!e[name]} {...register(name)} />
    </Field>
  )
  const text = (
    name:
      | 'tasa_anual'
      | 'tasa_efectiva_anual'
      | 'tasa_mensual'
      | 'dia_corte'
      | 'dia_pago'
      | 'cuotas_totales'
      | 'cuota_actual',
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
        {tipo === 'prestamo' && (
          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">¿Cómo cobra el interés?</span>
            <div role="group" aria-label="Cómo cobra el interés" className="grid grid-cols-2 gap-2">
              <ChoiceChip selected={!fijo} onClick={() => setValue('interes_modo', 'saldo')}>
                <span className="block font-medium">Sobre el saldo</span>
                <span className="text-muted-foreground block text-xs">Bancos y cooperativas</span>
              </ChoiceChip>
              <ChoiceChip selected={fijo} onClick={() => setValue('interes_modo', 'monto_original')}>
                <span className="block font-medium">Fijo sobre el monto</span>
                <span className="text-muted-foreground block text-xs">Ej. 7 % mensual del total prestado</span>
              </ChoiceChip>
            </div>
          </div>
        )}
        {fijo ? (
          <>
            {money('monto_original', 'Monto que te prestaron')}
            {text(
              'tasa_mensual',
              'Interés mensual',
              cargoMensual != null ? `= ${formatGTQ(cargoMensual)} por mes` : 'Sobre el monto original',
              '%',
            )}
          </>
        ) : (
          <>
            {text('tasa_anual', 'Tasa anual nominal', PENDIENTE_HINT, '%')}
            {text('tasa_efectiva_anual', 'Tasa efectiva anual (TEA)', undefined, '%')}
          </>
        )}
        {tipo === 'prestamo' && (
          <div className="flex items-start justify-between gap-4 rounded-xl border p-3 sm:col-span-2">
            <Label htmlFor="pago_unico" className="flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">Se paga todo al vencimiento</span>
              <span className="text-muted-foreground text-xs">
                Sin cuotas mensuales: capital e intereses en un solo pago.
              </span>
            </Label>
            <Switch
              id="pago_unico"
              checked={pagoUnico}
              onCheckedChange={(v) => setValue('pago_unico', v, { shouldValidate: true })}
            />
          </div>
        )}
        {!(tipo === 'prestamo' && pagoUnico) && money('cuota_mensual', 'Cuota mensual planeada')}
        {money('seguro_mensual', 'Seguro mensual', PENDIENTE_HINT)}
        {text('dia_pago', 'Día de pago', 'Del 1 al 31')}
        {tipo === 'tarjeta' ? (
          <>
            {text('dia_corte', 'Día de corte', 'Del 1 al 31')}
            {money('limite_credito', 'Límite de crédito')}
          </>
        ) : (
          <>
            {!pagoUnico && text('cuotas_totales', 'Cuotas totales')}
            {!pagoUnico && text('cuota_actual', 'Cuota actual')}
            {date(
              'fecha_vencimiento',
              pagoUnico ? 'Fecha del pago total' : 'Fecha de vencimiento',
              pagoUnico && fijo && fechaVenc ? 'El interés fijo se suma cada mes hasta esta fecha' : undefined,
            )}
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
