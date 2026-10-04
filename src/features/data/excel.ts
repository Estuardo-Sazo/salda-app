import * as XLSX from 'xlsx'
import { analyzePayment } from '@/lib/finance/payment'
import { toPeriod } from '@/lib/finance/period'
import { formatDate, formatPeriod } from '@/lib/format'
import type {
  Backup,
  BackupDebt,
  BackupExpense,
  BackupInstallment,
  BackupPayment,
  BackupSnapshot,
  RestorePayload,
} from './backup'

/* ================================================================ formato */

/** Hojas de Control_deudas.xlsx (sección 10) y la fila de su encabezado. */
export const SHEETS = {
  deudas: { name: 'Deudas', header: 3 },
  pagos: { name: 'Registro de pagos', header: 5 },
  compras: { name: 'Compras tarjetas', header: 4 },
  saldos: { name: 'Saldos mensuales', header: 4 },
  // Hojas adicionales de Saldá para que la ida y vuelta no pierda datos.
  otrosGastos: { name: 'Otros gastos', header: 3 },
  cuotas: { name: 'Cuotas fuera de saldo', header: 3 },
  fijos: { name: 'Gastos fijos', header: 3 },
  ingresos: { name: 'Ingresos extra', header: 3 },
  cobros: { name: 'Dinero que me deben', header: 3 },
  perfil: { name: 'Perfil', header: 3 },
  detalle: { name: 'Saldos detalle', header: 3 },
} as const

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const PENDIENTE = 'PENDIENTE'
const TIPO_LABEL = { tarjeta: 'Tarjeta', prestamo: 'Préstamo' } as const
const METODO_LABEL = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
} as const
const ORIGEN_LABEL = { historial: 'Historial', registro: 'Registro', manual: 'Manual' } as const

type Fmt = 'money' | 'percent' | 'int' | 'text'
interface Column<T> {
  header: string
  value: (row: T) => string | number | null
  fmt?: Fmt
  width?: number
}

const FMT: Record<Fmt, string | undefined> = { money: '#,##0.00', percent: '0.00%', int: '0', text: undefined }
const siNo = (v: boolean) => (v ? 'Sí' : 'No')
const orPending = (v: number | null) => (v == null ? PENDIENTE : v)

/** Hoja con título arriba y el encabezado en la fila indicada (1-based). */
function sheet<T>(titulo: string, nota: string, headerRow: number, columns: Column<T>[], rows: T[]): XLSX.WorkSheet {
  const aoa: (string | number | null)[][] = [[titulo], [nota]]
  while (aoa.length < headerRow - 1) aoa.push([])
  aoa.push(columns.map((c) => c.header))
  for (const r of rows) aoa.push(columns.map((c) => c.value(r)))
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }))
  rows.forEach((_, i) => {
    columns.forEach((c, j) => {
      const z = FMT[c.fmt ?? 'text']
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow + i, c: j })] as XLSX.CellObject | undefined
      if (z && cell && cell.t === 'n') cell.z = z
    })
  })
  return ws
}

