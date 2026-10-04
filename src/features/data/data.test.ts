import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  buildBackup,
  compareTotals,
  isBackup,
  parseBackup,
  summarizeRestore,
  toRestorePayload,
  type RawTables,
} from './backup'
import { datasetCsv, toCsv } from './csv'
import {
  buildWorkbook,
  normHeader,
  parseDateCell,
  parseNumberCell,
  parsePeriodCell,
  readWorkbook,
  readWorkbookBytes,
  workbookToArray,
} from './excel'
import { initialPlan, sourcesFromPayload } from './initial-plan'

// Datos sintéticos (no son los del seed real).
const U = 'user-1'
const T = '2026-10-01T00:00:00Z'
const debtRow = (over: Partial<RawTables['debts'][number]> & { id: string; nombre: string }) => ({
  user_id: U,
  created_at: T,
  entidad: null,
  tipo: 'prestamo' as const,
  tasa_anual: 0.2,
  tasa_efectiva_anual: null,
  cuota_mensual: 300,
  seguro_mensual: null,
  dia_corte: null,
  dia_pago: 15,
  limite_credito: null,
  saldo_base: 3000,
  fecha_base: '2026-08-01',
  saldo_cancelacion: null,
  saldo_cancelacion_fecha: null,
  cuotas_totales: null,
  cuota_actual: null,
  fecha_vencimiento: null,
  prioridad: 1,
  activa: true,
  cerrada_en: null,
  notas: null,
  interes_modo: 'saldo',
  monto_original: null,
  pago_unico: false,
  ...over,
})

