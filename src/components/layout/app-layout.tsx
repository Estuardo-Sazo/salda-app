import {
  ArrowDownCircle,
  BarChart3,
  CreditCard,
  Home,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
  Receipt,
  Sun,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/providers/auth'
import { useTheme, type ThemePreference } from '@/app/providers/theme'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/features/common/queries'
import { useOnline } from '@/hooks/use-online'
import { setCurrency, useCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Solo en la barra lateral: la navegación inferior tiene 5 lugares fijos. */
  desktopOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: Home, end: true },
  { to: '/registrar', label: 'Registrar', icon: Plus },
  { to: '/deudas', label: 'Deudas', icon: CreditCard },
  { to: '/gastos', label: 'Gastos', icon: Receipt, desktopOnly: true },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/mas', label: 'Más', icon: MoreHorizontal },
]

const THEME_ICON: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor }

function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Oscuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const initial = (user?.email ?? '?').charAt(0).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cuenta" className="rounded-full">
          <span className="bg-ink text-ink-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground truncate font-normal">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Bottom sheet del botón "+": registrar pago o gasto. */
function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }
  const options = [
    { to: '/registrar/pago', title: 'Pago', text: 'Abono a una tarjeta o préstamo', icon: ArrowDownCircle },
    { to: '/registrar/gasto', title: 'Gasto', text: 'Efectivo, débito o tarjeta', icon: Receipt },
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-safe rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>¿Qué querés registrar?</SheetTitle>
          <SheetDescription>Toma menos de 15 segundos.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 px-4 pb-6">
          {options.map(({ to, title, text, icon: Icon }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className="bg-card hover:border-primary/40 hover:bg-accent focus-visible:ring-ring/50 flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:ring-3 focus-visible:outline-none"
            >
              <span className="bg-ink text-quetzal grid size-10 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-muted-foreground block text-xs">{text}</span>
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Mientras se descarga una pantalla. */
function PageFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="bg-warning-soft text-warning-foreground flex items-center justify-center gap-2 px-4 py-2 text-center text-sm"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Sin conexión: ves los últimos datos cargados y no se pueden guardar cambios.
    </div>
  )
}

export function AppLayout() {
  const [quickAdd, setQuickAdd] = useState(false)
  // La moneda del perfil manda; al cambiarla se vuelve a pintar la pantalla con el formato nuevo.
  const moneda = useProfile().data?.moneda
  useEffect(() => {
    if (moneda) setCurrency(moneda)
  }, [moneda])
  const currency = useCurrency()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <a
        href="#contenido"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <aside className="bg-card/60 sticky top-0 hidden h-dvh flex-col gap-6 border-r px-4 py-6 lg:flex">
        <Link to="/inicio" className="px-2">
          <Logo />
        </Link>
        <Button className="h-10 justify-start gap-2 rounded-xl" onClick={() => setQuickAdd(true)}>
          <Plus /> Registrar
        </Button>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.filter((n) => n.to !== '/registrar').map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur lg:px-8">
          <Link to="/inicio" className="lg:invisible">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeMenu />
            <UserMenu />
          </div>
        </header>
        <OfflineBanner />

        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 focus:outline-none lg:px-8 lg:pb-12"
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet key={currency} />
          </Suspense>
        </main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav
        aria-label="Principal"
        className="bg-background/90 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {NAV.filter((n) => !n.desktopOnly).map(({ to, label, icon: Icon, end }) =>
            to === '/registrar' ? (
              <li key={to} className="flex items-start justify-center">
                <button
                  type="button"
                  onClick={() => setQuickAdd(true)}
                  aria-label="Registrar pago o gasto"
                  className="bg-ink text-gold ring-background -mt-5 grid size-14 place-items-center rounded-2xl shadow-lg ring-4 transition active:scale-95"
                >
                  <Plus className="size-6" strokeWidth={2.5} />
                </button>
              </li>
            ) : (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                      isActive && 'text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('size-5', isActive && 'text-primary')} aria-hidden />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ),
          )}
        </ul>
      </nav>

      <QuickAddSheet open={quickAdd} onOpenChange={setQuickAdd} />
    </div>
  )
}
