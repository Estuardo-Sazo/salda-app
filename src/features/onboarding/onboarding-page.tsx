import { Database, FileJson, FileSpreadsheet, FlaskConical, Loader2, Sparkles, type LucideIcon } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LogoMark } from '@/components/brand/logo'
import { PendingBadge } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useImportData } from '@/features/common/queries'
import { ImportPanel } from '@/features/data/import-panel'
import { formatGTQ, formatPeriod } from '@/lib/format'
import { buildSeedPayload } from '@/lib/seed/build-payload'
import { bundledSeed, isExampleSeed, parseSeed } from '@/lib/seed/load'
import type { SeedData } from '@/lib/seed/types'

function Option({
  icon: Icon,
  title,
  description,
  badge,
  children,
  footer,
  highlighted = false,
}: {
  icon: LucideIcon
  title: string
  description: string
  badge?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  highlighted?: boolean
}) {
  return (
    <Card className={highlighted ? 'ring-primary/60 ring-2' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="bg-ink text-quetzal grid size-10 place-items-center rounded-xl">
            <Icon className="size-5" aria-hidden />
          </span>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <CardTitle className="mt-2 text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  )
}

export function OnboardingPage() {
  useDocumentTitle('Bienvenida')
  const navigate = useNavigate()
  const importData = useImportData()
  const [includeReceivables, setIncludeReceivables] = useState(false)
  const [uploaded, setUploaded] = useState<{ name: string; seed: SeedData } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const seed = uploaded?.seed ?? bundledSeed
  const usingExample = !uploaded && isExampleSeed
  const payload = useMemo(() => buildSeedPayload(seed, { includeReceivables }), [seed, includeReceivables])
  const resumen = payload.plan.supuestos.resumen
  const activas = seed.debts.filter((d) => d.activa !== false)
  const pendientes = activas.flatMap((d) => [
    ...(d.saldo_cancelacion == null ? [`${d.nombre}: saldo de cancelación`] : []),
    ...(d.seguro_mensual === null ? [`${d.nombre}: seguro mensual`] : []),
  ])

  const periodos = Object.keys(seed.monthly_snapshots_historial)
    .filter((k) => !k.startsWith('_'))
    .sort()
  const desde = periodos[0] ? formatPeriod(`${periodos[0].slice(0, 7)}-01`) : null
  const receivables = seed.receivables_opcional?.length ?? 0

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setUploaded({ name: file.name, seed: parseSeed(JSON.parse(await file.text())) })
      toast.success(`Archivo ${file.name} listo para cargar`)
    } catch (e) {
      toast.error(e instanceof SyntaxError ? 'El archivo no es un JSON válido' : (e as Error).message)
    }
  }

  const onLoad = () =>
    importData.mutate(payload, {
      onSuccess: () => {
        toast.success(`Datos cargados. «${payload.plan.nombre}» quedó activo.`)
        navigate('/', { replace: true })
      },
      onError: (e) => toast.error(e.message),
    })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <LogoMark className="size-11" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Saldá</h1>
          <p className="text-muted-foreground text-sm">¿Cómo querés empezar?</p>
        </div>
      </div>

      <div className="grid gap-4">
        <Option
          icon={Database}
          title="Cargar mis datos"
          description={`Importa tus deudas, historial de saldos${desde ? ` desde ${desde}` : ''}, pagos y compras con tarjeta.`}
          badge="Recomendado"
          highlighted
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button size="lg" className="h-11" onClick={onLoad} disabled={importData.isPending}>
                {importData.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {usingExample ? 'Cargar datos de ejemplo' : 'Cargar mis datos'}
              </Button>
              <Button size="lg" variant="outline" className="h-11" onClick={() => fileInput.current?.click()}>
                <FileJson />
                {uploaded ? 'Elegir otro archivo' : 'Subir mi archivo .json'}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={onFile}
              />
            </div>
          }
        >
          {(usingExample || uploaded) && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
              {uploaded ? (
                <FileJson className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <FlaskConical className="text-warning-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <p className="text-muted-foreground">
                {uploaded ? (
                  <>
                    Usando <span className="text-foreground font-medium">{uploaded.name}</span>.
                  </>
                ) : (
                  <>
                    <span className="text-foreground font-medium">Datos ficticios de ejemplo.</span> Subí tu{' '}
                    <code>initial-data.json</code> para cargar tus datos reales.
                  </>
                )}
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Deudas activas</dt>
              <dd className="tabular font-semibold">{activas.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deuda real</dt>
              <dd className="tabular font-semibold">{formatGTQ(resumen.deuda_inicial)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-semibold">{payload.plan.nombre}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Libre de deudas</dt>
              <dd className="font-semibold">{resumen.periodo_libre ? formatPeriod(resumen.periodo_libre) : '—'}</dd>
            </div>
          </dl>

          {pendientes.length > 0 && (
            <div className="bg-warning-soft/60 mt-4 rounded-xl p-3 text-sm">
              <div className="mb-1.5 flex items-center gap-2">
                <PendingBadge />
              </div>
              <ul className="text-muted-foreground list-inside list-disc">
                {pendientes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {receivables > 0 && (
            <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border p-3">
              <Label htmlFor="receivables" className="flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">Incluir “dinero que me deben”</span>
                <span className="text-muted-foreground text-xs">
                  {receivables} {receivables === 1 ? 'registro' : 'registros'}. Revisá nombres y montos después de
                  cargar.
                </span>
              </Label>
              <Switch id="receivables" checked={includeReceivables} onCheckedChange={setIncludeReceivables} />
            </div>
          )}
        </Option>

        <div className="grid gap-4">
          <Option
            icon={Sparkles}
            title="Empezar desde cero"
            description="Paso a paso: ingreso → gastos fijos → deudas → cuotas fuera de saldo → plan."
            footer={
              <Button variant="outline" className="h-11" onClick={() => navigate('/bienvenida/cero')}>
                Empezar
              </Button>
            }
          />
          <Option
            icon={FileSpreadsheet}
            title="Importar Excel"
            description="Subí Control_deudas.xlsx o un respaldo de Saldá. Vas a ver una vista previa con validación."
          >
            <ImportPanel onImported={() => navigate('/', { replace: true })} />
          </Option>
        </div>
      </div>
    </div>
  )
}
