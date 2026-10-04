import { describe, expect, it } from 'vitest'
import { projectPlan } from '@/lib/finance'
import {
  buildBalanceTable,
  buildCompareSeries,
  buildPlanVsReal,
  comparePlans,
  diffTone,
  planByDebt,
  summarizePlanRows,
  type BalanceSource,
  type PlanRowSource,
  type TotalsSource,
} from './model'
import { buildPlanInput, buildSavePlanPayload, suggestedBudget, type PlanSources } from './plan-input'

// Datos sintéticos (no son los del seed real).
const balances: BalanceSource[] = [
  { periodo: '2026-08-01', debt_id: 'a', saldo: 1000, cuotas_fuera_saldo: 0, origen: 'historial', es_registrado: true },
  { periodo: '2026-08-01', debt_id: 'b', saldo: 500, cuotas_fuera_saldo: 0, origen: 'historial', es_registrado: true },
  { periodo: '2026-09-01', debt_id: 'a', saldo: 900, cuotas_fuera_saldo: 0, origen: 'registro', es_registrado: true },
  { periodo: '2026-09-01', debt_id: 'b', saldo: 500, cuotas_fuera_saldo: 0, origen: 'historial', es_registrado: false },
  { periodo: '2026-10-01', debt_id: 'a', saldo: 850, cuotas_fuera_saldo: 0, origen: 'manual', es_registrado: true },
  { periodo: '2026-10-01', debt_id: 'b', saldo: 450, cuotas_fuera_saldo: 100, origen: 'registro', es_registrado: true },
]
const totals: TotalsSource[] = [
  { periodo: '2026-08-01', saldo_total: 1500, cuotas_fuera_saldo: 0, total_real: 1500 },
  { periodo: '2026-09-01', saldo_total: 1400, cuotas_fuera_saldo: 0, total_real: 1400 },
  { periodo: '2026-10-01', saldo_total: 1300, cuotas_fuera_saldo: 100, total_real: 1400 },
]
const planRows: PlanRowSource[] = [
  { periodo: '2026-09-01', debt_id: 'a', saldo: 950, pago: 100, interes_cargos: 10 },
  { periodo: '2026-09-01', debt_id: null, saldo: 1450, pago: 150, interes_cargos: 20 },
  { periodo: '2026-10-01', debt_id: 'a', saldo: 860, pago: 100, interes_cargos: 9 },
  { periodo: '2026-10-01', debt_id: null, saldo: 1350.5, pago: 150, interes_cargos: 18 },
  { periodo: '2026-11-01', debt_id: null, saldo: 1250, pago: 150, interes_cargos: 16 },
]

describe('saldos mensuales', () => {
  const table = buildBalanceTable(
    balances,
    totals,
    planRows.filter((r) => r.debt_id == null),
  )

  it('ordena del mes más reciente al más antiguo', () => {
    expect(table.map((r) => r.periodo)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01'])
  })

  it('marca el origen y los saldos arrastrados', () => {
    expect(table[0]!.celdas.a).toMatchObject({ saldo: 850, origen: 'manual', registrado: true })
    expect(table[1]!.celdas.b).toMatchObject({ saldo: 500, registrado: false })
  })

  it('calcula cambio vs mes anterior y diferencia contra la meta', () => {
    expect(table[0]).toMatchObject({ cambio: -100, meta: 1350.5, diferencia: 49.5 })
    expect(table[1]).toMatchObject({ cambio: -100, meta: 1450, diferencia: -50 })
    expect(table[2]).toMatchObject({ cambio: null, meta: null, diferencia: null })
  })
})

describe('plan vs real', () => {
  it('compara la meta con la deuda real de cada mes', () => {
    const rows = buildPlanVsReal(planRows, totals)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ mes: 1, meta: 1450, real: 1400, diferencia: -50 })
    expect(rows[1]).toMatchObject({ mes: 2, real: 1400, diferencia: 49.5 })
    expect(rows[2]).toMatchObject({ mes: 3, real: null, diferencia: null })
  })

  it('colorea: adelantado (≤ 0) en verde y atrasado (> 0) en rojo', () => {
    expect(diffTone(-50)).toBe('good')
    expect(diffTone(0)).toBe('good')
    expect(diffTone(0.01)).toBe('bad')
  })

  it('agrupa el plan por deuda', () => {
    expect(planByDebt(planRows)).toEqual([
      { periodo: '2026-09-01', saldos: { a: 950 } },
      { periodo: '2026-10-01', saldos: { a: 860 } },
    ])
  })
})

