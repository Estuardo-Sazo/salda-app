import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Marca de Saldá: la "S" que baja hasta el punto final. Mismo trazo que public/icons/icon.svg. */
export function LogoMark({ className, title = 'Saldá' }: { className?: string; title?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 512 512" className={cn('size-8 shrink-0', className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F2D32" />
          <stop offset="1" stopColor="#061316" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86F7CF" />
          <stop offset="1" stopColor="#12B886" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" fill={`url(#${id}-bg)`} />
      <g transform="translate(-14 -4)">
        <path
          d="M338 168C318 140 284 126 246 126C194 126 156 154 156 198C156 246 196 262 248 276C304 291 344 308 344 356C344 400 304 420 252 420C206 420 168 402 146 372"
          fill="none"
          stroke={`url(#${id}-s)`}
          strokeWidth="60"
          strokeLinecap="round"
        />
        <circle cx="406" cy="416" r="33" fill="#D4FF5E" />
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
