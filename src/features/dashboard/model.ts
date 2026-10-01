import { addMonths, monthsBetween } from '@/lib/finance/period'
import type { ActivePlan, DebtStatus, MonthlyBalance, MonthlyTotals } from '@/features/common/queries'

const round2 = (v: number) => Math.round(v * 100) / 100

export interface UpcomingPayment {
  debtId: string
  nombre: string
  dia: number
  /** 'YYYY-MM-DD' de este mes */
  fecha: string
  cuota: number | null
  pagado: boolean
}

export interface DashboardModel {
  periodo: string
  deudaReal: number
  saldoTotal: number
  cuotasFuera: number
  /** Cambio de saldos vs el mes anterior (negativo = bajó). */
  cambioMes: number | null
  /** Cambio de saldos desde el primer mes con datos (ej. ene 2026). */
  cambioDesdeInicio: number | null
  periodoInicio: string | null
  /** Interés + cargos / pagos del mes. */
  pctIntereses: number | null
  interesesMes: number
  pagosMes: number
  flujoLibre: number | null
  comprasTarjeta: number
  meta: { periodo: string; saldo: number; diferencia: number } | null
  metaInicio: string | null
  libre: { periodo: string; meses: number } | null
  proximosPagos: UpcomingPayment[]
  serie: { periodo: string; real: number | null; meta: number | null }[]
  /** Saldos por deuda y mes (para barras apiladas). */
  barras: { periodo: string; [debtId: string]: number | string }[]
  deudas: { id: string; nombre: string }[]
}

export interface DashboardInput {
  periodo: string
  totals: MonthlyTotals[]
  balances: MonthlyBalance[]
  debts: DebtStatus[]
  plan: ActivePlan | null
  paidDebtIds: Set<string>
}

/** Calcula los KPIs del dashboard a partir de las vistas (función pura, testeable). */
export function buildDashboard({
  periodo,
  totals,
  balances,
  debts,
  plan,
  paidDebtIds,
}: DashboardInput): DashboardModel {
  const byPeriod = new Map(totals.map((t) => [t.periodo, t]))
  // Si el mes actual no tiene datos todavía, se usa el último registrado.
  const current = byPeriod.get(periodo) ?? totals.at(-1)
  const prev = current ? byPeriod.get(addMonths(current.periodo, -1)) : undefined
  const first = totals[0]

  const metaByPeriod = new Map((plan?.totals ?? []).map((r) => [r.periodo, r.saldo]))
  const metaActual = current ? metaByPeriod.get(current.periodo) : undefined
  // En la gráfica, la meta parte de la deuda real con la que se generó el plan (mes anterior al inicio).
  const metaSerie = new Map(metaByPeriod)
  const deudaInicialPlan = plan?.plan.supuestos?.resumen.deuda_inicial
  if (plan && deudaInicialPlan != null) metaSerie.set(addMonths(plan.plan.fecha_inicio, -1), deudaInicialPlan)

  const activeDebts = debts.filter((d) => d.estado === 'activa')
  const [y, m] = periodo.split('-')
  const proximosPagos = activeDebts
    .filter((d) => d.dia_pago != null)
    .map<UpcomingPayment>((d) => ({
      debtId: d.debt_id,
      nombre: d.nombre,
      dia: d.dia_pago!,
      fecha: `${y}-${m}-${String(d.dia_pago).padStart(2, '0')}`,
      cuota: d.cuota_mensual,
      pagado: paidDebtIds.has(d.debt_id),
    }))
    .sort((a, b) => Number(a.pagado) - Number(b.pagado) || a.dia - b.dia)

  const periodoLibre = plan?.plan.supuestos?.resumen.periodo_libre ?? null

  // Serie real vs meta: desde el primer mes con datos hasta el fin del plan.
  const lastPeriod = plan?.totals.at(-1)?.periodo ?? totals.at(-1)?.periodo
  const serie: DashboardModel['serie'] = []
  if (first && lastPeriod) {
    for (let p = first.periodo; monthsBetween(p, lastPeriod) >= 0; p = addMonths(p, 1)) {
      serie.push({ periodo: p, real: byPeriod.get(p)?.total_real ?? null, meta: metaSerie.get(p) ?? null })
    }
  }

  const ordered = [...debts].sort((a, b) => (a.prioridad ?? 99) - (b.prioridad ?? 99))
  const barrasMap = new Map<string, DashboardModel['barras'][number]>()
  for (const b of balances) {
    const row = barrasMap.get(b.periodo) ?? { periodo: b.periodo }
    row[b.debt_id] = b.saldo
    barrasMap.set(b.periodo, row)
  }

  return {
    periodo: current?.periodo ?? periodo,
    deudaReal: current?.total_real ?? 0,
    saldoTotal: current?.saldo_total ?? 0,
    cuotasFuera: current?.cuotas_fuera_saldo ?? 0,
    // Las cuotas fuera de saldo solo existen desde que se registran, así que los cambios comparan saldos.
    cambioMes: current && prev ? round2(current.saldo_total - prev.saldo_total) : null,
    cambioDesdeInicio: current && first && first !== current ? round2(current.saldo_total - first.saldo_total) : null,
    periodoInicio: first?.periodo ?? null,
    pctIntereses: current && current.pagos > 0 ? current.interes_cargos / current.pagos : null,
    interesesMes: current?.interes_cargos ?? 0,
    pagosMes: current?.pagos ?? 0,
    flujoLibre: current?.ingreso_mensual != null ? current.flujo_libre : null,
    comprasTarjeta: current?.compras_tarjeta ?? 0,
    meta:
      current && metaActual != null
        ? { periodo: current.periodo, saldo: metaActual, diferencia: round2(current.total_real - metaActual) }
        : null,
    metaInicio: plan?.plan.fecha_inicio ?? null,
    libre: periodoLibre ? { periodo: periodoLibre, meses: Math.max(0, monthsBetween(periodo, periodoLibre)) } : null,
    proximosPagos,
    serie,
    barras: [...barrasMap.values()].sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))),
    deudas: ordered.map((d) => ({ id: d.debt_id, nombre: d.nombre })),
  }
}
