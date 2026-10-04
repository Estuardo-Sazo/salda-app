import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Flag, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ErrorState, Money } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useActivePlan, usePeriodPayments } from '@/features/common/queries'
import { projectPlan, type Strategy } from '@/lib/finance'
import { monthsBetween } from '@/lib/finance/period'
import { currentPeriod, formatPeriod, formatPeriodLong } from '@/lib/format'
import { moneyField, parseAmount, toInput } from '@/lib/forms'
import { usePlanSources, useSavePlan } from './api'
import {
  buildPlanInput,
  buildSavePlanPayload,
  defaultPlanName,
  defaultPlanStart,
  ESTRATEGIA_LABEL,
  suggestedBudget,
  type PlanSources,
} from './plan-input'

const ESTRATEGIA_HINT: Record<Strategy, string> = {
  avalancha: 'El sobrante va a la deuda con mayor tasa. Paga menos intereses.',
  bola_nieve: 'El sobrante va a la deuda más pequeña. Liquida deudas antes.',
  cuotas_fijas: 'Solo las cuotas; lo que se libera queda como flujo libre.',
}

const schema = z.object({
  nombre: z.string().trim().max(80),
  estrategia: z.enum(['avalancha', 'bola_nieve', 'cuotas_fijas']),
  presupuesto: moneyField('Ingresá el presupuesto mensual para deudas').refine((v) => v > 0, 'Debe ser mayor a cero'),
  abonoExtra: moneyField(),
  activo: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const amountOr0 = (raw: string) => {
  const n = parseAmount(raw)
  return n == null || Number.isNaN(n) ? 0 : n
}

function GenerateForm({ sources, onDone }: { sources: PlanSources; onDone: () => void }) {
  const periodoActual = currentPeriod()
  const fechaInicio = defaultPlanStart(periodoActual)
  const active = useActivePlan().data
  const payments = usePeriodPayments(periodoActual)
  const save = useSavePlan()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      estrategia: active?.plan.estrategia ?? 'avalancha',
      presupuesto: toInput(suggestedBudget(sources.debts, active?.plan.presupuesto_deudas)),
      abonoExtra: toInput(active?.plan.abono_extra ?? 0),
      activo: true,
    },
  })
  const [estrategia, presupuesto, abonoExtra] = useWatch({
    control: form.control,
    name: ['estrategia', 'presupuesto', 'abonoExtra'],
  })

  const preview = useMemo(() => {
    const p = amountOr0(presupuesto)
    if (p <= 0) return null
    const input = buildPlanInput(sources, {
      estrategia,
      presupuestoDeudas: p,
      abonoExtra: amountOr0(abonoExtra),
      fechaInicio,
      periodoActual,
    })
    return { input, result: projectPlan(input) }
  }, [sources, estrategia, presupuesto, abonoExtra, fechaInicio, periodoActual])

  const pagadas = new Set(payments.data?.map((p) => p.debt_id))
  const sinPago = sources.debts.filter(
    (d) => d.estado === 'activa' && !d.pago_unico && (d.cuota_mensual ?? 0) > 0 && !pagadas.has(d.debt_id),
  )
  const resumenActivo = active?.plan.supuestos?.resumen

  const onSubmit = form.handleSubmit(async (values) => {
    if (!preview) return
    const nombre = values.nombre || defaultPlanName(values.estrategia, fechaInicio)
    try {
      await save.mutateAsync(
        buildSavePlanPayload(preview.input, preview.result, { nombre, activo: values.activo, periodoActual }),
      )
      toast.success(values.activo ? `${nombre} es tu nuevo plan activo` : `${nombre} guardado`)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  })

  const e = form.formState.errors
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Nuevo plan</DialogTitle>
        <DialogDescription>
          Arranca en {formatPeriodLong(fechaInicio)} con el saldo actual de tus deudas. Los planes anteriores se
          conservan.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Estrategia</legend>
        <Controller
          control={form.control}
          name="estrategia"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(ESTRATEGIA_LABEL) as Strategy[]).map((s) => (
                <ChoiceChip key={s} selected={field.value === s} onClick={() => field.onChange(s)}>
                  <span className="block font-medium">{ESTRATEGIA_LABEL[s]}</span>
                  <span className="text-muted-foreground block text-xs">{ESTRATEGIA_HINT[s]}</span>
                </ChoiceChip>
              ))}
            </div>
          )}
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field id="presupuesto" label="Presupuesto mensual" error={e.presupuesto?.message}>
          <MoneyInput id="presupuesto" {...form.register('presupuesto')} />
        </Field>
        <Field id="abonoExtra" label="Abono extra" error={e.abonoExtra?.message}>
          <MoneyInput id="abonoExtra" {...form.register('abonoExtra')} />
        </Field>
      </div>

      <Field id="nombre" label="Nombre (opcional)" error={e.nombre?.message}>
        <Input
          id="nombre"
          className="h-11"
          placeholder={defaultPlanName(estrategia, fechaInicio)}
          {...form.register('nombre')}
        />
      </Field>

      {preview ? (
        <section aria-live="polite" className="bg-muted/60 grid gap-2 rounded-xl p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Flag className="text-success size-4" aria-hidden />
            {preview.result.periodoLibre
              ? `Libre de deudas en ${formatPeriodLong(preview.result.periodoLibre)} (${preview.result.mesLibre} meses)`
              : 'No se liquida en 10 años con este presupuesto'}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Intereses y cargos</dt>
            <dd className="text-right">
              <Money value={preview.result.totalInteresCargos} />
            </dd>
            <dt className="text-muted-foreground">Total a pagar</dt>
            <dd className="text-right">
              <Money value={preview.result.totalPagado} />
            </dd>
            {resumenActivo?.periodo_libre && preview.result.periodoLibre && (
              <>
                <dt className="text-muted-foreground">vs plan activo</dt>
                <dd className="text-right">
                  {(() => {
                    const d = monthsBetween(resumenActivo.periodo_libre, preview.result.periodoLibre)
                    if (d === 0) return `mismo mes (${formatPeriod(resumenActivo.periodo_libre)})`
                    const n = Math.abs(d)
                    return (
                      <span className={d < 0 ? 'text-success' : 'text-destructive'}>
                        {n} {n === 1 ? 'mes' : 'meses'} {d < 0 ? 'antes' : 'después'}
                      </span>
                    )
                  })()}
                </dd>
              </>
            )}
          </dl>
          {preview.result.advertencias.length > 0 && (
            <ul className="grid gap-1 text-xs">
              {preview.result.advertencias.map((a) => (
                <li key={a} className="text-warning-foreground flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Ingresá un presupuesto para ver la proyección.</p>
      )}

      {sinPago.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Aún no registrás el pago de {formatPeriod(periodoActual)} de {sinPago.map((d) => d.nombre).join(', ')}: el
          plan arranca desde su último saldo registrado.
        </p>
      )}

      <Controller
        control={form.control}
        name="activo"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="activo" className="font-normal">
              Usarlo como meta (plan activo)
            </Label>
            <Switch id="activo" checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting || !preview}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Guardar plan
        </Button>
      </DialogFooter>
    </form>
  )
}

export function GeneratePlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { sources, error } = usePlanSources()
  const active = useActivePlan()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {error ? (
          <ErrorState error={error} />
        ) : sources && active.data !== undefined ? (
          <GenerateForm sources={sources} onDone={() => onOpenChange(false)} />
        ) : (
          <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
            <DialogTitle>Nuevo plan</DialogTitle>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
