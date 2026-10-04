import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarClock, CheckCircle2, HandCoins, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Field, MoneyInput } from '@/components/form'
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
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { monthlyInterest, owedAt, receivableStatus, type ReceivableStatus } from '@/lib/finance/receivable'
import { formatDate, formatMoney, formatPercent, todayISO } from '@/lib/format'
import { dateField, moneyField, optionalPercentField, optionalText, parseAmount, toInput } from '@/lib/forms'
import { cn } from '@/lib/utils'
import {
  useAddReceivablePayment,
  useDeleteReceivable,
  useDeleteReceivablePayment,
  useReceivables,
  useSaveReceivable,
  type Receivable,
} from './api'

const meses = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`
const terms = (r: Receivable) => ({ monto: r.monto, tasaMensual: r.tasa_mensual, fechaPrestamo: r.fecha_prestamo })

/* ------------------------------------------------------------------ préstamo */

const schema = z.object({
  persona: z.string().trim().min(1, '¿Quién te debe?').max(60),
  monto: moneyField('Ingresá cuánto prestaste').refine((v) => v > 0, 'Debe ser mayor a cero'),
  fecha_prestamo: dateField('¿Cuándo lo prestaste?'),
  tasa_mensual: optionalPercentField(),
  notas: optionalText(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function ReceivableDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Receivable | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const save = useSaveReceivable()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      persona: item?.persona ?? '',
      monto: toInput(item?.monto),
      fecha_prestamo: item?.fecha_prestamo ?? todayISO(),
      tasa_mensual: toInput(item?.tasa_mensual, 100),
      notas: item?.notas ?? '',
    },
  })
  const e = form.formState.errors
  const [montoTxt, tasaTxt] = useWatch({ control: form.control, name: ['monto', 'tasa_mensual'] })
  const monto = parseAmount(montoTxt ?? '')
  const tasa = parseAmount(tasaTxt ?? '')
  const interes =
    monto != null && !Number.isNaN(monto) && tasa != null && !Number.isNaN(tasa)
      ? monthlyInterest({ monto, tasaMensual: tasa / 100 })
      : null

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: item?.id, values })
      toast.success(`Préstamo a ${values.persona} guardado`)
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{item ? 'Editar préstamo' : 'Nuevo préstamo'}</DialogTitle>
            <DialogDescription>
              El interés se cobra sobre lo prestado por cada mes iniciado, hasta que te paguen todo.
            </DialogDescription>
          </DialogHeader>
          <Field id="persona" label="Persona" error={e.persona?.message}>
            <Input id="persona" className="h-11" {...form.register('persona')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="monto" label="Prestaste" error={e.monto?.message}>
              <MoneyInput id="monto" {...form.register('monto')} />
            </Field>
            <Field id="fecha_prestamo" label="Fecha" error={e.fecha_prestamo?.message}>
              <Input id="fecha_prestamo" type="date" className="h-11" {...form.register('fecha_prestamo')} />
            </Field>
          </div>
          <Field
            id="tasa_mensual"
            label="Interés mensual (%)"
            error={e.tasa_mensual?.message}
            hint={
              interes != null && interes > 0
                ? `= ${formatMoney(interes)} por mes. Vacío = sin interés.`
                : 'Ej. 10 = 10 % al mes. Vacío = sin interés.'
            }
          >
            <Input
              id="tasa_mensual"
              inputMode="decimal"
              className="tabular h-11"
              placeholder="10"
              aria-describedby="tasa_mensual-msg"
              {...form.register('tasa_mensual')}
            />
          </Field>
          <Field id="notas" label="Notas (opcional)">
            <Input id="notas" className="h-11" {...form.register('notas')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ cobro */

const cobroSchema = z.object({
  fecha: dateField('¿Cuándo te pagaron?'),
  monto: moneyField('Ingresá cuánto te pagaron').refine((v) => v > 0, 'Debe ser mayor a cero'),
  notas: optionalText(),
})
type CobroInput = z.input<typeof cobroSchema>
type CobroOutput = z.output<typeof cobroSchema>

function CobroDialog({ item, onClose }: { item: Receivable | null; onClose: () => void }) {
  const add = useAddReceivablePayment()
  const hoy = todayISO()
  const pendienteHoy = item ? receivableStatus(terms(item), item.cobros, hoy).pendiente : 0
  const form = useForm<CobroInput, unknown, CobroOutput>({
    resolver: zodResolver(cobroSchema),
    values: { fecha: hoy, monto: toInput(pendienteHoy), notas: '' },
  })
  const e = form.formState.errors
  const fecha = useWatch({ control: form.control, name: 'fecha' })
  // Lo que debe a la fecha elegida: capital + interés de los meses iniciados − lo ya cobrado antes.
  const debeEnFecha = useMemo(() => {
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return null
    const previo = item.cobros.filter((c) => c.fecha <= fecha).reduce((a, c) => a + Math.round(c.monto * 100), 0) / 100
    return Math.max(0, Math.round((owedAt(terms(item), fecha) - previo) * 100) / 100)
  }, [item, fecha])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!item) return
    try {
      await add.mutateAsync({ ...values, receivable_id: item.id })
      const despues = receivableStatus(terms(item), [...item.cobros, values], todayISO())
      toast.success(
        despues.liquidado
          ? `${item.persona} terminó de pagar. Ganaste ${formatMoney(despues.interesGenerado)} de interés.`
          : `Cobro de ${formatMoney(values.monto)} registrado. Falta ${formatMoney(despues.pendiente)}.`,
      )
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  })

  return (
    <Dialog open={item != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {item && (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Cobro de {item.persona}</DialogTitle>
              <DialogDescription>
                Un abono parcial resta de lo que te deben; el interés sigue corriendo sobre lo prestado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field id="cobro-fecha" label="Fecha" error={e.fecha?.message}>
                <Input id="cobro-fecha" type="date" className="h-11" {...form.register('fecha')} />
              </Field>
              <Field id="cobro-monto" label="Monto" error={e.monto?.message}>
                <MoneyInput id="cobro-monto" autoFocus {...form.register('monto')} />
              </Field>
            </div>
            {debeEnFecha != null && (
              <p className="bg-muted/60 rounded-xl p-3 text-sm">
                Al {formatDate(fecha)} te debe <Money value={debeEnFecha} className="font-semibold" />
                {item.tasa_mensual != null && (
                  <span className="text-muted-foreground">
                    {' '}
                    (capital + {meses(receivableStatus(terms(item), [], fecha).meses)} de interés − lo ya cobrado)
                  </span>
                )}
                .
              </p>
            )}
            <Field id="cobro-notas" label="Notas (opcional)">
              <Input
                id="cobro-notas"
                className="h-11"
                placeholder="Quincena, transferencia…"
                {...form.register('notas')}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Registrar cobro
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ lista */

function ReceivableItem({
  item,
  status,
  onEdit,
  onCobro,
}: {
  item: Receivable
  status: ReceivableStatus
  onEdit: () => void
  onCobro: () => void
}) {
  const remove = useDeleteReceivable()
  const removeCobro = useDeleteReceivablePayment()
  const avance = status.total > 0 ? Math.min(100, (status.cobrado / status.total) * 100) : 0

  return (
    <li className="grid gap-3 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.persona}</p>
          <p className="text-muted-foreground text-xs">
            Prestaste {formatMoney(item.monto)} el {formatDate(item.fecha_prestamo)}
            {item.tasa_mensual != null
              ? ` · ${formatPercent(item.tasa_mensual)} mensual (${formatMoney(status.interesMensual)})`
              : ' · sin interés'}
          </p>
        </div>
        <div className="text-right">
          {status.liquidado ? (
            <span className="text-success inline-flex items-center gap-1 text-sm font-medium">
              <CheckCircle2 className="size-4" aria-hidden /> Pagado
            </span>
          ) : (
            <>
              <Money value={status.pendiente} className="text-lg font-semibold" />
              <p className="text-muted-foreground text-xs">te debe hoy</p>
            </>
          )}
        </div>
      </div>

      <Progress value={avance} aria-label={`Cobrado de ${item.persona}`} className="h-1.5" />

      <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{status.liquidado ? 'Duró' : 'Van'}</dt>
          <dd className="font-medium">{item.tasa_mensual != null ? meses(status.meses) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total con interés</dt>
          <dd className="font-medium">{formatMoney(status.total)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="font-medium">{formatMoney(status.cobrado)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Interés ganado</dt>
          <dd className="text-success font-medium">{formatMoney(status.gananciaCobrada)}</dd>
        </div>
      </dl>

      {status.proximoAumento && (
        <p className="text-warning-foreground flex items-center gap-1.5 text-xs">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          Desde el {formatDate(status.proximoAumento)} te deberá{' '}
          {formatMoney(Math.round((status.pendiente + status.interesMensual) * 100) / 100)}.
        </p>
      )}
      {item.notas && <p className="text-muted-foreground text-xs">{item.notas}</p>}

      {item.cobros.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            {item.cobros.length} {item.cobros.length === 1 ? 'cobro' : 'cobros'}
          </summary>
          <ul className="mt-1.5 divide-y rounded-lg border">
            {item.cobros.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="tabular text-muted-foreground w-24 text-xs">{formatDate(c.fecha)}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{c.notas}</span>
                <Money value={c.monto} className="text-success text-sm" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Borrar cobro del ${formatDate(c.fecha)}`}
                  onClick={() => removeCobro.mutate(c.id, { onError: (err) => toast.error(err.message) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        {!status.liquidado && (
          <Button size="sm" onClick={onCobro}>
            <HandCoins /> Registrar cobro
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Editar ${item.persona}`}>
          <Pencil /> Editar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={`Borrar ${item.persona}`}>
              <Trash2 /> Borrar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar el préstamo a {item.persona}?</AlertDialogTitle>
              <AlertDialogDescription>Se borran también sus cobros. No se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => remove.mutate(item.id, { onError: (err) => toast.error(err.message) })}
              >
                Borrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

export function ReceivablesPage() {
  const items = useReceivables()
  const [editing, setEditing] = useState<Receivable | null>(null)
  const [open, setOpen] = useState(false)
  const [cobrando, setCobrando] = useState<Receivable | null>(null)
  const hoy = todayISO()
  const openDialog = (r: Receivable | null) => {
    setEditing(r)
    setOpen(true)
  }

  const rows = useMemo(
    () => (items.data ?? []).map((r) => ({ item: r, status: receivableStatus(terms(r), r.cobros, hoy) })),
    [items.data, hoy],
  )
  // Pendientes primero; los pagados al final.
  const ordenados = [...rows].sort((a, b) => Number(a.status.liquidado) - Number(b.status.liquidado))
  const porCobrar = rows.reduce((acc, r) => acc + Math.round(r.status.pendiente * 100), 0) / 100
  const ganado = rows.reduce((acc, r) => acc + Math.round(r.status.gananciaCobrada * 100), 0) / 100

  return (
    <>
      <PageHeader
        title="Dinero que me deben"
        description="Préstamos a terceros, con interés mensual y abonos."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mas">
                <ArrowLeft /> Más
              </Link>
            </Button>
            <Button onClick={() => openDialog(null)}>
              <Plus /> Nuevo
            </Button>
          </div>
        }
      />
      {items.error && <ErrorState error={items.error} />}
      {!items.data && !items.error && <Skeleton className="h-40 rounded-xl" />}
      {items.data?.length === 0 && (
        <EmptyState
          icon={HandCoins}
          title="Nadie te debe"
          description="Si le prestaste a alguien, anotalo con su interés mensual para saber cuánto te deben cada día."
          action={<Button onClick={() => openDialog(null)}>Agregar préstamo</Button>}
        />
      )}
      {rows.length > 0 && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Card size="sm" className="px-4">
              <p className="text-muted-foreground text-xs">Por cobrar hoy</p>
              <Money value={porCobrar} className="text-xl font-semibold" />
            </Card>
            <Card size="sm" className="px-4">
              <p className="text-muted-foreground text-xs">Interés ganado (cobrado)</p>
              <Money value={ganado} className={cn('text-xl font-semibold', ganado > 0 && 'text-success')} />
            </Card>
          </div>
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {ordenados.map(({ item, status }) => (
                <ReceivableItem
                  key={item.id}
                  item={item}
                  status={status}
                  onEdit={() => openDialog(item)}
                  onCobro={() => setCobrando(item)}
                />
              ))}
            </ul>
          </Card>
        </div>
      )}
      <ReceivableDialog item={editing} open={open} onOpenChange={setOpen} />
      <CobroDialog item={cobrando} onClose={() => setCobrando(null)} />
    </>
  )
}
