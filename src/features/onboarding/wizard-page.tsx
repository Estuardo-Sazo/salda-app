import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CreditCard, Flag, Landmark, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Money, PendingBadge } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useImportPayload } from '@/features/data/api'
import { ESTRATEGIA_LABEL } from '@/features/plan/plan-input'
import type { Strategy } from '@/lib/finance'
import { currentPeriod, formatGTQ, formatPercent, formatPeriodLong, todayISO } from '@/lib/format'
import {
  moneyField,
  optionalIntField,
  optionalMoneyField,
  optionalPercentField,
  optionalText,
  parseAmount,
  toInput,
} from '@/lib/forms'
import { cn } from '@/lib/utils'
import { buildWizardPayload, monthlyRoom, sumCuotas, type WizardDebt, type WizardState } from './wizard-model'

const PASOS = ['Ingreso', 'Gastos fijos', 'Deudas', 'Cuotas fuera de saldo', 'Plan'] as const
const SUGERENCIAS_FIJOS = ['Comida', 'Alquiler', 'Luz', 'Agua', 'Internet', 'Teléfono', 'Transporte']

/* ------------------------------------------------------------------ paso 1: ingreso */

const ingresoSchema = z.object({
  nombre: z.string().trim().max(60),
  ingreso: moneyField('Ingresá tu ingreso mensual neto').refine((v) => v > 0, 'Debe ser mayor a Q0'),
})

function IngresoStep({ state, onNext }: { state: WizardState; onNext: (s: Partial<WizardState>) => void }) {
  const form = useForm<z.input<typeof ingresoSchema>, unknown, z.output<typeof ingresoSchema>>({
    resolver: zodResolver(ingresoSchema),
    defaultValues: { nombre: state.nombre, ingreso: toInput(state.ingreso) },
  })
  const e = form.formState.errors
  return (
    <form
      id="paso"
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit((v) => onNext({ nombre: v.nombre, ingreso: v.ingreso }))}
    >
      <Field id="nombre" label="¿Cómo te llamás? (opcional)" error={e.nombre?.message}>
        <Input id="nombre" className="h-11" autoComplete="given-name" {...form.register('nombre')} />
      </Field>
      <Field
        id="ingreso"
        label="Ingreso mensual neto"
        error={e.ingreso?.message}
        hint="Lo que te cae al mes después de descuentos. Aguinaldo y Bono 14 se agregan aparte."
      >
        <MoneyInput id="ingreso" large autoFocus aria-describedby="ingreso-msg" {...form.register('ingreso')} />
      </Field>
    </form>
  )
}

/* ------------------------------------------------------------------ paso 2: gastos fijos */

const fijoSchema = z.object({
  concepto: z.string().trim().min(1, 'Poné un concepto').max(40),
  monto: moneyField('Ingresá el monto').refine((v) => v > 0, 'Debe ser mayor a Q0'),
})