const tables: RawTables = {
  profile: { id: U, nombre: 'Ana', ingreso_mensual: '5000.00' as unknown as number, moneda: 'GTQ', created_at: T },
  budget_items: [
    { id: 'b1', user_id: U, concepto: 'Comida', monto: 1500, activo: true, orden: 0, created_at: T },
    { id: 'b2', user_id: U, concepto: 'Gimnasio', monto: 200, activo: false, orden: 1, created_at: T },
  ],
  debts: [
    debtRow({
      id: 'd-tc',
      nombre: 'Tarjeta Azul',
      tipo: 'tarjeta',
      tasa_anual: 0.6,
      tasa_efectiva_anual: 0.6486,
      cuota_mensual: 400,
      seguro_mensual: null,
      dia_corte: 24,
      limite_credito: 8000,
      saldo_base: 4000,
      saldo_cancelacion: 4100.5,
      saldo_cancelacion_fecha: '2026-09-30',
      notas: 'Notas, con "comillas"',
    }),
    debtRow({
      id: 'd-fijo',
      nombre: 'Préstamo Fijo',
      tasa_anual: 0.6,
      cuota_mensual: null,
      saldo_base: 1000,
      fecha_base: '2026-09-01',
      fecha_vencimiento: '2026-12-15',
      interes_modo: 'monto_original',
      monto_original: 1000,
      pago_unico: true,
      prioridad: 2,
    }),
  ],
  debt_installments: [
    {
      id: 'i1',
      user_id: U,
      debt_id: 'd-tc',
      descripcion: 'VC 6',
      monto_cuota: 100,
      cuotas_totales: 6,
      cuotas_cobradas: 2,
      capital_pendiente: null,
      cargo_extra_por_cuota: 0,
      activa: true,
      created_at: T,
    },
  ],
  monthly_snapshots: [
    {
      id: 's1',
      user_id: U,
      debt_id: 'd-tc',
      periodo: '2026-08-01',
      saldo: 4000,
      cuotas_fuera_saldo: 0,
      origen: 'historial',
    },
    {
      id: 's2',
      user_id: U,
      debt_id: 'd-tc',
      periodo: '2026-09-01',
      saldo: 3800,
      cuotas_fuera_saldo: 400,
      origen: 'registro',
    },
    {
      id: 's3',
      user_id: U,
      debt_id: 'd-fijo',
      periodo: '2026-09-01',
      saldo: 1000,
      cuotas_fuera_saldo: 0,
      origen: 'manual',
    },
  ],
  payments: [
    {
      id: 'p1',
      user_id: U,
      debt_id: 'd-tc',
      fecha: '2026-09-17',
      periodo: '2026-09-01',
      pago_total: 400,
      interes: 200,
      cargos: null,
      capital: 200,
      saldo_despues: 3800,
      es_estimado: true,
      fuente: 'App',
      notas: 'nota',
      created_at: T,
    },
  ],
  expenses: [
    {
      id: 'e1',
      user_id: U,
      fecha: '2026-09-20',
      periodo: '2026-09-01',
      descripcion: 'Zapatos',
      categoria: 'Otro',
      monto: 350,
      metodo: 'tarjeta',
      debt_id: 'd-tc',
      created_at: T,
    },
    {
      id: 'e2',
      user_id: U,
      fecha: '2026-09-21',
      periodo: '2026-09-01',
      descripcion: 'Almuerzo',
      categoria: 'Comida',
      monto: 45.5,
      metodo: 'efectivo',
      debt_id: null,
      created_at: T,
    },
  ],
  extra_incomes: [{ id: 'x1', user_id: U, periodo: '2026-12-01', concepto: 'Aguinaldo', monto: 5000, created_at: T }],
  receivables: [{ id: 'r1', user_id: U, persona: 'Beto', monto: 300, saldo: 100, notas: null, created_at: T }],
  plans: [
    {
      id: 'pl1',
      user_id: U,
      nombre: 'Plan A',
      estrategia: 'avalancha',
      presupuesto_deudas: 700,
      abono_extra: 0,
      fecha_inicio: '2026-11-01',
      activo: true,
      supuestos: null,
      created_at: T,
    },
  ],
  plan_rows: [
    {
      id: 'pr1',
      user_id: U,
      plan_id: 'pl1',
      periodo: '2026-11-01',
      debt_id: 'd-tc',
      saldo: 3600,
      pago: 400,
      interes_cargos: 190,
    },
    {
      id: 'pr2',
      user_id: U,
      plan_id: 'pl1',
      periodo: '2026-11-01',
      debt_id: null,
      saldo: 4900,
      pago: 400,
      interes_cargos: 240,
    },
  ],
  monthly_totals: [
    {
      user_id: U,
      periodo: '2026-09-01',
      saldo_total: 4800,
      cuotas_fuera_saldo: 400,
      total_real: 5200,
      pagos: 400,
      interes_cargos: 200,
      capital: 200,
      compras_tarjeta: 350,
      gastos_total: 395.5,
      ingreso_mensual: 5000,
      gastos_fijos: 1500,
      flujo_libre: 3100,
      ingresos_extra: 0,
    },
  ],
}

const backup = buildBackup(tables, '2026-10-04T12:00:00Z')

describe('respaldo JSON', () => {
  it('usa los uuid como llaves y normaliza los números', () => {
    expect(backup.formato).toBe('salda-respaldo')
    expect(backup.profile).toEqual({ nombre: 'Ana', ingreso_mensual: 5000, moneda: 'GTQ' })
    expect(backup.debts.map((d) => d.key)).toEqual(['d-tc', 'd-fijo'])
    expect(backup.snapshots.map((s) => s.origen)).toEqual(['historial', 'registro', 'manual'])
    expect(backup.plans[0]!.rows.map((r) => r.debt)).toEqual(['d-tc', null])
    expect(backup.totales).toEqual([
      {
        periodo: '2026-09-01',
        saldo_total: 4800,
        total_real: 5200,
        pagos: 400,
        interes_cargos: 200,
        gastos_total: 395.5,
      },
    ])
  })

  it('se valida al leerlo y quita los metadatos para la RPC', () => {
    const json = JSON.parse(JSON.stringify(backup))
    expect(isBackup(json)).toBe(true)
    expect(isBackup({ profile: {} })).toBe(false)
    const parsed = parseBackup(json)
    const payload = toRestorePayload(parsed)
    expect(Object.keys(payload)).not.toContain('totales')
    expect(Object.keys(payload)).not.toContain('formato')
    expect(summarizeRestore(payload)).toMatchObject({
      deudas: 2,
      pagos: 1,
      planes: 1,
      desde: '2026-08-01',
      hasta: '2026-09-01',
    })
  })

  it('rechaza un respaldo con referencias rotas', () => {
    const roto = JSON.parse(JSON.stringify(backup))
    roto.payments[0].debt = 'otra'
    expect(() => parseBackup(roto)).toThrow(/deuda que no existe/)
    expect(() => parseBackup({ formato: 'salda-respaldo', version: 1 })).toThrow(/Respaldo inválido/)
  })

  it('compara totales con tolerancia de un centavo', () => {
    const t = backup.totales
    expect(compareTotals(t, t)).toEqual([])
    expect(compareTotals(t, [{ ...t[0]!, total_real: 5200.004 }])).toEqual([])
    expect(compareTotals(t, [{ ...t[0]!, pagos: 300 }])).toEqual([
      { periodo: '2026-09-01', campo: 'pagos', esperado: 400, obtenido: 300 },
    ])
    expect(compareTotals(t, [])).toHaveLength(5)
  })
})

