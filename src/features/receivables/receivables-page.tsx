import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, HandCoins, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/common'
import { Field, MoneyInput } from '@/components/form'
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
import { formatGTQ } from '@/lib/format'
import { moneyField, optionalMoneyField, optionalText, toInput } from '@/lib/forms'
import { num, supabase, unwrap } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

type Receivable = Tables<'receivables'>
type ReceivableValues = Omit<TablesInsert<'receivables'>, 'id' | 'user_id' | 'created_at'>

const keys = { all: ['receivables'] as const }

function useReceivables() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async () =>
      unwrap(await supabase.from('receivables').select('*').order('created_at')).map((r) => ({
        ...r,
        monto: num(r.monto),
        saldo: num(r.saldo),
      })),
  })
}

function useSaveReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ReceivableValues }) =>
      id
        ? unwrap(await supabase.from('receivables').update(values).eq('id', id))
        : unwrap(await supabase.from('receivables').insert(values)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

function useDeleteReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('receivables').delete().eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

const schema = z
  .object({
    persona: z.string().trim().min(1, '¿Quién te debe?').max(60),
    monto: moneyField('Ingresá cuánto prestaste').refine((v) => v > 0, 'Debe ser mayor a Q0'),
    saldo: optionalMoneyField(),
    notas: optionalText(),
  })
  .transform((v) => ({ ...v, saldo: v.saldo ?? v.monto }))
  .refine((v) => v.saldo <= v.monto, { path: ['saldo'], message: 'No puede ser mayor a lo prestado' })
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
      saldo: toInput(item?.saldo),
      notas: item?.notas ?? '',
    },
  })
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: item?.id, values })
      toast.success(`${values.persona} guardado`)
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
            <DialogTitle>{item ? 'Editar cobro' : 'Nuevo cobro'}</DialogTitle>
            <DialogDescription>Dinero que prestaste y te tienen que devolver.</DialogDescription>
          </DialogHeader>
          <Field id="persona" label="Persona" error={e.persona?.message}>
            <Input id="persona" className="h-11" {...form.register('persona')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="monto" label="Prestaste" error={e.monto?.message}>
              <MoneyInput id="monto" {...form.register('monto')} />
            </Field>
            <Field id="saldo" label="Te deben todavía" error={e.saldo?.message} hint="Vacío = todo">
              <MoneyInput id="saldo" {...form.register('saldo')} />
            </Field>
          </div>
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

export function ReceivablesPage() {
  const items = useReceivables()
  const remove = useDeleteReceivable()
  const [editing, setEditing] = useState<Receivable | null>(null)
  const [open, setOpen] = useState(false)
  const openDialog = (r: Receivable | null) => {
    setEditing(r)
    setOpen(true)
  }
  const pendiente = items.data?.reduce((acc, r) => acc + Math.round(r.saldo * 100), 0) ?? 0

  return (
    <>
      <PageHeader
        title="Dinero que me deben"
        description={
          items.data?.length ? (
            <>
              Pendiente de cobrar: <Money value={pendiente / 100} />
            </>
          ) : (
            'Préstamos a terceros.'
          )
        }
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
          description="Si le prestaste a alguien, anotalo para no olvidarlo."
          action={<Button onClick={() => openDialog(null)}>Agregar</Button>}
        />
      )}
      {items.data && items.data.length > 0 && (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.data.map((r) => {
              const cobrado = r.monto > 0 ? (r.monto - r.saldo) / r.monto : 0
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">{r.persona}</p>
                      <Money value={r.saldo} className={r.saldo > 0 ? 'text-sm font-medium' : 'text-success text-sm'} />
                    </div>
                    <Progress value={cobrado * 100} aria-label={`Cobrado de ${r.persona}`} className="h-1.5" />
                    <p className="text-muted-foreground truncate text-xs">
                      {r.saldo > 0 ? `De ${formatGTQ(r.monto)} prestados` : 'Cobrado completo'}
                      {r.notas && ` · ${r.notas}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${r.persona}`} onClick={() => openDialog(r)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Borrar ${r.persona}`}
                    onClick={() => remove.mutate(r.id, { onError: (err) => toast.error(err.message) })}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <ReceivableDialog item={editing} open={open} onOpenChange={setOpen} />
    </>
  )
}
