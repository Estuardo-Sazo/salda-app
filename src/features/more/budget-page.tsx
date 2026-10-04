import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/app/providers/auth'
import { useProfile } from '@/features/common/queries'
import { CurrencySelect } from '@/components/currency-select'
import { isValidCurrency } from '@/lib/finance/currency'
import { getCurrency, setCurrency } from '@/lib/format'
import { moneyField, toInput } from '@/lib/forms'
import { num, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

type BudgetItem = Omit<Tables<'budget_items'>, 'monto'> & { monto: number }
const budgetKey = ['budget_items', 'lista'] as const

function useBudgetItems() {
  return useQuery({
    queryKey: budgetKey,
    queryFn: async (): Promise<BudgetItem[]> =>
      unwrap(await supabase.from('budget_items').select('*').order('orden').order('created_at')).map((b) => ({
        ...b,
        monto: num(b.monto),
      })),
  })
}

/** Cambiar ingreso o gastos fijos mueve el flujo libre de todos los meses: se refresca todo. */
function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

/* ------------------------------------------------------------------ perfil e ingreso */

const profileSchema = z.object({
  nombre: z.string().trim().max(60),
  ingreso: moneyField('Ingresá tu ingreso mensual neto'),
  moneda: z.string().refine(isValidCurrency, 'Elegí una moneda o escribí un código válido de 3 letras'),
})

function ProfileDialog({
  open,
  onOpenChange,
  nombre,
  ingreso,
  moneda,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  nombre: string | null
  ingreso: number | null
  moneda: string
}) {
  const { user } = useAuth()
  const invalidate = useInvalidateAll()
  const save = useMutation({
    mutationFn: async (v: z.output<typeof profileSchema>) =>
      unwrap(
        await supabase
          .from('profiles')
          .upsert(
            { id: user!.id, nombre: v.nombre || null, ingreso_mensual: v.ingreso, moneda: v.moneda },
            { onConflict: 'id' },
          ),
      ),
    onSuccess: invalidate,
  })
  const form = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { nombre: nombre ?? '', ingreso: toInput(ingreso), moneda },
  })
  const e = form.formState.errors
  const monedaElegida = useWatch({ control: form.control, name: 'moneda' })

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync(v)
      setCurrency(v.moneda)
      toast.success('Perfil actualizado')
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
            <DialogTitle>Perfil e ingreso</DialogTitle>
            <DialogDescription>El ingreso se usa para calcular el flujo libre de cada mes.</DialogDescription>
          </DialogHeader>
          <Field id="perfil-nombre" label="Nombre" error={e.nombre?.message}>
            <Input id="perfil-nombre" className="h-11" autoComplete="given-name" {...form.register('nombre')} />
          </Field>
          <Field
            id="perfil-ingreso"
            label="Ingreso mensual neto"
            error={e.ingreso?.message}
            hint="Aguinaldo y Bono 14 van en Ingresos extra."
          >
            <MoneyInput id="perfil-ingreso" currency={monedaElegida} {...form.register('ingreso')} />
          </Field>
          <Field
            id="perfil-moneda"
            label="Moneda"
            error={e.moneda?.message}
            hint={
              monedaElegida !== moneda
                ? 'Cambiar la moneda no convierte tus montos: solo cambia cómo se muestran.'
                : 'Todos tus montos se muestran en esta moneda.'
            }
          >
            <Controller
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <CurrencySelect id="perfil-moneda" value={field.value} onChange={field.onChange} invalid={!!e.moneda} />
              )}
            />
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

/* ------------------------------------------------------------------ gastos fijos */

const itemSchema = z.object({
  concepto: z.string().trim().min(1, 'Poné un concepto').max(40),
  monto: moneyField('Ingresá el monto').refine((v) => v > 0, 'Debe ser mayor a cero'),
})

