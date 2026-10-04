import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Gift, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
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
import { Skeleton } from '@/components/ui/skeleton'
import { addMonths } from '@/lib/finance/period'
import { currentPeriod, formatPeriod } from '@/lib/format'
import { dateField, moneyField, toInput } from '@/lib/forms'
import { useDeleteExtraIncome, useExtraIncomes, useSaveExtraIncome, type ExtraIncome } from './api'

/** Ingresos extra habituales en Guatemala: aguinaldo (diciembre) y Bono 14 (julio). */
const SUGERIDOS = [
  { concepto: 'Aguinaldo', mes: 12 },
  { concepto: 'Bono 14', mes: 7 },
] as const

const schema = z.object({
  concepto: z.string().trim().min(1, 'Poné un nombre (ej. Aguinaldo)').max(60),
  periodo: dateField('Elegí el mes'),
  monto: moneyField('Ingresá el monto').refine((v) => v > 0, 'Debe ser mayor a cero'),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

/** Próximo período (desde el actual) que cae en el mes indicado. */
function nextPeriodForMonth(mes: number): string {
  const actual = currentPeriod()
  for (let i = 0; i < 12; i++) {
    const p = addMonths(actual, i)
    if (Number(p.slice(5, 7)) === mes) return p
  }
  return actual
}

function IncomeDialog({
  income,
  open,
  onOpenChange,
}: {
  income: ExtraIncome | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const save = useSaveExtraIncome()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    values: {
      concepto: income?.concepto ?? '',
      periodo: income?.periodo ?? currentPeriod(),
      monto: toInput(income?.monto),
    },
  })
  const e = form.formState.errors
  const concepto = useWatch({ control: form.control, name: 'concepto' })
  const periodos = Array.from({ length: 15 }, (_, i) => addMonths(currentPeriod(), i - 2))

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: income?.id, values })
      toast.success(`${values.concepto} de ${formatPeriod(values.periodo)} guardado`)
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
            <DialogTitle>{income ? 'Editar ingreso extra' : 'Nuevo ingreso extra'}</DialogTitle>
            <DialogDescription>Suma al flujo libre de ese mes y ayuda a cubrir pagos únicos.</DialogDescription>
          </DialogHeader>
          {!income && (
            <div role="group" aria-label="Sugerencias" className="flex flex-wrap gap-2">
              {SUGERIDOS.map((s) => (
                <ChoiceChip
                  key={s.concepto}
                  selected={concepto === s.concepto}
                  className="py-2"
                  onClick={() => {
                    form.setValue('concepto', s.concepto, { shouldValidate: true })
                    form.setValue('periodo', nextPeriodForMonth(s.mes))
                  }}
                >
                  {s.concepto}
                </ChoiceChip>
              ))}
            </div>
          )}
          <Field id="concepto" label="Concepto" error={e.concepto?.message}>
            <Input id="concepto" className="h-11" {...form.register('concepto')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="periodo" label="Mes" error={e.periodo?.message}>
              <select
                id="periodo"
                className="border-input bg-background h-11 rounded-lg border px-3 text-sm"
                {...form.register('periodo')}
              >
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    {formatPeriod(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="monto" label="Monto neto" error={e.monto?.message}>
              <MoneyInput id="monto" {...form.register('monto')} />
            </Field>
          </div>
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

export function ExtraIncomePage() {
  const incomes = useExtraIncomes()
  const remove = useDeleteExtraIncome()
  const [editing, setEditing] = useState<ExtraIncome | null>(null)
  const [open, setOpen] = useState(false)
  const openDialog = (i: ExtraIncome | null) => {
    setEditing(i)
    setOpen(true)
  }
  const actual = currentPeriod()

  return (
    <>
      <PageHeader
        title="Ingresos extra"
        description="Aguinaldo, Bono 14 y otros ingresos de un mes."
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
      {incomes.error && <ErrorState error={incomes.error} />}
      {!incomes.data && !incomes.error && <Skeleton className="h-40 rounded-xl" />}
      {incomes.data?.length === 0 && (
        <EmptyState
          icon={Gift}
          title="Sin ingresos extra"
          description="Registrá tu aguinaldo de diciembre para ver si cubre los pagos grandes."
          action={<Button onClick={() => openDialog(null)}>Agregar aguinaldo</Button>}
        />
      )}
      {incomes.data && incomes.data.length > 0 && (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {incomes.data.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                <span className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-lg">
                  <Gift className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{x.concepto}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatPeriod(x.periodo)}
                    {x.periodo > actual ? ' · próximo' : ''}
                  </p>
                </div>
                <Money value={x.monto} className="text-success text-sm font-medium" />
                <Button size="icon" variant="ghost" aria-label={`Editar ${x.concepto}`} onClick={() => openDialog(x)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Borrar ${x.concepto}`}
                  onClick={() => remove.mutate(x.id, { onError: (err) => toast.error(err.message) })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <IncomeDialog income={editing} open={open} onOpenChange={setOpen} />
    </>
  )
}
