import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { diffTone } from './model'

/** Real − meta: verde si vas adelantado (≤ 0), rojo si vas atrasado. Siempre con icono y texto accesible. */
export function DiffAmount({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const good = diffTone(value) === 'good'
  const Icon = good ? ArrowDownRight : ArrowUpRight
  return (
    <span
      className={cn(
        'tabular inline-flex items-center justify-end gap-0.5 font-medium whitespace-nowrap',
        good ? 'text-success' : 'text-destructive',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{good ? 'Adelantado' : 'Atrasado'}</span>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {formatMoney(Math.abs(value))}
    </span>
  )
}

/** Cambio de saldo vs el mes anterior: bajar es bueno. */
export function ChangeAmount({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const bajo = value <= 0
  return (
    <span className={cn('tabular whitespace-nowrap', bajo ? 'text-success' : 'text-destructive')}>
      <span className="sr-only">{bajo ? 'Bajó ' : 'Subió '}</span>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {formatMoney(Math.abs(value))}
    </span>
  )
}
