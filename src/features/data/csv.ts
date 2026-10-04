import { formatDate, formatPeriod } from '@/lib/format'
import type { Backup, BackupTotal } from './backup'

/** Celda CSV: entre comillas si trae separador, comillas o saltos de línea. */
function cell(v: string | number | boolean | null | undefined): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con BOM para que Excel reconozca los acentos. Montos con punto decimal y sin separador de miles. */
export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export type CsvDataset = 'pagos' | 'gastos' | 'saldos' | 'totales' | 'deudas'

export const CSV_DATASETS: Record<CsvDataset, string> = {
  pagos: 'Pagos',
  gastos: 'Gastos',
  saldos: 'Saldos mensuales',
  totales: 'Totales por mes',
  deudas: 'Deudas',
}

export function datasetCsv(b: Backup, dataset: CsvDataset): string {
  const nombre = new Map(b.debts.map((d) => [d.key, d.nombre]))
  const deuda = (k: string | null) => (k ? (nombre.get(k) ?? '') : '')
  switch (dataset) {
    case 'pagos':
      return toCsv(
        [
          'Fecha',
          'Mes',
          'Deuda',
          'Pago total',
          'Interés',
          'Cargos',
          'Capital',
          'Saldo después',
          'Estimado',
          'Fuente',
          'Notas',
        ],
        b.payments.map((p) => [
          formatDate(p.fecha),
          formatPeriod(p.periodo),
          deuda(p.debt),
          p.pago_total,
          p.interes,
          p.cargos,
          Math.round((p.pago_total - (p.interes ?? 0) - (p.cargos ?? 0)) * 100) / 100,
          p.saldo_despues,
          p.es_estimado,
          p.fuente,
          p.notas,
        ]),
      )
    case 'gastos':
      return toCsv(
        ['Fecha', 'Mes', 'Descripción', 'Categoría', 'Monto', 'Método', 'Tarjeta'],
        b.expenses.map((e) => [
          formatDate(e.fecha),
          formatPeriod(e.periodo),
          e.descripcion,
          e.categoria,
          e.monto,
          e.metodo,
          deuda(e.debt),
        ]),
      )
    case 'saldos':
      return toCsv(
        ['Mes', 'Deuda', 'Saldo', 'Cuotas fuera de saldo', 'Origen'],
        b.snapshots.map((s) => [formatPeriod(s.periodo), deuda(s.debt), s.saldo, s.cuotas_fuera_saldo, s.origen]),
      )
    case 'totales':
      return toCsv(
        ['Mes', 'Saldos', 'Total real', 'Pagos', 'Interés y cargos', 'Gastos'],
        b.totales.map((t: BackupTotal) => [
          formatPeriod(t.periodo),
          t.saldo_total,
          t.total_real,
          t.pagos,
          t.interes_cargos,
          t.gastos_total,
        ]),
      )
    case 'deudas':
      return toCsv(
        [
          'Deuda',
          'Tipo',
          'Entidad',
          'Tasa anual',
          'Cuota mensual',
          'Seguro mensual',
          'Día de pago',
          'Saldo base',
          'Fecha base',
          'Saldo cancelación',
          'Activa',
        ],
        b.debts.map((d) => [
          d.nombre,
          d.tipo,
          d.entidad,
          d.tasa_anual ?? 'PENDIENTE',
          d.cuota_mensual,
          d.seguro_mensual ?? (d.tipo === 'tarjeta' ? 'PENDIENTE' : null),
          d.dia_pago,
          d.saldo_base,
          formatDate(d.fecha_base),
          d.saldo_cancelacion ?? 'PENDIENTE',
          d.activa,
        ]),
      )
  }
}