describe('Excel: ida y vuelta', () => {
  const wb = readWorkbookBytes(workbookToArray(buildWorkbook(backup)))
  const { payload, reportes, fatal } = readWorkbook(wb, '2026-10-01')
  const nombre = (key: string | null) => payload.debts.find((d) => d.key === key)?.nombre ?? null

  it('tiene las hojas de Control_deudas.xlsx con el encabezado en su fila', () => {
    expect(wb.SheetNames.slice(0, 4)).toEqual(['Deudas', 'Registro de pagos', 'Compras tarjetas', 'Saldos mensuales'])
    const fila = (hoja: string, f: number) =>
      XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja]!, { header: 1, blankrows: true })[f - 1]
    expect((fila('Deudas', 3) as string[])[0]).toBe('Deuda')
    expect((fila('Registro de pagos', 5) as string[])[0]).toBe('Fecha')
    expect((fila('Compras tarjetas', 4) as string[])[2]).toBe('Tarjeta')
    expect((fila('Saldos mensuales', 4) as string[]).at(-1)).toBe('Cuotas fuera de saldo')
  })

  it('no reporta errores y recupera todas las deudas', () => {
    expect(fatal).toBeNull()
    expect(reportes.flatMap((r) => [...r.errores, ...r.duplicados])).toEqual([])
    const sinKey = (d: (typeof backup.debts)[number]) => ({ ...d, key: undefined })
    expect(payload.debts.map(sinKey)).toEqual(backup.debts.map(sinKey))
  })

  it('recupera pagos, gastos, cuotas, saldos con su origen y el resto', () => {
    expect(payload.payments.map((p) => ({ ...p, debt: nombre(p.debt) }))).toEqual(
      backup.payments.map((p) => ({ ...p, debt: 'Tarjeta Azul' })),
    )
    expect(payload.expenses.map((e) => ({ ...e, debt: nombre(e.debt) }))).toEqual(
      backup.expenses.map((e) => ({ ...e, debt: e.debt ? 'Tarjeta Azul' : null })),
    )
    expect(payload.debt_installments.map((i) => ({ ...i, debt: nombre(i.debt) }))).toEqual(
      backup.debt_installments.map((i) => ({ ...i, debt: 'Tarjeta Azul' })),
    )
    expect(payload.snapshots.map((s) => ({ ...s, debt: nombre(s.debt) }))).toEqual(
      backup.snapshots.map((s) => ({ ...s, debt: s.debt === 'd-tc' ? 'Tarjeta Azul' : 'Préstamo Fijo' })),
    )
    expect(payload.budget_items).toEqual(backup.budget_items)
    expect(payload.extra_incomes).toEqual(backup.extra_incomes)
    expect(payload.receivables).toEqual(backup.receivables)
    expect(payload.profile).toEqual(backup.profile)
  })
})