function ItemDialog({
  item,
  open,
  onOpenChange,
  nextOrden,
}: {
  item: BudgetItem | null
  open: boolean
  onOpenChange: (o: boolean) => void
  nextOrden: number
}) {
  const invalidate = useInvalidateAll()
  const save = useMutation({
    mutationFn: async (v: z.output<typeof itemSchema>) =>
      item
        ? unwrap(await supabase.from('budget_items').update(v).eq('id', item.id))
        : unwrap(await supabase.from('budget_items').insert({ ...v, orden: nextOrden })),
    onSuccess: invalidate,
  })
  const form = useForm<z.input<typeof itemSchema>, unknown, z.output<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    values: { concepto: item?.concepto ?? '', monto: toInput(item?.monto) },
  })
  const e = form.formState.errors
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync(v)
      toast.success(`${v.concepto} guardado`)
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
            <DialogTitle>{item ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</DialogTitle>
            <DialogDescription>Lo que pagás todos los meses y no es deuda.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <Field id="item-concepto" label="Concepto" error={e.concepto?.message}>
              <Input id="item-concepto" className="h-11" {...form.register('concepto')} />
            </Field>
            <Field id="item-monto" label="Monto" error={e.monto?.message}>
              <MoneyInput id="item-monto" {...form.register('monto')} />
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

export function BudgetPage() {
  const profile = useProfile()
  const items = useBudgetItems()
  const invalidate = useInvalidateAll()
  const [profileOpen, setProfileOpen] = useState(false)
  const [editing, setEditing] = useState<BudgetItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)

  const toggle = useMutation({
    mutationFn: async (b: BudgetItem) =>
      unwrap(await supabase.from('budget_items').update({ activo: !b.activo }).eq('id', b.id)),
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('budget_items').delete().eq('id', id)),
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  })

  const openItem = (b: BudgetItem | null) => {
    setEditing(b)
    setItemOpen(true)
  }
  const ingreso = profile.data?.ingreso_mensual ?? null
  const fijos = (items.data ?? []).filter((b) => b.activo).reduce((a, b) => a + Math.round(b.monto * 100), 0) / 100
  const libre = ingreso != null ? Math.round((ingreso - fijos) * 100) / 100 : null
  const error = profile.error ?? items.error

  return (
    <>
      <PageHeader
        title="Ingreso y gastos fijos"
        description="La base del flujo libre y del presupuesto para deudas."
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/mas">
              <ArrowLeft /> Más
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : !items.data || profile.data === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <Card className="lg:self-start">
            <CardHeader>
              <CardTitle>Ingreso mensual</CardTitle>
              <CardDescription>
                {profile.data?.nombre ?? 'Sin nombre'} · {profile.data?.moneda ?? getCurrency()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                <dt>Ingreso neto</dt>
                <dd className="text-right">{ingreso == null ? '—' : <Money value={ingreso} />}</dd>
                <dt>− Gastos fijos activos</dt>
                <dd className="text-right">
                  <Money value={fijos} />
                </dd>
                <dt className="border-t pt-1.5 font-semibold">Queda para deudas y gastos</dt>
                <dd
                  className={cn(
                    'border-t pt-1.5 text-right font-semibold',
                    libre != null && libre < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {libre == null ? '—' : <Money value={libre} />}
                </dd>
              </dl>
              <Button variant="outline" className="justify-self-start" onClick={() => setProfileOpen(true)}>
                <Pencil /> Editar ingreso, nombre y moneda
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-3">
              <CardTitle>Gastos fijos</CardTitle>
              <CardDescription>Apagá los que ya no pagás sin borrarlos.</CardDescription>
            </CardHeader>
            {items.data.length === 0 ? (
              <CardContent className="pb-4">
                <EmptyState
                  icon={Wallet}
                  title="Sin gastos fijos"
                  description="Comida, servicios, alquiler: lo que pagás cada mes."
                  action={<Button onClick={() => openItem(null)}>Agregar</Button>}
                />
              </CardContent>
            ) : (
              <>
                <ul className="divide-y border-t">
                  {items.data.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Switch
                        checked={b.activo}
                        onCheckedChange={() => toggle.mutate(b)}
                        aria-label={`${b.concepto} ${b.activo ? 'activo' : 'inactivo'}`}
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          !b.activo && 'text-muted-foreground line-through',
                        )}
                      >
                        {b.concepto}
                      </span>
                      <Money value={b.monto} className={cn('text-sm', !b.activo && 'text-muted-foreground')} />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${b.concepto}`}
                        onClick={() => openItem(b)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Borrar ${b.concepto}`}
                        onClick={() => remove.mutate(b.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="border-t p-3">
                  <Button variant="outline" size="sm" onClick={() => openItem(null)}>
                    <Plus /> Agregar gasto fijo
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        nombre={profile.data?.nombre ?? null}
        ingreso={ingreso}
        moneda={profile.data?.moneda ?? getCurrency()}
      />
      <ItemDialog
        item={editing}
        open={itemOpen}
        onOpenChange={setItemOpen}
        nextOrden={(items.data ?? []).reduce((m, b) => Math.max(m, (b.orden ?? 0) + 1), 0)}
      />
    </>
  )
}
