import { AlertTriangle, Construction, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatGTQ } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Monto en quetzales con cifras tabulares. */
export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  return <span className={cn('tabular whitespace-nowrap', className)}>{formatGTQ(value)}</span>
}

/** Etiqueta obligatoria para cualquier dato null (tasas, seguros, saldos de cancelación). */
export function PendingBadge({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <Badge variant="warning" className={cn('tracking-wide uppercase', className)}>
      <AlertTriangle aria-hidden />
      {short ? 'Pendiente' : 'Pendiente de confirmar'}
    </Badge>
  )
}

/** Muestra el valor o la etiqueta PENDIENTE cuando es null. */
export function OrPending({ value, children }: { value: unknown; children: ReactNode }) {
  return value == null ? <PendingBadge short /> : <>{children}</>
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <span className="bg-accent text-accent-foreground grid size-12 place-items-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Pantallas de fases futuras del plan. */
export function ComingSoon({ title, fase, children }: { title: string; fase: number; children?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title={`Llega en la Fase ${fase}`}
        description={children ?? 'Esta sección está planificada en docs/PLAN.md y se construye en una fase siguiente.'}
      />
    </>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Error desconocido'
  return (
    <div role="alert" className="border-destructive/30 bg-danger-soft rounded-2xl border p-4 text-sm">
      <p className="text-destructive font-medium">No se pudieron cargar los datos</p>
      <p className="text-muted-foreground mt-1">{message}</p>
    </div>
  )
}