describe('Excel: archivo armado a mano', () => {
  const libro = (sheets: Record<string, unknown[][]>) => {
    const wb = XLSX.utils.book_new()
    for (const [name, aoa] of Object.entries(sheets))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
    return readWorkbookBytes(workbookToArray(wb))
  }
  const deudas = [
    ['Control de deudas'],
    [],
    [
      'Deuda',
      'Tipo',
      'Tasa anual',
      'Cuota mensual',
      'Día de pago',
      'Saldo base (oct 2026)',
      'Saldo cancelación (banco)',
      'Notas',
    ],
    ['Visa', 'Tarjeta', '60%', 500, 17, 2000, 'PENDIENTE DE CONFIRMAR', null],
    ['Moto', 'préstamo', 18, 'Q1,250.00', 5, 9000.5, 8800, 'Taller'],
    ['Visa', 'Tarjeta', 0.5, 1, 1, 1, null, null],
    ['Sin tipo', 'Otro', 0.1, 1, 1, 1, null, null],
  ]

  it('lee el formato original: fecha base del encabezado, porcentajes y PENDIENTE', () => {
    const { payload, reportes, fatal } = readWorkbook(libro({ Deudas: deudas }), '2026-10-01')
    expect(fatal).toBeNull()
    expect(
      payload.debts.map((d) => [
        d.nombre,
        d.tipo,
        d.tasa_anual,
        d.cuota_mensual,
        d.saldo_base,
        d.fecha_base,
        d.saldo_cancelacion,
      ]),
    ).toEqual([
      ['Visa', 'tarjeta', 0.6, 500, 2000, '2026-10-01', null],
      ['Moto', 'prestamo', 0.18, 1250, 9000.5, '2026-10-01', 8800],
    ])
    expect(reportes[0]).toMatchObject({ validas: 2, filas: 4 })
    expect(reportes[0]!.duplicados[0]).toMatchObject({ fila: 6 })
    expect(reportes[0]!.errores[0]).toMatchObject({ fila: 7, mensaje: expect.stringMatching(/Tarjeta o Préstamo/) })
  })

  it('valida pagos, detecta duplicados y estima el interés si falta', () => {
    const { payload, reportes } = readWorkbook(
      libro({
        Deudas: deudas,
        'Registro de pagos': [
          ['Registro'],
          [],
          [],
          [],
          [
            'Fecha',
            'Mes',
            'Deuda',
            'Pago total',
            'Interés',
            'Seguro / otros cargos',
            'Saldo después del pago',
            'Fuente / notas',
          ],
          ['17/10/2026', 'oct 2026', 'visa', 500, null, null, 1600, 'App'],
          ['17/10/2026', 'oct 2026', 'Visa', 500, null, null, 1600, 'App'],
          [46310, null, 'Moto', 1250, 135, 0, 7900, null],
          ['31/02/2026', null, 'Moto', 10, null, null, 1, null],
          ['01/10/2026', null, 'Carro', 10, null, null, 1, null],
        ],
      }),
      '2026-10-01',
    )
    const pagos = reportes.find((r) => r.hoja === 'Registro de pagos')!
    expect(pagos).toMatchObject({ filas: 5, validas: 2 })
    expect(pagos.duplicados.map((d) => d.fila)).toEqual([7])
    expect(pagos.errores.map((e) => e.fila)).toEqual([9, 10])
    expect(payload.payments).toEqual([
      expect.objectContaining({
        fecha: '2026-10-15',
        periodo: '2026-10-01',
        interes: 135,
        cargos: 0,
        es_estimado: false,
      }),
      expect.objectContaining({ fecha: '2026-10-17', interes: 100, es_estimado: true, saldo_despues: 1600 }),
    ])
  })

  it('arma saldos desde la matriz y asigna cuotas fuera de saldo al último mes', () => {
    const { payload, reportes } = readWorkbook(
      libro({
        Deudas: deudas,
        'Cuotas fuera de saldo': [
          [],
          [],
          ['Deuda', 'Descripción', 'Monto cuota', 'Cuotas totales', 'Cuotas cobradas'],
          ['Visa', 'VC', 100, 10, 7],
        ],
        'Saldos mensuales': [
          [],
          [],
          [],
          ['Mes', 'Visa', 'Moto', 'Otra', 'Cuotas fuera de saldo'],
          ['sep 2026', 2200, 9500, 1, null],
          ['oct 2026', 2000, null, null, 300],
        ],
      }),
      '2026-10-01',
    )
    expect(payload.snapshots).toEqual([
      { debt: 'xl1', periodo: '2026-09-01', saldo: 2200, cuotas_fuera_saldo: 0, origen: 'historial' },
      { debt: 'xl2', periodo: '2026-09-01', saldo: 9500, cuotas_fuera_saldo: 0, origen: 'historial' },
      { debt: 'xl1', periodo: '2026-10-01', saldo: 2000, cuotas_fuera_saldo: 300, origen: 'historial' },
    ])
    expect(reportes.find((r) => r.hoja === 'Saldos mensuales')!.avisos[0]).toMatch(/"Otra"/)
  })

  it('sin hoja Deudas no se puede importar', () => {
    expect(readWorkbook(libro({ Hoja1: [['x']] }), '2026-10-01').fatal).toMatch(/Deudas/)
  })

  it('interpreta celdas de fecha, mes y número', () => {
    expect(normHeader(' Saldo  cancelación (banco) ')).toBe('saldo cancelacion')
    expect(parseDateCell('5/1/2027')).toBe('2027-01-05')
    expect(parseDateCell('2026-10-17')).toBe('2026-10-17')
    expect(parseDateCell('30/02/2026')).toBeNull()
    expect(parsePeriodCell('Octubre 2026')).toBe('2026-10-01')
    expect(parsePeriodCell('2026-03')).toBe('2026-03-01')
    expect(parsePeriodCell('foo')).toBeNull()
    expect(parseNumberCell('Q1,234.50')).toBe(1234.5)
    expect(parseNumberCell('12.5%')).toBe(0.125)
    expect(parseNumberCell('abc')).toBeNaN()
    expect(parseNumberCell('')).toBeNull()
  })
})

