import { ArrowLeft, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useDebtStatus } from '@/features/common/queries'
import { todayISO } from '@/lib/format'
import { downloadFile, fetchAllTables } from './api'
import { buildBackup } from './backup'
import { CSV_DATASETS, datasetCsv, type CsvDataset } from './csv'
import { buildWorkbook, workbookToArray } from './excel'
import { ImportPanel } from './import-panel'

type Kind = 'excel' | 'json' | 'csv'

export function DataPage() {
  const debts = useDebtStatus()
  const [busy, setBusy] = useState<Kind | null>(null)
  const [dataset, setDataset] = useState<CsvDataset>('pagos')
  const hoy = todayISO()

  const exportar = async (kind: Kind) => {
    setBusy(kind)
    try {
      const backup = buildBackup(await fetchAllTables(), new Date().toISOString())
      if (kind === 'json') {
        downloadFile(JSON.stringify(backup, null, 2), `salda-respaldo-${hoy}.json`, 'application/json')
      } else if (kind === 'excel') {
        downloadFile(
          workbookToArray(buildWorkbook(backup)),
          `Control_deudas-${hoy}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      } else {
        downloadFile(datasetCsv(backup, dataset), `salda-${dataset}-${hoy}.csv`, 'text/csv;charset=utf-8')
      }
      toast.success('Archivo descargado')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const hasData = (debts.data?.length ?? 0) > 0

  return (
    <>
      <PageHeader
        title="Importar / exportar"
        description="Respaldá tus datos o traelos desde tu Excel."
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/mas">
              <ArrowLeft /> Más
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle>Exportar</CardTitle>
            <CardDescription>Los archivos se generan en tu navegador; nada sale de tu cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ExportRow
              icon={FileSpreadsheet}
              title="Excel"
              text="Mismas hojas que Control_deudas.xlsx, más las de Saldá para poder volver a importarlo."
              busy={busy === 'excel'}
              disabled={busy != null}
              onClick={() => exportar('excel')}
            />
            <ExportRow
              icon={FileJson}
              title="Respaldo completo (JSON)"
              text="Todo: deudas, pagos, gastos, saldos, planes e ingresos extra. Restaurarlo da los mismos totales."
              busy={busy === 'json'}
              disabled={busy != null}
              onClick={() => exportar('json')}
            />
            <div className="grid gap-2 rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <FileText className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">CSV</p>
                  <p className="text-muted-foreground text-xs">Una tabla para abrir en cualquier hoja de cálculo.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Label htmlFor="csv-dataset" className="sr-only">
                  Tabla a exportar
                </Label>
                <select
                  id="csv-dataset"
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value as CsvDataset)}
                  className="border-input bg-background h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
                >
                  {(Object.keys(CSV_DATASETS) as CsvDataset[]).map((k) => (
                    <option key={k} value={k}>
                      {CSV_DATASETS[k]}
                    </option>
                  ))}
                </select>
                <Button variant="outline" disabled={busy != null} onClick={() => exportar('csv')}>
                  {busy === 'csv' && <Loader2 className="animate-spin" />}
                  Descargar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle>Importar</CardTitle>
            <CardDescription>
              Excel (Control_deudas.xlsx o uno exportado por Saldá) o un respaldo JSON. Vas a ver una vista previa antes
              de guardar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportPanel
              disabledReason={
                hasData
                  ? 'Tu cuenta ya tiene datos: usá "Borrar todo y empezar de cero" en Más antes de importar.'
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ExportRow({
  icon: Icon,
  title,
  text,
  busy,
  disabled,
  onClick,
}: {
  icon: typeof FileJson
  title: string
  text: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{text}</p>
      </div>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
        {busy && <Loader2 className="animate-spin" />}
        Descargar
      </Button>
    </div>
  )
}
