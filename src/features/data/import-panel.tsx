import { AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Money } from '@/components/common'
import { ChoiceChip, Field, MoneyInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ESTRATEGIA_LABEL, suggestedBudget } from '@/features/plan/plan-input'
import type { Strategy } from '@/lib/finance'
import { currentPeriod, formatPeriod } from '@/lib/format'
import { parseAmount, toInput } from '@/lib/forms'
import { buildSeedPayload } from '@/lib/seed/build-payload'
import { parseSeed } from '@/lib/seed/load'
import { cn } from '@/lib/utils'
import { useImportPayload, type ImportResult } from './api'
import { isBackup, parseBackup, summarizeRestore, toRestorePayload, type Backup } from './backup'
import { readWorkbook, readWorkbookBytes, type ExcelImport } from './excel'
import { initialPlan, sourcesFromPayload } from './initial-plan'

type Parsed =
  | { kind: 'excel'; name: string; data: ExcelImport }
  | { kind: 'backup'; name: string; data: Backup }
  | { kind: 'seed'; name: string; data: ReturnType<typeof buildSeedPayload> }

const CAMPO_LABEL = {
  saldo_total: 'saldos',
  total_real: 'total real',
  pagos: 'pagos',
  interes_cargos: 'interés y cargos',
  gastos_total: 'gastos',
} as const

async function parseFile(file: File, periodoActual: string): Promise<Parsed> {
  if (/\.xlsx?$/i.test(file.name)) {
    return {
      kind: 'excel',
      name: file.name,
      data: readWorkbook(readWorkbookBytes(await file.arrayBuffer()), periodoActual),
    }
  }
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }
  if (isBackup(json)) return { kind: 'backup', name: file.name, data: parseBackup(json) }
  return { kind: 'seed', name: file.name, data: buildSeedPayload(parseSeed(json)) }
}