describe('CSV', () => {
  it('escapa comillas, comas y saltos de línea, con BOM', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'di "hola"'],
          [1.5, null],
          [true, 'l1\nl2'],
        ],
      ),
    ).toBe('﻿a,b\r\n"x,y","di ""hola"""\r\n1.5,\r\nSí,"l1\nl2"\r\n')
  })

  it('exporta los pagos con capital y nombre de la deuda', () => {
    const lines = datasetCsv(backup, 'pagos').split('\r\n')
    expect(lines[1]).toBe('17/09/2026,sep 2026,Tarjeta Azul,400,200,,200,3800,Sí,App,nota')
    expect(datasetCsv(backup, 'deudas')).toContain('PENDIENTE')
  })
})

describe('plan inicial de una cuenta nueva', () => {
  const payload = toRestorePayload(backup)

  it('arranca desde el último saldo y el cargo fijo del mes', () => {
    const src = sourcesFromPayload(payload, '2026-10-01')
    expect(src.debts.map((d) => [d.debt_id, d.estado, d.saldo_actual])).toEqual([
      ['d-tc', 'activa', 3800],
      ['d-fijo', 'activa', 1000],
    ])
    // Préstamo fijo: base sep 2026 + cargos de sep y oct (Q50 c/u) al cancelar en oct.
    expect(src.debts[1]!.saldo_para_cancelar).toBe(1100)
    expect(src.gastosFijos).toBe(1500)
  })

  it('genera un plan activo con filas por deuda y totales', () => {
    const plan = initialPlan(payload, { estrategia: 'avalancha', presupuestoDeudas: 700, periodoActual: '2026-10-01' })
    expect(plan).toMatchObject({ activo: true, fecha_inicio: '2026-11-01', estrategia: 'avalancha' })
    expect(plan.rows.filter((r) => r.periodo === '2026-11-01').map((r) => r.debt)).toEqual(['d-tc', 'd-fijo', null])
    expect(plan.supuestos?.resumen.periodo_libre).not.toBeNull()
  })
})