/** Libro con el mismo formato que Control_deudas.xlsx (más hojas extra de Saldá). */
export function buildWorkbook(b: Backup): XLSX.WorkBook {
  const nombre = new Map(b.debts.map((d) => [d.key, d.nombre]))
  const deuda = (key: string | null) => (key ? (nombre.get(key) ?? '') : '')
  const nota = `Exportado de Saldá el ${formatDate(b.exportado_en.slice(0, 10))}. Montos en quetzales.`
  const wb = XLSX.utils.book_new()
  const add = (ws: XLSX.WorkSheet, name: string) => XLSX.utils.book_append_sheet(wb, ws, name)

  add(
    sheet<BackupDebt>(
      'Deudas',
      `${nota} PENDIENTE = dato por confirmar con el banco.`,
      SHEETS.deudas.header,
      [
        { header: 'Deuda', value: (d) => d.nombre, width: 24 },
        { header: 'Tipo', value: (d) => TIPO_LABEL[d.tipo] },
        { header: 'Tasa anual', value: (d) => orPending(d.tasa_anual), fmt: 'percent' },
        { header: 'Cuota mensual', value: (d) => d.cuota_mensual, fmt: 'money' },
        { header: 'Día de pago', value: (d) => d.dia_pago, fmt: 'int' },
        { header: 'Saldo base', value: (d) => d.saldo_base, fmt: 'money' },
        { header: 'Saldo cancelación (banco)', value: (d) => orPending(d.saldo_cancelacion), fmt: 'money' },
        { header: 'Notas', value: (d) => d.notas, width: 40 },
        { header: 'Fecha base', value: (d) => formatDate(d.fecha_base) },
        { header: 'Entidad', value: (d) => d.entidad, width: 20 },
        {
          header: 'Seguro mensual',
          value: (d) => (d.tipo === 'tarjeta' ? orPending(d.seguro_mensual) : d.seguro_mensual),
          fmt: 'money',
        },
        { header: 'Día de corte', value: (d) => d.dia_corte, fmt: 'int' },
        { header: 'Límite de crédito', value: (d) => d.limite_credito, fmt: 'money' },
        { header: 'Tasa efectiva anual', value: (d) => d.tasa_efectiva_anual, fmt: 'percent' },
        {
          header: 'Fecha saldo cancelación',
          value: (d) => (d.saldo_cancelacion_fecha ? formatDate(d.saldo_cancelacion_fecha) : null),
        },
        { header: 'Cuotas totales', value: (d) => d.cuotas_totales, fmt: 'int' },
        { header: 'Cuota actual', value: (d) => d.cuota_actual, fmt: 'int' },
        { header: 'Vencimiento', value: (d) => (d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : null) },
        { header: 'Interés sobre', value: (d) => (d.interes_modo === 'monto_original' ? 'Monto original' : 'Saldo') },
        { header: 'Monto original', value: (d) => d.monto_original, fmt: 'money' },
        { header: 'Pago único', value: (d) => siNo(d.pago_unico) },
        { header: 'Prioridad', value: (d) => d.prioridad, fmt: 'int' },
        { header: 'Activa', value: (d) => siNo(d.activa) },
        { header: 'Cerrada en', value: (d) => (d.cerrada_en ? formatDate(d.cerrada_en) : null) },
      ],
      b.debts,
    ),
    SHEETS.deudas.name,
  )

  add(
    sheet<BackupPayment>(
      'Registro de pagos',
      nota,
      SHEETS.pagos.header,
      [
        { header: 'Fecha', value: (p) => formatDate(p.fecha) },
        { header: 'Mes', value: (p) => formatPeriod(p.periodo) },
        { header: 'Deuda', value: (p) => deuda(p.debt), width: 24 },
        { header: 'Pago total', value: (p) => p.pago_total, fmt: 'money' },
        { header: 'Interés', value: (p) => p.interes, fmt: 'money' },
        { header: 'Seguro / otros cargos', value: (p) => p.cargos, fmt: 'money', width: 20 },
        { header: 'Saldo después del pago', value: (p) => p.saldo_despues, fmt: 'money', width: 22 },
        { header: 'Fuente / notas', value: (p) => p.fuente, width: 24 },
        { header: 'Notas', value: (p) => p.notas, width: 30 },
        { header: 'Estimado', value: (p) => siNo(p.es_estimado) },
      ],
      b.payments,
    ),
    SHEETS.pagos.name,
  )

  const compras = b.expenses.filter((e) => e.metodo === 'tarjeta')
  add(
    sheet<BackupExpense>(
      'Compras con tarjeta (deuda nueva)',
      nota,
      SHEETS.compras.header,
      [
        { header: 'Fecha', value: (e) => formatDate(e.fecha) },
        { header: 'Mes', value: (e) => formatPeriod(e.periodo) },
        { header: 'Tarjeta', value: (e) => deuda(e.debt), width: 24 },
        { header: 'Descripción', value: (e) => e.descripcion, width: 30 },
        { header: 'Monto', value: (e) => e.monto, fmt: 'money' },
        { header: 'Categoría', value: (e) => e.categoria },
      ],
      compras,
    ),
    SHEETS.compras.name,
  )

  // Matriz mes × deuda con los saldos registrados (sin arrastrar meses vacíos).
  const periodos = [...new Set(b.snapshots.map((s) => s.periodo))].sort()
  const matriz = new Map(b.snapshots.map((s) => [`${s.periodo}|${s.debt}`, s]))
  const conSaldo = b.debts.filter((d) => b.snapshots.some((s) => s.debt === d.key))
  add(
    sheet<string>(
      'Saldos mensuales',
      `${nota} Saldo del estado de cuenta al cierre de cada mes.`,
      SHEETS.saldos.header,
      [
        { header: 'Mes', value: (p) => formatPeriod(p) },
        ...conSaldo.map<Column<string>>((d) => ({
          header: d.nombre,
          value: (p) => matriz.get(`${p}|${d.key}`)?.saldo ?? null,
          fmt: 'money',
          width: 16,
        })),
        {
          header: 'Cuotas fuera de saldo',
          value: (p) =>
            Math.round(
              b.snapshots.filter((s) => s.periodo === p).reduce((acc, s) => acc + s.cuotas_fuera_saldo * 100, 0),
            ) / 100,
          fmt: 'money',
          width: 20,
        },
      ],
      periodos,
    ),
    SHEETS.saldos.name,
  )

  add(
    sheet<BackupExpense>(
      'Otros gastos (efectivo, débito, transferencia)',
      nota,
      SHEETS.otrosGastos.header,
      [
        { header: 'Fecha', value: (e) => formatDate(e.fecha) },
        { header: 'Mes', value: (e) => formatPeriod(e.periodo) },
        { header: 'Descripción', value: (e) => e.descripcion, width: 30 },
        { header: 'Monto', value: (e) => e.monto, fmt: 'money' },
        { header: 'Categoría', value: (e) => e.categoria },
        { header: 'Método', value: (e) => METODO_LABEL[e.metodo] },
      ],
      b.expenses.filter((e) => e.metodo !== 'tarjeta'),
    ),
    SHEETS.otrosGastos.name,
  )

  add(
    sheet<BackupInstallment>(
      'Cuotas fuera de saldo (intracuotas, visacuotas)',
      nota,
      SHEETS.cuotas.header,
      [
        { header: 'Deuda', value: (i) => deuda(i.debt), width: 24 },
        { header: 'Descripción', value: (i) => i.descripcion, width: 24 },
        { header: 'Monto cuota', value: (i) => i.monto_cuota, fmt: 'money' },
        { header: 'Cuotas totales', value: (i) => i.cuotas_totales, fmt: 'int' },
        { header: 'Cuotas cobradas', value: (i) => i.cuotas_cobradas, fmt: 'int' },
        { header: 'Capital pendiente', value: (i) => i.capital_pendiente, fmt: 'money' },
        { header: 'Cargo extra por cuota', value: (i) => i.cargo_extra_por_cuota, fmt: 'money' },
        { header: 'Activa', value: (i) => siNo(i.activa) },
      ],
      b.debt_installments,
    ),
    SHEETS.cuotas.name,
  )

  add(
    sheet<RestorePayload['budget_items'][number]>(
      'Gastos fijos mensuales',
      nota,
      SHEETS.fijos.header,
      [
        { header: 'Concepto', value: (x) => x.concepto, width: 24 },
        { header: 'Monto', value: (x) => x.monto, fmt: 'money' },
        { header: 'Activo', value: (x) => siNo(x.activo) },
      ],
      b.budget_items,
    ),
    SHEETS.fijos.name,
  )

  add(
    sheet<RestorePayload['extra_incomes'][number]>(
      'Ingresos extra',
      nota,
      SHEETS.ingresos.header,
      [
        { header: 'Mes', value: (x) => formatPeriod(x.periodo) },
        { header: 'Concepto', value: (x) => x.concepto, width: 24 },
        { header: 'Monto', value: (x) => x.monto, fmt: 'money' },
      ],
      b.extra_incomes,
    ),
    SHEETS.ingresos.name,
  )

  add(
    sheet<RestorePayload['receivables'][number]>(
      'Dinero que me deben',
      nota,
      SHEETS.cobros.header,
      [
        { header: 'Persona', value: (x) => x.persona, width: 24 },
        { header: 'Monto', value: (x) => x.monto, fmt: 'money' },
        { header: 'Saldo', value: (x) => x.saldo, fmt: 'money' },
        { header: 'Notas', value: (x) => x.notas, width: 30 },
      ],
      b.receivables,
    ),
    SHEETS.cobros.name,
  )

  const perfil: [string, string | number | null][] = [
    ['Nombre', b.profile?.nombre ?? null],
    ['Ingreso mensual', b.profile?.ingreso_mensual ?? null],
    ['Moneda', b.profile?.moneda ?? 'GTQ'],
  ]
  add(
    sheet<[string, string | number | null]>(
      'Perfil',
      nota,
      SHEETS.perfil.header,
      [
        { header: 'Campo', value: (x) => x[0], width: 18 },
        { header: 'Valor', value: (x) => x[1], fmt: 'money', width: 18 },
      ],
      perfil,
    ),
    SHEETS.perfil.name,
  )

  add(
    sheet<BackupSnapshot>(
      'Saldos detalle (para restaurar sin perder datos)',
      `${nota} Si existe, manda sobre la hoja Saldos mensuales al importar.`,
      SHEETS.detalle.header,
      [
        { header: 'Mes', value: (s) => formatPeriod(s.periodo) },
        { header: 'Deuda', value: (s) => deuda(s.debt), width: 24 },
        { header: 'Saldo', value: (s) => s.saldo, fmt: 'money' },
        { header: 'Cuotas fuera de saldo', value: (s) => s.cuotas_fuera_saldo, fmt: 'money', width: 20 },
        { header: 'Origen', value: (s) => ORIGEN_LABEL[s.origen] },
      ],
      b.snapshots,
    ),
    SHEETS.detalle.name,
  )

  return wb
}

