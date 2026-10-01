import { describe, expect, it } from 'vitest'
import exampleJson from '../../../seed/initial-data.example.json'
import { buildSeedPayload, historialToSnapshots } from './build-payload'
import { parseSeed } from './load'
import type { SeedData } from './types'

// Seed de ejemplo (ficticio). Las validaciones con datos reales viven en seed-data.private.test.ts (local).
const seed = exampleJson as unknown as SeedData
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b * 100, 0)) / 100

describe('historialToSnapshots', () => {
  const snapshots = historialToSnapshots(seed)

  it('omite meses sin dato (deuda cerrada después de abril)', () => {
    expect(snapshots.some((s) => s.debt === 'tarjeta-cerrada' && s.periodo === '2026-04-01')).toBe(true)
    expect(snapshots.some((s) => s.debt === 'tarjeta-cerrada' && s.periodo === '2026-05-01')).toBe(false)
  })

  it('las cuotas fuera de saldo solo se asignan al último mes y usan capital_pendiente', () => {
    const oct = snapshots.filter((s) => s.periodo === '2026-10-01')
    // 7 × 250 (sin capital informado) + 715.40 (capital_pendiente)
    expect(sum(oct.map((s) => s.cuotas_fuera_saldo))).toBe(2465.4)
    expect(snapshots.filter((s) => s.periodo !== '2026-10-01').every((s) => s.cuotas_fuera_saldo === 0)).toBe(true)
  })
})

describe('buildSeedPayload', () => {
  const payload = buildSeedPayload(seed)
  const activas = seed.debts.filter((d) => d.activa !== false).length

  it('genera el plan activo con una fila por deuda activa y mes, más totales', () => {
    const meses = new Set(payload.plan.rows.map((r) => r.periodo)).size
    expect(payload.plan.activo).toBe(true)
    expect(payload.plan.rows).toHaveLength(meses * (activas + 1))
    expect(payload.plan.rows[0]?.periodo).toBe('2026-11-01')
    expect(payload.plan.supuestos.resumen.deuda_inicial).toBe(sum(seed.debts.map((d) => d.saldo_base)) + 2465.4)
  })

  it('solo incluye "dinero que me deben" si se pide', () => {
    expect(payload.receivables).toHaveLength(0)
    expect(buildSeedPayload(seed, { includeReceivables: true }).receivables).toHaveLength(1)
  })
})

describe('parseSeed', () => {
  it('acepta un seed válido', () => {
    expect(parseSeed(structuredClone(exampleJson)).debts).toHaveLength(seed.debts.length)
  })

  it('rechaza archivos sin deudas o con campos inválidos', () => {
    expect(() => parseSeed({ ...structuredClone(exampleJson), debts: [] })).toThrow(/sin deudas|no tiene deudas/)
    expect(() => parseSeed({ foo: 1 })).toThrow(/Archivo inválido/)
  })

  it('rechaza referencias a deudas que no existen', () => {
    const bad = structuredClone(exampleJson)
    bad.payments[0]!.debt = 'no-existe'
    expect(() => parseSeed(bad)).toThrow(/"no-existe" no existe/)
  })
})