function ExcelPreview({ data }: { data: ExcelImport }) {
  return (
    <div className="grid gap-3">
      {data.fatal && (
        <p role="alert" className="bg-danger-soft text-destructive flex items-start gap-2 rounded-xl p-3 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.fatal}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">Validación por hoja</caption>
          <thead className="bg-muted text-muted-foreground text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Hoja
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Filas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Válidas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Errores
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Duplicados
              </th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.reportes.map((r) => (
              <tr key={r.hoja} className="border-t">
                <th scope="row" className="px-3 py-1.5 text-left font-medium">
                  {r.hoja}
                  {!r.encontrada && <span className="text-muted-foreground ml-1 text-xs font-normal">(no está)</span>}
                </th>
                <td className="px-3 py-1.5 text-right">{r.filas}</td>
                <td className="text-success px-3 py-1.5 text-right">{r.validas}</td>
                <td className={cn('px-3 py-1.5 text-right', r.errores.length > 0 && 'text-destructive font-medium')}>
                  {r.errores.length}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 text-right',
                    r.duplicados.length > 0 && 'text-warning-foreground font-medium',
                  )}
                >
                  {r.duplicados.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.reportes.some((r) => r.errores.length + r.duplicados.length + r.avisos.length > 0) && (
        <details className="rounded-xl border p-3 text-sm" open>
          <summary className="cursor-pointer font-medium">Filas que no se van a importar</summary>
          <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto">
            {data.reportes.flatMap((r) => [
              ...r.errores.map((e) => (
                <li key={`e${r.hoja}${e.fila}${e.mensaje}`} className="flex gap-1.5">
                  <XCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="text-muted-foreground">
                      {e.hoja}, fila {e.fila}:
                    </span>{' '}
                    {e.mensaje}
                  </span>
                </li>
              )),
              ...r.duplicados.map((e) => (
                <li key={`d${r.hoja}${e.fila}`} className="flex gap-1.5">
                  <AlertTriangle className="text-warning-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="text-muted-foreground">
                      {e.hoja}, fila {e.fila}:
                    </span>{' '}
                    duplicado, {e.mensaje}
                  </span>
                </li>
              )),
              ...r.avisos.map((a) => (
                <li key={`a${r.hoja}${a}`} className="text-muted-foreground flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {a}
                </li>
              )),
            ])}
          </ul>
        </details>
      )}
    </div>
  )
}

function ResultView({ result }: { result: ImportResult }) {
  const c = result.counts
  return (
    <div className="grid gap-2 text-sm">
      <p className="text-success flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4" aria-hidden />
        Importado: {c.debts ?? 0} deudas, {c.payments ?? 0} pagos, {c.expenses ?? 0} gastos y {c.monthly_snapshots ?? 0}{' '}
        saldos.
      </p>
      {result.mismatches &&
        (result.mismatches.length === 0 ? (
          <p className="text-success flex items-center gap-2">
            <CheckCircle2 className="size-4" aria-hidden />
            Los totales de cada mes coinciden con los del respaldo.
          </p>
        ) : (
          <div className="text-warning-foreground grid gap-1">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" aria-hidden />
              {result.mismatches.length} totales no coinciden:
            </p>
            <ul className="tabular grid gap-0.5 pl-6 text-xs">
              {result.mismatches.slice(0, 10).map((m) => (
                <li key={`${m.periodo}${m.campo}`}>
                  {formatPeriod(m.periodo)} · {CAMPO_LABEL[m.campo]}: esperado <Money value={m.esperado} />, quedó{' '}
                  <Money value={m.obtenido} />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}

/** Importar un Excel (Control_deudas.xlsx), un respaldo JSON de Saldá o un seed JSON. */
export function ImportPanel({
  disabledReason,
  onImported,
}: {
  /** Si la cuenta ya tiene datos, la importación no se permite (la RPC lo exige). */
  disabledReason?: string | null
  onImported?: (r: ImportResult) => void
}) {
  const periodoActual = currentPeriod()
  const input = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [reading, setReading] = useState(false)
  const [estrategia, setEstrategia] = useState<Strategy>('avalancha')
  const [presupuesto, setPresupuesto] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const importPayload = useImportPayload()

  const excelSources = useMemo(
    () =>
      parsed?.kind === 'excel' && !parsed.data.fatal ? sourcesFromPayload(parsed.data.payload, periodoActual) : null,
    [parsed, periodoActual],
  )
  const presupuestoSugerido = excelSources ? suggestedBudget(excelSources.debts, null) : 0

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReading(true)
    setResult(null)
    try {
      const p = await parseFile(file, periodoActual)
      setParsed(p)
      if (p.kind === 'excel' && !p.data.fatal) {
        setPresupuesto(toInput(suggestedBudget(sourcesFromPayload(p.data.payload, periodoActual).debts, null)))
      }
    } catch (err) {
      setParsed(null)
      toast.error((err as Error).message)
    } finally {
      setReading(false)
    }
  }

  const onImport = () => {
    if (!parsed) return
    let request: Parameters<typeof importPayload.mutate>[0]
    if (parsed.kind === 'excel') {
      const monto = parseAmount(presupuesto)
      const p = parsed.data.payload
      const plan =
        monto != null && !Number.isNaN(monto) && monto > 0
          ? initialPlan(p, { estrategia, presupuestoDeudas: monto, periodoActual })
          : null
      request = { payload: { ...p, plans: plan ? [plan] : [] } }
    } else if (parsed.kind === 'backup') {
      request = { payload: toRestorePayload(parsed.data), expectedTotals: parsed.data.totales }
    } else {
      request = { payload: parsed.data }
    }
    importPayload.mutate(request, {
      onSuccess: (r) => {
        setResult(r)
        toast.success('Datos importados')
        onImported?.(r)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const resumen =
    parsed?.kind === 'excel'
      ? summarizeRestore(parsed.data.payload)
      : parsed?.kind === 'backup'
        ? summarizeRestore(parsed.data)
        : null
  const canImport =
    !disabledReason &&
    parsed != null &&
    !(parsed.kind === 'excel' && parsed.data.fatal) &&
    !result &&
    !importPayload.isPending

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-11" onClick={() => input.current?.click()} disabled={reading}>
          {reading ? <Loader2 className="animate-spin" /> : <Upload />}
          {parsed ? 'Elegir otro archivo' : 'Elegir archivo (.xlsx o .json)'}
        </Button>
        {parsed && (
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            {parsed.kind === 'excel' ? (
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
            ) : (
              <FileJson className="size-4 shrink-0" aria-hidden />
            )}
            <span className="truncate">{parsed.name}</span>
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onFile}
        />
      </div>

      {parsed?.kind === 'excel' && <ExcelPreview data={parsed.data} />}

      {resumen && (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Deudas</dt>
            <dd className="tabular font-semibold">{resumen.deudas}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pagos</dt>
            <dd className="tabular font-semibold">{resumen.pagos}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Gastos</dt>
            <dd className="tabular font-semibold">{resumen.gastos}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saldos</dt>
            <dd className="font-semibold">
              {resumen.saldos}
              {resumen.desde && resumen.hasta && (
                <span className="text-muted-foreground text-xs font-normal">
                  {' '}
                  · {formatPeriod(resumen.desde)} a {formatPeriod(resumen.hasta)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}

      {parsed?.kind === 'backup' && (
        <p className="text-muted-foreground text-sm">
          Respaldo del {parsed.data.exportado_en.slice(0, 10).split('-').reverse().join('/')} con{' '}
          {parsed.data.plans.length} {parsed.data.plans.length === 1 ? 'plan' : 'planes'}. Al terminar se comparan los
          totales de cada mes.
        </p>
      )}
      {parsed?.kind === 'seed' && (
        <p className="text-muted-foreground text-sm">
          Archivo de datos iniciales con {parsed.data.debts.length} deudas y el plan «{parsed.data.plan.nombre}».
        </p>
      )}

      {excelSources && !result && (
        <fieldset className="grid gap-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">Plan inicial</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ESTRATEGIA_LABEL) as Strategy[]).map((s) => (
              <ChoiceChip key={s} selected={estrategia === s} className="text-center" onClick={() => setEstrategia(s)}>
                {ESTRATEGIA_LABEL[s]}
              </ChoiceChip>
            ))}
          </div>
          <Field
            id="import-presupuesto"
            label="Presupuesto mensual para deudas"
            hint={`Suma de cuotas: ${toInput(presupuestoSugerido)}. Dejalo vacío para crear el plan después.`}
          >
            <MoneyInput id="import-presupuesto" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
          </Field>
        </fieldset>
      )}

      {disabledReason && parsed && <p className="text-warning-foreground text-sm">{disabledReason}</p>}

      {parsed && !result && (
        <div>
          <Button className="h-11" disabled={!canImport} onClick={onImport}>
            {importPayload.isPending && <Loader2 className="animate-spin" />}
            {parsed.kind === 'backup' ? 'Restaurar respaldo' : 'Importar'}
          </Button>
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  )
}