/* ================================================================ lectura */

export interface RowIssue {
  hoja: string
  fila: number
  mensaje: string
}

export interface SheetReport {
  hoja: string
  encontrada: boolean
  filas: number
  validas: number
  errores: RowIssue[]
  duplicados: RowIssue[]
  avisos: string[]
}

export interface ExcelImport {
  payload: RestorePayload
  reportes: SheetReport[]
  /** Error que impide importar (por ejemplo, falta la hoja Deudas). */
  fatal: string | null
}

type Cell = string | number | boolean | null

/** "Saldo cancelación (banco)" → "saldo cancelacion". */
export function normHeader(h: unknown): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const normName = (s: string) => normHeader(s)
const isBlank = (v: Cell) => v == null || (typeof v === 'string' && v.trim() === '')
const isPending = (v: Cell) => typeof v === 'string' && /^pendiente/i.test(v.trim())

/** Fecha de Excel (número de serie), "dd/mm/yyyy" o "yyyy-mm-dd" → "yyyy-mm-dd". */
export function parseDateCell(v: Cell): string | null {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d || !d.y) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (m) return validDate(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}

function validDate(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "oct 2026", "octubre 2026", "2026-10", una fecha o un número de serie → "2026-10-01". */
export function parsePeriodCell(v: Cell): string | null {
  if (typeof v === 'string') {
    const s = normHeader(v)
    const m = /^([a-z]+)\.?\s*(?:de\s+)?(\d{4})$/.exec(s)
    if (m) {
      const idx = MESES.findIndex((x) => m[1]!.startsWith(x))
      return idx >= 0 ? toPeriod(Number(m[2]), idx + 1) : null
    }
    const ym = /^(\d{4})-(\d{2})$/.exec(s)
    if (ym) return Number(ym[2]) >= 1 && Number(ym[2]) <= 12 ? toPeriod(Number(ym[1]), Number(ym[2])) : null
  }
  const d = parseDateCell(v)
  return d ? `${d.slice(0, 7)}-01` : null
}

/** Número de una celda; acepta "Q1,234.50". '' → null. */
export function parseNumberCell(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : Number.NaN
  if (typeof v !== 'string' || v.trim() === '') return null
  const s = v.trim().replace(/^Q\s*/i, '').replace(/,/g, '').replace(/%$/, '')
  const num = Number(s)
  if (!Number.isFinite(num)) return Number.NaN
  return v.trim().endsWith('%') ? num / 100 : num
}

const parseBool = (v: Cell, fallback: boolean) => {
  if (isBlank(v)) return fallback
  if (typeof v === 'boolean') return v
  return /^(si|sí|s|yes|true|1|x)$/i.test(String(v).trim())
}

interface Table {
  hoja: string
  /** Fila (1-based) del encabezado en la hoja. */
  headerRow: number
  headers: string[]
  rows: { fila: number; get: (header: string) => Cell; raw: Cell[] }[]
}

/** Busca el encabezado (fila que contiene `first`) en las primeras filas de la hoja. */
function readTable(wb: XLSX.WorkBook, hoja: string, first: string): Table | null {
  const name = wb.SheetNames.find((n) => normHeader(n) === normHeader(hoja))
  const ws = name ? wb.Sheets[name] : undefined
  if (!ws) return null
  const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true })
  const idx = aoa.slice(0, 15).findIndex((r) => r.some((c) => normHeader(c) === normHeader(first)))
  if (idx < 0) return null
  const headers = (aoa[idx] ?? []).map((h) => normHeader(h))
  const rows = aoa
    .slice(idx + 1)
    .map((raw, i) => ({ raw, fila: idx + 2 + i }))
    .filter(({ raw }) => raw.some((c) => !isBlank(c)))
    .map(({ raw, fila }) => ({
      fila,
      raw,
      get: (header: string) => {
        const j = headers.indexOf(normHeader(header))
        return j >= 0 ? (raw[j] ?? null) : null
      },
    }))
  return { hoja: name!, headerRow: idx + 1, headers: (aoa[idx] ?? []).map((h) => String(h ?? '')), rows }
}