function FijosStep({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const form = useForm<z.input<typeof fijoSchema>, unknown, z.output<typeof fijoSchema>>({
    resolver: zodResolver(fijoSchema),
    defaultValues: { concepto: '', monto: '' },
  })
  const e = form.formState.errors
  const concepto = useWatch({ control: form.control, name: 'concepto' })
  const libre = monthlyRoom(state)
  const usados = new Set(state.gastosFijos.map((g) => g.concepto.toLowerCase()))
  const add = form.handleSubmit((v) => {
    setState({ gastosFijos: [...state.gastosFijos, v] })
    form.reset({ concepto: '', monto: '' })
  })

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Gastos que pagás todos los meses y no son deudas (comida, servicios, alquiler).
      </p>
      {state.gastosFijos.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {state.gastosFijos.map((g, i) => (
            <li key={`${g.concepto}${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">{g.concepto}</span>
              <Money value={g.monto} />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Quitar ${g.concepto}`}
                onClick={() => setState({ gastosFijos: state.gastosFijos.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugerencias">
        {SUGERENCIAS_FIJOS.filter((s) => !usados.has(s.toLowerCase())).map((s) => (
          <ChoiceChip
            key={s}
            selected={concepto === s}
            className="py-1.5"
            onClick={() => {
              form.setValue('concepto', s)
              form.setFocus('monto')
            }}
          >
            {s}
          </ChoiceChip>
        ))}
      </div>
      <form noValidate onSubmit={add} className="grid grid-cols-[1fr_8rem_auto] items-start gap-2">
        <Field id="fijo-concepto" label="Concepto" error={e.concepto?.message}>
          <Input id="fijo-concepto" className="h-11" {...form.register('concepto')} />
        </Field>
        <Field id="fijo-monto" label="Monto" error={e.monto?.message}>
          <MoneyInput id="fijo-monto" {...form.register('monto')} />
        </Field>
        <Button type="submit" variant="outline" className="mt-6 h-11" aria-label="Agregar gasto fijo">
          <Plus />
        </Button>
      </form>
      {libre != null && (
        <p className="bg-muted/60 rounded-xl p-3 text-sm">
          Te quedan <Money value={libre} className={cn('font-semibold', libre < 0 && 'text-destructive')} /> al mes para
          deudas y otros gastos.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ paso 3: deudas */

const deudaSchema = z.object({
  tipo: z.enum(['tarjeta', 'prestamo']),
  nombre: z.string().trim().min(1, 'Poné un nombre (ej. "Visa Oro")').max(60),
  entidad: optionalText(),
  saldo: moneyField('Ingresá el saldo actual').refine((v) => v > 0, 'Debe ser mayor a Q0'),
  tasa_anual: optionalPercentField(),
  cuota_mensual: optionalMoneyField(),
  seguro_mensual: optionalMoneyField(),
  dia_pago: optionalIntField(1, 31),
  dia_corte: optionalIntField(1, 31),
  limite_credito: optionalMoneyField(),
  cuotas_totales: optionalIntField(1, 600),
  cuota_actual: optionalIntField(0, 600),
})
type DeudaInput = z.input<typeof deudaSchema>

const emptyDeuda = (tipo: 'tarjeta' | 'prestamo'): DeudaInput => ({
  tipo,
  nombre: '',
  entidad: '',
  saldo: '',
  tasa_anual: '',
  cuota_mensual: '',
  seguro_mensual: '',
  dia_pago: '',
  dia_corte: '',
  limite_credito: '',
  cuotas_totales: '',
  cuota_actual: '',
})

const toDeudaInput = (d: WizardDebt): DeudaInput => ({
  tipo: d.tipo,
  nombre: d.nombre,
  entidad: d.entidad ?? '',
  saldo: toInput(d.saldo),
  tasa_anual: toInput(d.tasa_anual, 100),
  cuota_mensual: toInput(d.cuota_mensual),
  seguro_mensual: toInput(d.seguro_mensual),
  dia_pago: toInput(d.dia_pago),
  dia_corte: toInput(d.dia_corte),
  limite_credito: toInput(d.limite_credito),
  cuotas_totales: toInput(d.cuotas_totales),
  cuota_actual: toInput(d.cuota_actual),
})

function DeudaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: DeudaInput
  onSave: (d: Omit<WizardDebt, 'key'>) => void
  onCancel?: () => void
}) {
  const form = useForm<DeudaInput, unknown, z.output<typeof deudaSchema>>({
    resolver: zodResolver(deudaSchema),
    defaultValues: initial,
  })
  const tipo = useWatch({ control: form.control, name: 'tipo' })
  const e = form.formState.errors
  const save = form.handleSubmit((v) => {
    onSave({ ...v, nombre: v.nombre, entidad: v.entidad })
    form.reset(emptyDeuda(v.tipo))
  })

  return (
    <form noValidate onSubmit={save} className="grid gap-3 rounded-xl border p-3">
      <div role="group" aria-label="Plantilla" className="grid grid-cols-2 gap-2">
        <ChoiceChip selected={tipo === 'tarjeta'} onClick={() => form.setValue('tipo', 'tarjeta')}>
          <CreditCard className="mr-1.5 inline size-4" aria-hidden /> Tarjeta
        </ChoiceChip>
        <ChoiceChip selected={tipo === 'prestamo'} onClick={() => form.setValue('tipo', 'prestamo')}>
          <Landmark className="mr-1.5 inline size-4" aria-hidden /> Préstamo
        </ChoiceChip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="d-nombre" label="Nombre" error={e.nombre?.message}>
          <Input
            id="d-nombre"
            className="h-11"
            placeholder={tipo === 'tarjeta' ? 'Visa Oro' : 'Préstamo moto'}
            {...form.register('nombre')}
          />
        </Field>
        <Field id="d-entidad" label="Banco (opcional)">
          <Input id="d-entidad" className="h-11" {...form.register('entidad')} />
        </Field>
        <Field id="d-saldo" label="Saldo actual" error={e.saldo?.message}>
          <MoneyInput id="d-saldo" {...form.register('saldo')} />
        </Field>
        <Field
          id="d-cuota"
          label={tipo === 'tarjeta' ? 'Pago mensual' : 'Cuota mensual'}
          error={e.cuota_mensual?.message}
        >
          <MoneyInput id="d-cuota" {...form.register('cuota_mensual')} />
        </Field>
        <Field id="d-tasa" label="Tasa anual (%)" error={e.tasa_anual?.message} hint="Vacío = PENDIENTE">
          <Input
            id="d-tasa"
            inputMode="decimal"
            className="tabular h-11"
            placeholder="60"
            {...form.register('tasa_anual')}
          />
        </Field>
        <Field id="d-dia" label="Día de pago" error={e.dia_pago?.message}>
          <Input id="d-dia" inputMode="numeric" className="tabular h-11" {...form.register('dia_pago')} />
        </Field>
        {tipo === 'tarjeta' ? (
          <>
            <Field id="d-seguro" label="Seguro mensual" error={e.seguro_mensual?.message} hint="Vacío = PENDIENTE">
              <MoneyInput id="d-seguro" {...form.register('seguro_mensual')} />
            </Field>
            <Field id="d-limite" label="Límite de crédito" error={e.limite_credito?.message}>
              <MoneyInput id="d-limite" {...form.register('limite_credito')} />
            </Field>
          </>
        ) : (
          <>
            <Field id="d-totales" label="Cuotas totales" error={e.cuotas_totales?.message}>
              <Input id="d-totales" inputMode="numeric" className="tabular h-11" {...form.register('cuotas_totales')} />
            </Field>
            <Field id="d-actual" label="Cuota actual" error={e.cuota_actual?.message}>
              <Input id="d-actual" inputMode="numeric" className="tabular h-11" {...form.register('cuota_actual')} />
            </Field>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="outline">
          {onCancel ? (
            'Guardar cambios'
          ) : (
            <>
              <Plus /> Agregar deuda
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

function DeudasStep({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Agregá cada tarjeta y préstamo con el saldo de tu último estado de cuenta. Si no sabés la tasa o el seguro,
        dejalos vacíos: quedan como PENDIENTE.
      </p>
      {state.deudas.length > 0 && (
        <ul className="grid gap-2">
          {state.deudas.map((d) =>
            editing === d.key ? (
              <li key={d.key}>
                <DeudaForm
                  initial={toDeudaInput(d)}
                  onCancel={() => setEditing(null)}
                  onSave={(v) => {
                    setState({ deudas: state.deudas.map((x) => (x.key === d.key ? { ...v, key: d.key } : x)) })
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <li key={d.key} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
                {d.tipo === 'tarjeta' ? (
                  <CreditCard className="text-muted-foreground size-4 shrink-0" aria-hidden />
                ) : (
                  <Landmark className="text-muted-foreground size-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.nombre}</p>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                    {d.tasa_anual == null ? <PendingBadge short /> : `${formatPercent(d.tasa_anual)} anual`}
                    {d.cuota_mensual != null && ` · cuota ${formatGTQ(d.cuota_mensual)}`}
                  </p>
                </div>
                <Money value={d.saldo} className="font-medium" />
                <Button size="icon" variant="ghost" aria-label={`Editar ${d.nombre}`} onClick={() => setEditing(d.key)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar ${d.nombre}`}
                  onClick={() =>
                    setState({
                      deudas: state.deudas.filter((x) => x.key !== d.key),
                      cuotas: state.cuotas.filter((c) => c.debt !== d.key),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      {editing == null && (
        <DeudaForm
          initial={emptyDeuda('tarjeta')}
          onSave={(v) => setState({ deudas: [...state.deudas, { ...v, key: `w${Date.now().toString(36)}` }] })}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ paso 4: cuotas fuera de saldo */

const cuotaSchema = z
  .object({
    debt: z.string().min(1, 'Elegí la tarjeta'),
    descripcion: z.string().trim().min(1, 'Describí la compra (ej. "Celular en visacuotas")').max(60),
    monto_cuota: moneyField('Ingresá el monto de cada cuota').refine((v) => v > 0, 'Debe ser mayor a Q0'),
    cuotas_totales: optionalIntField(1, 120).pipe(z.number({ invalid_type_error: 'Requerido' })),
    cuotas_cobradas: optionalIntField(0, 120).transform((v) => v ?? 0),
  })
  .refine((d) => d.cuotas_cobradas <= d.cuotas_totales, {
    path: ['cuotas_cobradas'],
    message: 'No puede superar el total',
  })

function CuotasStep({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const tarjetas = state.deudas.filter((d) => d.tipo === 'tarjeta')
  const form = useForm<z.input<typeof cuotaSchema>, unknown, z.output<typeof cuotaSchema>>({
    resolver: zodResolver(cuotaSchema),
    defaultValues: {
      debt: tarjetas[0]?.key ?? '',
      descripcion: '',
      monto_cuota: '',
      cuotas_totales: '',
      cuotas_cobradas: '',
    },
  })
  const e = form.formState.errors
  const nombre = new Map(state.deudas.map((d) => [d.key, d.nombre]))
  const add = form.handleSubmit((v) => {
    setState({ cuotas: [...state.cuotas, v] })
    form.reset({ debt: v.debt, descripcion: '', monto_cuota: '', cuotas_totales: '', cuotas_cobradas: '' })
  })

  if (tarjetas.length === 0) {
    return <p className="text-muted-foreground text-sm">No agregaste tarjetas: podés seguir al siguiente paso.</p>
  }
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Intracuotas, visacuotas o extrafinanciamientos que el banco todavía no cobra y no aparecen en el saldo. Si no
        tenés, seguí al siguiente paso.
      </p>
      {state.cuotas.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {state.cuotas.map((c, i) => (
            <li key={`${c.descripcion}${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.descripcion}</p>
                <p className="text-muted-foreground text-xs">
                  {nombre.get(c.debt)} · {c.cuotas_totales - c.cuotas_cobradas} cuotas pendientes de{' '}
                  {formatGTQ(c.monto_cuota)}
                </p>
              </div>
              <Money value={c.monto_cuota * (c.cuotas_totales - c.cuotas_cobradas)} className="font-medium" />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Quitar ${c.descripcion}`}
                onClick={() => setState({ cuotas: state.cuotas.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form noValidate onSubmit={add} className="grid gap-3 rounded-xl border p-3">
        <div className="grid grid-cols-2 gap-3">
          <Field id="c-debt" label="Tarjeta" error={e.debt?.message}>
            <select
              id="c-debt"
              className="border-input bg-background h-11 rounded-lg border px-3 text-sm"
              {...form.register('debt')}
            >
              {tarjetas.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-desc" label="Descripción" error={e.descripcion?.message}>
            <Input id="c-desc" className="h-11" {...form.register('descripcion')} />
          </Field>
          <Field id="c-monto" label="Monto de cada cuota" error={e.monto_cuota?.message}>
            <MoneyInput id="c-monto" {...form.register('monto_cuota')} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field id="c-tot" label="Total" error={e.cuotas_totales?.message}>
              <Input id="c-tot" inputMode="numeric" className="tabular h-11" {...form.register('cuotas_totales')} />
            </Field>
            <Field id="c-cob" label="Cobradas" error={e.cuotas_cobradas?.message}>
              <Input id="c-cob" inputMode="numeric" className="tabular h-11" {...form.register('cuotas_cobradas')} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline">
            <Plus /> Agregar cuota
          </Button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ paso 5: plan */

function PlanStep({
  state,
  estrategia,
  setEstrategia,
  presupuesto,
  setPresupuesto,
}: {
  state: WizardState
  estrategia: Strategy
  setEstrategia: (s: Strategy) => void
  presupuesto: string
  setPresupuesto: (s: string) => void
}) {
  const monto = parseAmount(presupuesto)
  const valido = monto != null && !Number.isNaN(monto) && monto > 0
  const libre = monthlyRoom(state)
  const cuotas = sumCuotas(state.deudas)
  const preview = useMemo(
    () =>
      valido
        ? buildWizardPayload(state, { estrategia, presupuestoDeudas: monto }, todayISO(), currentPeriod()).plans[0]
        : null,
    [state, estrategia, monto, valido],
  )
  const resumen = preview?.supuestos?.resumen

  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Estrategia</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ESTRATEGIA_LABEL) as Strategy[]).map((s) => (
            <ChoiceChip key={s} selected={estrategia === s} className="text-center" onClick={() => setEstrategia(s)}>
              {ESTRATEGIA_LABEL[s]}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      <Field
        id="presupuesto"
        label="¿Cuánto podés pagar a deudas cada mes?"
        error={presupuesto !== '' && !valido ? 'Ingresá un monto mayor a Q0' : undefined}
        hint={`Tus cuotas suman ${formatGTQ(cuotas)}${libre != null ? ` y te quedan ${formatGTQ(libre)} después de gastos fijos` : ''}.`}
      >
        <MoneyInput id="presupuesto" large value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
      </Field>
      {resumen && (
        <section aria-live="polite" className="bg-ink text-ink-foreground grid gap-2 rounded-2xl p-4">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Flag className="text-lime size-5" aria-hidden />
            {resumen.periodo_libre
              ? `Libre de deudas en ${formatPeriodLong(resumen.periodo_libre)}`
              : 'Con este presupuesto no terminás en 10 años'}
          </p>
          <p className="text-ink-foreground/70 text-sm">
            Deuda real hoy {formatGTQ(resumen.deuda_inicial)} · intereses y cargos ≈{' '}
            {formatGTQ(resumen.total_interes_cargos)}
          </p>
          {preview.supuestos!.advertencias.length > 0 && (
            <ul className="text-ink-foreground/70 list-disc pl-5 text-xs">
              {preview.supuestos!.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ página */

const EMPTY: WizardState = { nombre: '', ingreso: null, gastosFijos: [], deudas: [], cuotas: [] }

export function WizardPage() {
  const navigate = useNavigate()
  const importPayload = useImportPayload()
  const [paso, setPaso] = useState(0)
  const [state, setStateRaw] = useState<WizardState>(EMPTY)
  const [estrategia, setEstrategia] = useState<Strategy>('avalancha')
  const [presupuesto, setPresupuesto] = useState('')
  const setState = (s: Partial<WizardState>) => setStateRaw((prev) => ({ ...prev, ...s }))

  const next = () => {
    if (paso === 2 && state.deudas.length === 0) {
      toast.error('Agregá al menos una deuda')
      return
    }
    if (paso === 3 && presupuesto === '') setPresupuesto(toInput(sumCuotas(state.deudas)))
    setPaso((p) => Math.min(p + 1, PASOS.length - 1))
  }

  const finish = () => {
    const monto = parseAmount(presupuesto)
    if (monto == null || Number.isNaN(monto) || monto <= 0) {
      toast.error('Ingresá cuánto podés pagar a deudas cada mes')
      return
    }
    const payload = buildWizardPayload(state, { estrategia, presupuestoDeudas: monto }, todayISO(), currentPeriod())
    importPayload.mutate(
      { payload },
      {
        onSuccess: () => {
          toast.success('¡Listo! Tu plan quedó activo.')
          navigate('/', { replace: true })
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Button variant="ghost" size="sm" className="justify-self-start" asChild>
        <Link to="/bienvenida">
          <ArrowLeft /> Opciones de inicio
        </Link>
      </Button>
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p} aria-current={i === paso ? 'step' : undefined} className="grid gap-1">
            <span className={cn('h-1.5 rounded-full', i <= paso ? 'bg-primary' : 'bg-muted')} aria-hidden />
            <span className={cn('hidden text-xs sm:block', i === paso ? 'font-medium' : 'text-muted-foreground')}>
              {p}
            </span>
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader>
          <CardDescription>
            Paso {paso + 1} de {PASOS.length}
          </CardDescription>
          <CardTitle className="text-xl">{PASOS[paso]}</CardTitle>
        </CardHeader>
        <CardContent>
          {paso === 0 && (
            <IngresoStep
              state={state}
              onNext={(s) => {
                setState(s)
                setPaso(1)
              }}
            />
          )}
          {paso === 1 && <FijosStep state={state} setState={setState} />}
          {paso === 2 && <DeudasStep state={state} setState={setState} />}
          {paso === 3 && <CuotasStep state={state} setState={setState} />}
          {paso === 4 && (
            <PlanStep
              state={state}
              estrategia={estrategia}
              setEstrategia={setEstrategia}
              presupuesto={presupuesto}
              setPresupuesto={setPresupuesto}
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
            <ArrowLeft /> Atrás
          </Button>
          {paso === 0 ? (
            <Button type="submit" form="paso">
              Siguiente <ArrowRight />
            </Button>
          ) : paso < PASOS.length - 1 ? (
            <Button onClick={next}>
              Siguiente <ArrowRight />
            </Button>
          ) : (
            <Button onClick={finish} disabled={importPayload.isPending}>
              {importPayload.isPending ? <Loader2 className="animate-spin" /> : <Flag />}
              Crear mi plan
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
