import type { ReactNode } from 'react'
import { LogoMark } from '@/components/brand/logo'

/*
 * Encabezado y pie de las páginas públicas (inicio, términos, privacidad). Se prerenderizan a HTML
 * estático, así que usan <a> normales y nada del router.
 */

export const LOGIN = '/login'
const YEAR = new Date().getFullYear()

export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <a href="/" className="flex items-center gap-2" aria-label="Saldá, página principal">
        <LogoMark className="size-8" />
        <span className="text-lg font-semibold tracking-tight">Saldá</span>
      </a>
      <nav aria-label="Secciones" className="flex items-center gap-6 text-sm">
        {children}
        <a href={LOGIN} className="hover:bg-accent rounded-lg border px-3 py-1.5 font-medium transition">
          Iniciar sesión
        </a>
      </nav>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
        <span className="flex items-center gap-2">
          <LogoMark className="size-5" />© {YEAR} Saldá
        </span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="/terminos" className="hover:text-foreground">
            Términos
          </a>
          <a href="/privacidad" className="hover:text-foreground">
            Privacidad
          </a>
          <a href={LOGIN} className="hover:text-foreground">
            Iniciar sesión
          </a>
        </nav>
      </div>
    </footer>
  )
}