function report(hoja: string, table: Table | null): SheetReport {
  return {
    hoja,
    encontrada: table != null,
    filas: table?.rows.length ?? 0,
    validas: 0,
    errores: [],
    duplicados: [],
    avisos: [],
  }
}

/** Lee el libro, valida cada fila y arma el payload de importación (sin plan). */
export function readWorkbook(wb: XLSX.WorkBook, periodoActual: string): ExcelImport {
  const reportes: SheetReport[] = []
  const payload: RestorePayload = {
    profile: null,
    budget_items: [],
    debts: [],
    debt_installments: [],
    snapshots: [],
    payments: [],
    expenses: [],
    extra_incomes: [],
    receivables: [],
    plans: [],
  }

  /* ---------- Deudas */
  const tDeudas = readTable(wb, SHEETS.deudas.name, 'Deuda')
  const rDeudas = report(SHEETS.deudas.name, tDeudas)
  reportes.push(rDeudas)
  if (!tDeudas) {
    return { payload, reportes, fatal: 'El archivo no tiene la hoja "Deudas" con la columna "Deuda".' }
  }
  // "Saldo base (oct 2026)" trae la fecha base en el encabezado.
  const saldoHeader = tDeudas.headers.find((h) => normHeader(h) === 'saldo base') ?? ''
  const fechaHeader = parsePeriodCell(/\((.*?)\)/.exec(saldoHeader)?.[1] ?? null)
  const keyByName = new Map<string, string>()

  for (const r of tDeudas.rows) {
    const err = (mensaje: string) => rDeudas.errores.push({ hoja: rDeudas.hoja, fila: r.fila, mensaje })
    const nombre = String(r.get('Deuda') ?? '').trim()
    if (!nombre) {
      err('Falta el nombre de la deuda')
      continue
    }
    if (keyByName.has(normName(nombre))) {
      rDeudas.duplicados.push({ hoja: rDeudas.hoja, fila: r.fila, mensaje: `"${nombre}" está repetida` })
      continue
    }
    const tipoTxt = normHeader(r.get('Tipo'))
    const tipo =
      tipoTxt.startsWith('tarj') || tipoTxt === 'tc' ? 'tarjeta' : tipoTxt.startsWith('prest') ? 'prestamo' : null
    if (!tipo) {
      err(`${nombre}: el tipo debe ser Tarjeta o Préstamo`)
      continue
    }
    const num = (h: string, opts: { pct?: boolean; int?: boolean } = {}) => {
      const v = r.get(h)
      if (isPending(v)) return null
      const n = parseNumberCell(v)
      if (n != null && Number.isNaN(n)) {
        err(`${nombre}: "${h}" no es un número`)
        return null
      }
      if (n == null) return null
      if (opts.pct) return n > 1 ? Math.round(n * 100) / 10000 : n
      return opts.int ? Math.round(n) : Math.round(n * 100) / 100
    }
    const date = (h: string) => {
      const v = r.get(h)
      if (isBlank(v)) return null
      const d = parseDateCell(v)
      if (!d) err(`${nombre}: "${h}" no es una fecha válida`)
      return d
    }
    const before = rDeudas.errores.length
    const saldoBase = num('Saldo base')
    if (saldoBase == null) err(`${nombre}: falta el saldo base`)
    const fechaBase = date('Fecha base') ?? fechaHeader ?? periodoActual
    const interesModo = normHeader(r.get('Interés sobre')).startsWith('monto') ? 'monto_original' : 'saldo'
    const debt: BackupDebt = {
      key: `xl${payload.debts.length + 1}`,
      nombre,
      entidad: (r.get('Entidad') as string | null) ?? null,
      tipo,
      tasa_anual: num('Tasa anual', { pct: true }),
      tasa_efectiva_anual: num('Tasa efectiva anual', { pct: true }),
      cuota_mensual: num('Cuota mensual'),
      seguro_mensual: num('Seguro mensual'),
      dia_corte: num('Día de corte', { int: true }),
      dia_pago: num('Día de pago', { int: true }),
      limite_credito: num('Límite de crédito'),
      saldo_base: saldoBase ?? 0,
      fecha_base: fechaBase,
      saldo_cancelacion: num('Saldo cancelación'),
      saldo_cancelacion_fecha: date('Fecha saldo cancelación'),
      cuotas_totales: num('Cuotas totales', { int: true }),
      cuota_actual: num('Cuota actual', { int: true }),
      fecha_vencimiento: date('Vencimiento'),
      prioridad: num('Prioridad', { int: true }),
      activa: parseBool(r.get('Activa'), true),
      cerrada_en: date('Cerrada en'),
      notas: isBlank(r.get('Notas')) ? null : String(r.get('Notas')).trim(),
      interes_modo: interesModo,
      monto_original: num('Monto original'),
      pago_unico: parseBool(r.get('Pago único'), false),
    }
    if (debt.dia_pago != null && (debt.dia_pago < 1 || debt.dia_pago > 31)) err(`${nombre}: día de pago fuera de 1–31`)
    if (debt.interes_modo === 'monto_original' && (debt.monto_original == null || debt.tasa_anual == null)) {
      err(`${nombre}: el interés sobre monto original necesita monto original y tasa`)
    }
    if (debt.pago_unico && !debt.fecha_vencimiento) err(`${nombre}: el pago único necesita fecha de vencimiento`)
    if (rDeudas.errores.length > before) continue
    keyByName.set(normName(nombre), debt.key)
    payload.debts.push(debt)
    rDeudas.validas++
  }
  if (payload.debts.length === 0) return { payload, reportes, fatal: 'La hoja "Deudas" no tiene deudas válidas.' }
  const debtKey = (v: Cell) => keyByName.get(normName(String(v ?? '')))
  const debtByKey = new Map(payload.debts.map((d) => [d.key, d]))

  /* ---------- Cuotas fuera de saldo */
  const tCuotas = readTable(wb, SHEETS.cuotas.name, 'Descripción')
  const rCuotas = report(SHEETS.cuotas.name, tCuotas)
  for (const r of tCuotas?.rows ?? []) {
    const err = (m: string) => rCuotas.errores.push({ hoja: rCuotas.hoja, fila: r.fila, mensaje: m })
    const key = debtKey(r.get('Deuda'))
    const monto = parseNumberCell(r.get('Monto cuota'))
    const totales = parseNumberCell(r.get('Cuotas totales'))
    const cobradas = parseNumberCell(r.get('Cuotas cobradas')) ?? 0
    if (!key) err(`La deuda "${r.get('Deuda') ?? ''}" no está en la hoja Deudas`)
    else if (monto == null || Number.isNaN(monto) || monto <= 0) err('Monto de cuota inválido')
    else if (totales == null || Number.isNaN(totales) || totales < 1) err('Cuotas totales inválidas')
    else if (Number.isNaN(cobradas) || cobradas < 0 || cobradas > totales) err('Cuotas cobradas inválidas')
    else {
      const capital = parseNumberCell(r.get('Capital pendiente'))
      const cargo = parseNumberCell(r.get('Cargo extra por cuota'))
      payload.debt_installments.push({
        debt: key,
        descripcion: String(r.get('Descripción') ?? '').trim() || 'Cuota',
        monto_cuota: monto,
        cuotas_totales: Math.round(totales),
        cuotas_cobradas: Math.round(cobradas),
        capital_pendiente: capital == null || Number.isNaN(capital) ? null : capital,
        cargo_extra_por_cuota: cargo == null || Number.isNaN(cargo) ? 0 : cargo,
        activa: parseBool(r.get('Activa'), true),
      })
      rCuotas.validas++
    }
  }
  if (tCuotas) reportes.push(rCuotas)

  /* ---------- Registro de pagos */
  const tPagos = readTable(wb, SHEETS.pagos.name, 'Fecha')
  const rPagos = report(SHEETS.pagos.name, tPagos)
  reportes.push(rPagos)
  const vistos = new Set<string>()
  const pagosValidos: (BackupPayment & { fila: number; estimadoTxt: Cell })[] = []
  for (const r of tPagos?.rows ?? []) {
    const err = (m: string) => rPagos.errores.push({ hoja: rPagos.hoja, fila: r.fila, mensaje: m })
    const fecha = parseDateCell(r.get('Fecha'))
    const key = debtKey(r.get('Deuda'))
    const pago = parseNumberCell(r.get('Pago total'))
    const saldo = parseNumberCell(r.get('Saldo después del pago'))
    const interes = parseNumberCell(r.get('Interés'))
    const cargos = parseNumberCell(r.get('Seguro / otros cargos'))
    if (!fecha) err('Fecha inválida (usá dd/mm/aaaa)')
    else if (!key) err(`La deuda "${r.get('Deuda') ?? ''}" no está en la hoja Deudas`)
    else if (pago == null || Number.isNaN(pago) || pago <= 0) err('Pago total inválido')
    else if (saldo == null || Number.isNaN(saldo) || saldo < 0) err('Falta el saldo después del pago')
    else if (Number.isNaN(interes ?? 0) || Number.isNaN(cargos ?? 0)) err('Interés o cargos no son números')
    else {
      const dup = `${key}|${fecha}|${pago.toFixed(2)}`
      if (vistos.has(dup)) {
        rPagos.duplicados.push({
          hoja: rPagos.hoja,
          fila: r.fila,
          mensaje: `${debtByKey.get(key)!.nombre} ${formatDate(fecha)} por Q${pago.toFixed(2)} ya está en otra fila`,
        })
        continue
      }
      vistos.add(dup)
      const periodo = isBlank(r.get('Mes')) ? `${fecha.slice(0, 7)}-01` : parsePeriodCell(r.get('Mes'))
      if (!periodo) {
        err('Mes inválido (ej. oct 2026)')
        continue
      }
      pagosValidos.push({
        fila: r.fila,
        debt: key,
        fecha,
        periodo,
        pago_total: pago,
        interes,
        cargos,
        saldo_despues: saldo,
        es_estimado: false,
        fuente: isBlank(r.get('Fuente / notas')) ? null : String(r.get('Fuente / notas')).trim(),
        notas: isBlank(r.get('Notas')) ? null : String(r.get('Notas')).trim(),
        estimadoTxt: r.get('Estimado'),
      })
      rPagos.validas++
    }
  }
  // Interés estimado (regla 4) cuando el pago no trae interés ni cargos.
  pagosValidos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.fila - b.fila)
  const saldoPrevio = new Map(payload.debts.map((d) => [d.key, d.saldo_base]))
  for (const p of pagosValidos) {
    const { fila: _fila, estimadoTxt, ...pago } = p
    if (pago.interes == null && pago.cargos == null) {
      const a = analyzePayment({
        saldoAnterior: saldoPrevio.get(pago.debt) ?? 0,
        pagoTotal: pago.pago_total,
        saldoDespues: pago.saldo_despues,
        interes: null,
        cargos: null,
      })
      pago.interes = a.interes
      pago.es_estimado = a.esEstimado
    } else {
      pago.es_estimado = parseBool(estimadoTxt, false)
    }
    saldoPrevio.set(pago.debt, pago.saldo_despues)
    payload.payments.push(pago)
  }

  /* ---------- Compras con tarjeta y otros gastos */
  const tCompras = readTable(wb, SHEETS.compras.name, 'Fecha')
  const rCompras = report(SHEETS.compras.name, tCompras)
  reportes.push(rCompras)
  const tOtros = readTable(wb, SHEETS.otrosGastos.name, 'Fecha')
  const rOtros = report(SHEETS.otrosGastos.name, tOtros)
  const metodos: Record<string, BackupExpense['metodo']> = {
    efectivo: 'efectivo',
    debito: 'debito',
    tarjeta: 'tarjeta',
    transferencia: 'transferencia',
  }
  for (const [t, rep, esTarjeta] of [
    [tCompras, rCompras, true],
    [tOtros, rOtros, false],
  ] as const) {
    for (const r of t?.rows ?? []) {
      const err = (m: string) => rep.errores.push({ hoja: rep.hoja, fila: r.fila, mensaje: m })
      const fecha = parseDateCell(r.get('Fecha'))
      const monto = parseNumberCell(r.get('Monto'))
      const metodo = esTarjeta ? 'tarjeta' : metodos[normHeader(r.get('Método'))]
      const key = esTarjeta ? debtKey(r.get('Tarjeta')) : null
      if (!fecha) err('Fecha inválida (usá dd/mm/aaaa)')
      else if (monto == null || Number.isNaN(monto) || monto <= 0) err('Monto inválido')
      else if (!metodo) err('Método inválido (Efectivo, Débito o Transferencia)')
      else if (esTarjeta && !key) err(`La tarjeta "${r.get('Tarjeta') ?? ''}" no está en la hoja Deudas`)
      else {
        const periodo = isBlank(r.get('Mes')) ? `${fecha.slice(0, 7)}-01` : parsePeriodCell(r.get('Mes'))
        if (!periodo) {
          err('Mes inválido (ej. oct 2026)')
          continue
        }
        payload.expenses.push({
          debt: key ?? null,
          fecha,
          periodo,
          descripcion: String(r.get('Descripción') ?? '').trim() || 'Compra',
          categoria: String(r.get('Categoría') ?? '').trim() || 'Otro',
          monto,
          metodo,
        })
        rep.validas++
      }
    }
  }
  if (tOtros) reportes.push(rOtros)

  /* ---------- Saldos (detalle si existe; si no, la matriz) */
  const tDetalle = readTable(wb, SHEETS.detalle.name, 'Origen')
  const tSaldos = readTable(wb, SHEETS.saldos.name, 'Mes')
  const rSaldos = report(SHEETS.saldos.name, tSaldos)
  reportes.push(rSaldos)
  const origenes: Record<string, BackupSnapshot['origen']> = {
    historial: 'historial',
    registro: 'registro',
    manual: 'manual',
  }
  if (tDetalle && tDetalle.rows.length > 0) {
    rSaldos.avisos.push('Se usó la hoja "Saldos detalle" (exportada por Saldá), que conserva el origen de cada saldo.')
    rSaldos.filas = tDetalle.rows.length
    for (const r of tDetalle.rows) {
      const periodo = parsePeriodCell(r.get('Mes'))
      const key = debtKey(r.get('Deuda'))
      const saldo = parseNumberCell(r.get('Saldo'))
      const fuera = parseNumberCell(r.get('Cuotas fuera de saldo')) ?? 0
      if (!periodo || !key || saldo == null || Number.isNaN(saldo) || Number.isNaN(fuera)) {
        rSaldos.errores.push({ hoja: tDetalle.hoja, fila: r.fila, mensaje: 'Fila de saldo inválida' })
        continue
      }
      payload.snapshots.push({
        debt: key,
        periodo,
        saldo,
        cuotas_fuera_saldo: fuera,
        origen: origenes[normHeader(r.get('Origen'))] ?? 'historial',
      })
      rSaldos.validas++
    }
  } else if (tSaldos) {
    const cols = tSaldos.headers
      .map((h, j) => ({ h, j, key: debtKey(h) }))
      .filter(({ h }) => !['mes', 'cuotas fuera de saldo', 'total', 'total real', ''].includes(normHeader(h)))
    for (const c of cols.filter((c) => !c.key)) {
      rSaldos.avisos.push(`La columna "${c.h}" no coincide con ninguna deuda y se ignoró.`)
    }
    const fueraPorDeuda = new Map<string, number>()
    for (const i of payload.debt_installments.filter((x) => x.activa)) {
      const capital =
        i.capital_pendiente ?? (i.monto_cuota - i.cargo_extra_por_cuota) * (i.cuotas_totales - i.cuotas_cobradas)
      fueraPorDeuda.set(i.debt, Math.round(((fueraPorDeuda.get(i.debt) ?? 0) + capital) * 100) / 100)
    }
    const filas = tSaldos.rows
      .map((r) => ({ r, periodo: parsePeriodCell(r.get('Mes')) }))
      .filter(({ r, periodo }) => {
        if (!periodo) rSaldos.errores.push({ hoja: rSaldos.hoja, fila: r.fila, mensaje: 'Mes inválido (ej. oct 2026)' })
        return periodo != null
      })
    const ultimo = filas
      .map((f) => f.periodo!)
      .sort()
      .at(-1)
    for (const { r, periodo } of filas) {
      let ok = true
      for (const c of cols.filter((c) => c.key)) {
        const saldo = parseNumberCell(r.raw[c.j] ?? null)
        if (saldo == null) continue
        if (Number.isNaN(saldo)) {
          rSaldos.errores.push({ hoja: rSaldos.hoja, fila: r.fila, mensaje: `"${c.h}" no es un número` })
          ok = false
          continue
        }
        // Las cuotas fuera de saldo por deuda solo se conocen para el último mes (como en el seed).
        payload.snapshots.push({
          debt: c.key!,
          periodo: periodo!,
          saldo,
          cuotas_fuera_saldo: periodo === ultimo ? (fueraPorDeuda.get(c.key!) ?? 0) : 0,
          origen: 'historial',
        })
      }
      if (ok) rSaldos.validas++
    }
  }

  /* ---------- Hojas opcionales: gastos fijos, ingresos extra, cobros y perfil */
  const tFijos = readTable(wb, SHEETS.fijos.name, 'Concepto')
  if (tFijos) {
    const rep = report(SHEETS.fijos.name, tFijos)
    tFijos.rows.forEach((r, i) => {
      const monto = parseNumberCell(r.get('Monto'))
      const concepto = String(r.get('Concepto') ?? '').trim()
      if (!concepto || monto == null || Number.isNaN(monto)) {
        rep.errores.push({ hoja: rep.hoja, fila: r.fila, mensaje: 'Concepto o monto inválido' })
        return
      }
      payload.budget_items.push({ concepto, monto, activo: parseBool(r.get('Activo'), true), orden: i })
      rep.validas++
    })
    reportes.push(rep)
  }

  const tIngresos = readTable(wb, SHEETS.ingresos.name, 'Concepto')
  if (tIngresos) {
    const rep = report(SHEETS.ingresos.name, tIngresos)
    for (const r of tIngresos.rows) {
      const periodo = parsePeriodCell(r.get('Mes'))
      const monto = parseNumberCell(r.get('Monto'))
      if (!periodo || monto == null || Number.isNaN(monto) || monto <= 0) {
        rep.errores.push({ hoja: rep.hoja, fila: r.fila, mensaje: 'Mes o monto inválido' })
        continue
      }
      payload.extra_incomes.push({
        periodo,
        concepto: String(r.get('Concepto') ?? '').trim() || 'Ingreso extra',
        monto,
      })
      rep.validas++
    }
    reportes.push(rep)
  }

  const tCobros = readTable(wb, SHEETS.cobros.name, 'Persona')
  if (tCobros) {
    const rep = report(SHEETS.cobros.name, tCobros)
    for (const r of tCobros.rows) {
      const persona = String(r.get('Persona') ?? '').trim()
      const monto = parseNumberCell(r.get('Monto'))
      const saldo = parseNumberCell(r.get('Saldo')) ?? monto
      if (!persona || monto == null || Number.isNaN(monto) || saldo == null || Number.isNaN(saldo)) {
        rep.errores.push({ hoja: rep.hoja, fila: r.fila, mensaje: 'Persona o monto inválido' })
        continue
      }
      payload.receivables.push({
        persona,
        monto,
        saldo,
        notas: isBlank(r.get('Notas')) ? null : String(r.get('Notas')),
      })
      rep.validas++
    }
    reportes.push(rep)
  }

  const tPerfil = readTable(wb, SHEETS.perfil.name, 'Campo')
  if (tPerfil) {
    const campo = (c: string) => tPerfil.rows.find((r) => normHeader(r.get('Campo')) === normHeader(c))?.get('Valor')
    const ingreso = parseNumberCell(campo('Ingreso mensual') ?? null)
    payload.profile = {
      nombre: isBlank(campo('Nombre') ?? null) ? null : String(campo('Nombre')),
      ingreso_mensual: ingreso == null || Number.isNaN(ingreso) ? null : ingreso,
      moneda: isBlank(campo('Moneda') ?? null) ? 'GTQ' : String(campo('Moneda')),
    }
  }

  return { payload, reportes, fatal: null }
}

/** Escribe el libro como bytes .xlsx. */
export function workbookToArray(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

export function readWorkbookBytes(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { type: 'array' })
}
