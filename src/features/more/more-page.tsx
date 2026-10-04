import {
  ChevronRight,
  Download,
  Gift,
  HandCoins,
  LineChart,
  ListChecks,
  Loader2,
  LogOut,
  SlidersHorizontal,
  Table2,
  Receipt,
  Trash2,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/auth'
import { useTheme, type ThemePreference } from '@/app/providers/theme'
import { Money, PageHeader } from '@/components/common'
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
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfile, useResetData } from '@/features/common/queries'
import { promptInstall, useInstallState } from '@/lib/pwa/install'

const LINKS: { to: string; label: string; text: string; icon: LucideIcon }[] = [
  { to: '/mas/presupuesto', label: 'Ingreso y gastos fijos', text: 'Base del flujo libre', icon: Wallet },
  { to: '/gastos', label: 'Gastos', text: 'Por mes, categoría y método', icon: Receipt },
  { to: '/mas/ingresos-extra', label: 'Ingresos extra', text: 'Aguinaldo, Bono 14 y otros', icon: Gift },
  { to: '/saldos', label: 'Saldos mensuales', text: 'Tabla período × deuda', icon: Table2 },
  { to: '/plan', label: 'Plan vs real', text: 'Meta mes a mes y comparación', icon: ListChecks },
  { to: '/simulador', label: 'Simulador', text: 'Abonos extra y consolidación', icon: SlidersHorizontal },
  { to: '/reportes', label: 'Reportes', text: 'Mensual, anual y exportar', icon: LineChart },
  { to: '/mas/cobros', label: 'Dinero que me deben', text: 'Préstamos a terceros', icon: HandCoins },
  { to: '/mas/exportar', label: 'Importar / exportar', text: 'Excel, CSV y respaldo JSON', icon: Download },
]

const CONFIRM_WORD = 'BORRAR'

function ResetDialog() {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [word, setWord] = useState('')
  const reset = useResetData()
  const navigate = useNavigate()
  const close = () => {
    setStep(0)
    setWord('')
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setStep(1)}>
        <Trash2 /> Borrar todo y empezar de cero
      </Button>
      <Dialog open={step > 0} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>¿Borrar todos tus datos?</DialogTitle>
                <DialogDescription>
                  Se eliminan deudas, pagos, gastos, saldos y planes. Esta acción no se puede deshacer. Te recomendamos
                  exportar un respaldo JSON antes.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => setStep(2)}>
                  Continuar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirmación final</DialogTitle>
                <DialogDescription>
                  Escribí <strong>{CONFIRM_WORD}</strong> para confirmar.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="confirm-reset" className="sr-only">
                  Palabra de confirmación
                </Label>
                <Input
                  id="confirm-reset"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  autoComplete="off"
                  className="h-11"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={word !== CONFIRM_WORD || reset.isPending}
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: () => {
                        close()
                        toast.success('Listo. Empezás de cero.')
                        navigate('/bienvenida', { replace: true })
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  {reset.isPending && <Loader2 className="animate-spin" />}
                  Borrar definitivamente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Instalar la app en el celular o la computadora. */
function InstallCard() {
  const state = useInstallState()
  if (state === 'instalada' || state === 'no-disponible') return null
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-4" aria-hidden /> Instalar Saldá
        </CardTitle>
        <CardDescription>
          {state === 'ios'
            ? 'En Safari tocá Compartir y luego “Agregar a inicio”.'
            : 'Abrila desde tu pantalla de inicio como cualquier app, también sin conexión.'}
        </CardDescription>
      </CardHeader>
      {state === 'disponible' && (
        <CardContent>
          <Button onClick={() => void promptInstall().then((ok) => ok && toast.success('Saldá quedó instalada'))}>
            <Smartphone /> Instalar app
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

export function MorePage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const profile = useProfile()

  return (
    <>
      <PageHeader title="Más" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription className="truncate">{user?.email}</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/mas/presupuesto">Editar</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Nombre</dt>
                <dd className="font-medium">{profile.data?.nombre ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ingreso mensual</dt>
                <dd className="font-medium">
                  {profile.data?.ingreso_mensual != null ? <Money value={profile.data.ingreso_mensual} /> : '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tema</CardTitle>
            <CardDescription>Claro, oscuro o el del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="light">Claro</TabsTrigger>
                <TabsTrigger value="dark">Oscuro</TabsTrigger>
                <TabsTrigger value="system">Sistema</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <InstallCard />

      <Card className="mt-4 gap-0 py-0">
        <ul className="divide-y">
          {LINKS.map(({ to, label, text, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="hover:bg-accent/60 flex items-center gap-3 px-4 py-3 transition">
                <span className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-lg">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground block truncate text-xs">{text}</span>
                </span>
                <ChevronRight className="text-muted-foreground size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut /> Cerrar sesión
        </Button>
        <ResetDialog />
      </div>
    </>
  )
}
