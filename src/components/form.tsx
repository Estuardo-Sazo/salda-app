import type { ComponentProps, ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Etiqueta + control + ayuda/error. El control recibe el id y aria-describedby. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Input de quetzales: teclado decimal en el celular y prefijo "Q". */
export function MoneyInput({ className, large = false, ...props }: ComponentProps<'input'> & { large?: boolean }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className={cn(
          'text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2',
          large && 'left-4 text-2xl font-medium',
        )}
      >
        Q
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          'tabular h-11 pl-7',
          large && 'h-16 pl-10 text-3xl font-semibold tracking-tight md:text-3xl',
          className,
        )}
        {...props}
      />
    </div>
  )
}

/** Botón tipo chip para selecciones rápidas (deudas, categorías, métodos). */
export function ChoiceChip({ selected, className, ...props }: ComponentProps<'button'> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'bg-card focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-left text-sm transition focus-visible:ring-3 focus-visible:outline-none',
        selected ? 'border-primary bg-accent ring-primary/30 ring-2' : 'hover:bg-accent/60',
        className,
      )}
      {...props}
    />
  )
}

/** Sección plegable sin JS extra (details/summary). */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="group rounded-xl border" open={defaultOpen}>
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
        {title}
        <span aria-hidden className="transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid gap-4 px-4 pb-4">{children}</div>
    </details>
  )
}