describe('comparación de planes', () => {
  it('resta B − A y cuenta meses de diferencia al quedar libre', () => {
    const a = { deudaInicial: 10, totalPagado: 1000, totalInteresCargos: 200, mesLibre: 10, periodoLibre: '2027-08-01' }
    const b = {
      deudaInicial: 10,
      totalPagado: 950.5,
      totalInteresCargos: 150.25,
      mesLibre: 7,
      periodoLibre: '2027-05-01',
    }
    expect(comparePlans(a, b)).toEqual({
      totalPagado: { a: 1000, b: 950.5, diferencia: -49.5 },
      interesCargos: { a: 200, b: 150.25, diferencia: -49.75 },
      mesLibre: { a: '2027-08-01', b: '2027-05-01', meses: -3 },
    })
  })

  it('resume un plan desde sus filas de totales', () => {
    expect(summarizePlanRows(planRows)).toMatchObject({ totalPagado: 450, totalInteresCargos: 54, periodoLibre: null })
    const libre = [...planRows, { periodo: '2026-12-01', debt_id: null, saldo: 0, pago: 1250, interes_cargos: 5 }]
    expect(summarizePlanRows(libre)).toMatchObject({ totalPagado: 1700, mesLibre: 4, periodoLibre: '2026-12-01' })
  })

  it('arma una serie con una columna por plan', () => {
    const serie = buildCompareSeries(
      [
        { id: 'p1', rows: planRows },
        { id: 'p2', rows: [{ periodo: '2026-12-01', debt_id: null, saldo: 1, pago: 1, interes_cargos: 0 }] },
      ],
      totals,
    )
    expect(serie.map((s) => s.periodo)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'])
    expect(serie[0]).toEqual({ periodo: '2026-09-01', real: 1400, p1: 1450, p2: null })
    expect(serie[3]).toEqual({ periodo: '2026-12-01', real: null, p1: null, p2: 1 })
  })
})

describe('generar plan desde los datos actuales', () => {
  const sources: PlanSources = {
    debts: [
      {
        debt_id: 'tc',
        nombre: 'Tarjeta X',
        tipo: 'tarjeta',
        estado: 'activa',
        tasa_anual: 0.6,
        cuota_mensual: 500,
        seguro_mensual: 20,
        saldo_cancelacion: null,
        saldo_actual: 3000,
        interes_modo: 'saldo',
        monto_original: null,
        pago_unico: false,
        saldo_para_cancelar: null,
      },
      {
        debt_id: 'fijo',
        nombre: 'Préstamo Y',
        tipo: 'prestamo',
        estado: 'activa',
        tasa_anual: 0.6,
        cuota_mensual: null,
        seguro_mensual: null,
        saldo_cancelacion: null,
        saldo_actual: 1000,
        interes_modo: 'monto_original',
        monto_original: 1000,
        pago_unico: true,
        fecha_vencimiento: '2026-12-15',
        interes_devengado: 50,
        saldo_para_cancelar: 1100,
      },
      {
        debt_id: 'vieja',
        nombre: 'Liquidada',
        tipo: 'prestamo',
        estado: 'liquidada',
        tasa_anual: 0.2,
        cuota_mensual: 300,
        seguro_mensual: null,
        saldo_cancelacion: null,
        saldo_actual: 0,
        monto_original: null,
        saldo_para_cancelar: null,
      },
    ],
    installments: [
      {
        debt_id: 'tc',
        descripcion: 'VC 6',
        monto_cuota: 100,
        cuotas_totales: 6,
        cuotas_cobradas: 2,
        capital_pendiente: null,
        cargo_extra_por_cuota: 0,
        activa: true,
      },
      {
        debt_id: 'tc',
        descripcion: 'Terminada',
        monto_cuota: 50,
        cuotas_totales: 3,
        cuotas_cobradas: 3,
        capital_pendiente: null,
        cargo_extra_por_cuota: 0,
        activa: true,
      },
    ],
    ingresoMensual: 5000,
    gastosFijos: 2000,
    ingresosExtra: [
      { periodo: '2026-12-01', monto: 1000 },
      { periodo: '2026-12-01', monto: 250.5 },
    ],
  }
  const opts = {
    estrategia: 'avalancha' as const,
    presupuestoDeudas: 800,
    abonoExtra: 0,
    fechaInicio: '2026-11-01',
    periodoActual: '2026-10-01',
  }

  it('toma solo deudas activas con su saldo actual y cuotas pendientes', () => {
    const input = buildPlanInput(sources, opts)
    expect(input.debts.map((d) => d.id)).toEqual(['tc', 'fijo'])
    expect(input.debts[0]).toMatchObject({ saldo: 3000, cuotaMensual: 500, seguroMensual: 20 })
    expect(input.debts[0]!.installments).toEqual([
      { descripcion: 'VC 6', montoCuota: 100, cuotasRestantes: 4, capitalPendiente: null, cargoExtraPorCuota: 0 },
    ])
    expect(input.ingresosExtra).toEqual({ '2026-12-01': 1250.5 })
  })

  it('un préstamo de interés fijo arranca con el cargo del mes y paga al vencimiento', () => {
    const fijo = buildPlanInput(sources, opts).debts[1]!
    expect(fijo).toMatchObject({ saldo: 1100, interesFijoMensual: 50, vencimiento: '2026-12-01', cuotaMensual: 0 })
    const actual = buildPlanInput(sources, { ...opts, fechaInicio: '2026-10-01' }).debts[1]!
    expect(actual.saldo).toBe(1050)
  })

  it('sugiere el presupuesto del plan activo o la suma de cuotas', () => {
    expect(suggestedBudget(sources.debts, 900)).toBe(900)
    expect(suggestedBudget(sources.debts, null)).toBe(500)
  })

  it('arma el payload de save_plan con filas por deuda y de totales', () => {
    const input = buildPlanInput(sources, opts)
    const result = projectPlan(input)
    const payload = buildSavePlanPayload(input, result, {
      nombre: ' Mi plan ',
      activo: true,
      periodoActual: '2026-10-01',
    })
    expect(payload).toMatchObject({
      nombre: 'Mi plan',
      estrategia: 'avalancha',
      fecha_inicio: '2026-11-01',
      activo: true,
    })
    const primerMes = payload.rows.filter((r) => r.periodo === '2026-11-01')
    expect(primerMes.map((r) => r.debt_id)).toEqual(['tc', 'fijo', null])
    expect(primerMes.at(-1)!.saldo).toBe(result.meses[0]!.deudaReal)
    expect(payload.supuestos.resumen.periodo_libre).toBe(result.periodoLibre)
    expect(payload.supuestos.supuestos[0]).toMatch(/último saldo registrado/)
    expect(payload.supuestos.deudas.map((d) => d.key)).toEqual(['tc', 'fijo'])
  })
})
