import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil, Plus, PlusCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Money } from '@/components/common'
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cuotasRestantes, fueraDeSaldo } from '@/lib/finance/installments'
import { formatMoney } from '@/lib/format'
import { toInput } from '@/lib/forms'
import { useChargeInstallment, useDeleteInstallment, useSaveInstallment, type Installment } from './api'
import { installmentSchema, type InstallmentFormInput, type InstallmentFormOutput } from './schema'

function InstallmentDialog({
  debtId,
  installment,
  open,
  onOpenChange,
}: {
  debtId: string
  installment: Installment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveInstallment()
  const form = useForm<InstallmentFormInput, unknown, InstallmentFormOutput>({
    resolver: zodResolver(installmentSchema),
    values: {
      descripcion: installment?.descripcion ?? '',
      monto_cuota: toInput(installment?.monto_cuota),
      cuotas_totales: installment?.cuotas_totales.toString() ?? '',
      cuotas_cobradas: installment?.cuotas_cobradas.toString() ?? '0',
      capital_pendiente: toInput(installment?.capital_pendiente),
      cargo_extra_por_cuota: installment?.cargo_extra_por_cuota ? toInput(installment.cargo_extra_por_cuota) : '',
    },
  })
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: installment?.id, debtId, values })
      toast.success(installment ? 'Cuota actualizada' : 'Cuota agregada')
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
            <DialogTitle>{installment ? 'Editar cuota' : 'Nueva cuota fuera de saldo'}</DialogTitle>
            <DialogDescription>
              Intracuotas, visacuotas o extrafinanciamientos que el banco aún no cobra.
            </DialogDescription>
          </DialogHeader>
          <Field id="descripcion" label="Descripción" error={e.descripcion?.message}>
            <Input id="descripcion" className="h-11" {...form.register('descripcion')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="monto_cuota" label="Cuota" error={e.monto_cuota?.message}>
              <MoneyInput id="monto_cuota" {...form.register('monto_cuota')} />
            </Field>
            <Field id="cargo_extra_por_cuota" label="Cargo extra por cuota" error={e.cargo_extra_por_cuota?.message}>
              <MoneyInput id="cargo_extra_por_cuota" placeholder="0.00" {...form.register('cargo_extra_por_cuota')} />
            </Field>
            <Field id="cuotas_totales" label="Cuotas totales" error={e.cuotas_totales?.message}>
              <Input id="cuotas_totales" inputMode="numeric" className="h-11" {...form.register('cuotas_totales')} />
            </Field>
            <Field id="cuotas_cobradas" label="Ya cobradas" error={e.cuotas_cobradas?.message}>
              <Input id="cuotas_cobradas" inputMode="numeric" className="h-11" {...form.register('cuotas_cobradas')} />
            </Field>
          </div>
          <Field
            id="capital_pendiente"
            label="Capital pendiente (si el banco lo informa)"
            error={e.capital_pendiente?.message}
            hint="Si lo dejás vacío se usa (cuota − cargo) × cuotas restantes."
          >
            <MoneyInput id="capital_pendiente" {...form.register('capital_pendiente')} />
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

export function InstallmentsCard({ debtId, installments }: { debtId: string; installments: Installment[] }) {
  const [editing, setEditing] = useState<Installment | null>(null)
  const [open, setOpen] = useState(false)
  const charge = useChargeInstallment()
  const remove = useDeleteInstallment()
  const total = installments.reduce((acc, i) => acc + fueraDeSaldo(i), 0)

  const openDialog = (i: Installment | null) => {
    setEditing(i)
    setOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuotas fuera de saldo</CardTitle>
        <CardDescription>
          {installments.length ? (
            <>
              <Money value={total} className="text-foreground font-medium" /> que el banco aún no cobra
            </>
          ) : (
            'No hay compras en cuotas pendientes.'
          )}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => openDialog(null)}>
            <Plus /> Agregar
          </Button>
        </CardAction>
      </CardHeader>
      {installments.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {installments.map((i) => {
              const restantes = cuotasRestantes(i)
              const pct = (i.cuotas_cobradas / i.cuotas_totales) * 100
              return (
                <li key={i.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.descripcion}</p>
                      <p className="text-muted-foreground text-xs">
                        {i.cuotas_cobradas} de {i.cuotas_totales} cobradas · cuota {formatMoney(i.monto_cuota)}
                        {i.cargo_extra_por_cuota > 0 && ` · cargo ${formatMoney(i.cargo_extra_por_cuota)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={fueraDeSaldo(i)} className="text-sm font-medium" />
                      <p className="text-muted-foreground text-xs">
                        {restantes} {restantes === 1 ? 'restante' : 'restantes'}
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    className="h-1.5"
                    aria-label={`${i.descripcion}: ${i.cuotas_cobradas} de ${i.cuotas_totales}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={restantes === 0 || charge.isPending}
                      onClick={() =>
                        charge.mutate(i, {
                          onSuccess: () =>
                            toast.success(`${i.descripcion}: cuota ${i.cuotas_cobradas + 1} de ${i.cuotas_totales}`),
                          onError: (err) => toast.error(err.message),
                        })
                      }
                    >
                      <PlusCircle /> +1 cuota cobrada
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDialog(i)}
                      aria-label={`Editar ${i.descripcion}`}
                    >
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label={`Borrar ${i.descripcion}`}>
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Borrar “{i.descripcion}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deja de contarse como deuda fuera de saldo. No se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => remove.mutate(i.id, { onError: (err) => toast.error(err.message) })}
                          >
                            Borrar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      )}
      <InstallmentDialog debtId={debtId} installment={editing} open={open} onOpenChange={setOpen} />
    </Card>
  )
}
