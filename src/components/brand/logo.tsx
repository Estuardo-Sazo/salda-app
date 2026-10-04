import { cn } from '@/lib/utils'

/** Marca de Saldá: la Q del quetzal con una pluma de quetzal como cola. Mismo dibujo que public/icons/icon.svg. */
export function LogoMark({ className, title = 'Saldá' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-8 shrink-0', className)} role="img" aria-label={title}>
      <rect width="512" height="512" rx="96" fill="#12322A" />
      <g transform="translate(-6 -4)">
        <circle cx="228" cy="228" r="120" fill="none" stroke="#E8B53A" strokeWidth="48" />
        <path d="M270 272C363 280 424 371 440 440Z" fill="#3DBE7A" />
        <path d="M270 272C293 351 379 416 440 440Z" fill="#23946A" />
        <path
          d="M404 334L380 356M434 386L414 402M340 396L358 380"
          stroke="#12322A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="270" cy="272" r="20" fill="#C4452D" />
      </g>
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {!compact && <span className="text-lg font-semibold tracking-tight">Saldá</span>}
    </span>
  )
}
