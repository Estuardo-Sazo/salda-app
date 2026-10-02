import { describe, expect, it } from 'vitest'
import { chargeOne, cuotasRestantes, fueraDeSaldo } from './installments'

const inst = (extra: Partial<Parameters<typeof fueraDeSaldo>[0]> = {}) => ({
  monto_cuota: 250,
  cuotas_totales: 12,
  cuotas_cobradas: 5,
  capital_pendiente: null,
  cargo_extra_por_cuota: 0,
  ...extra,
})

describe('cuotas fuera de saldo', () => {
  it('fuera de saldo = (cuota − cargo) × restantes, o capital pendiente si existe', () => {
    expect(cuotasRestantes(inst())).toBe(7)
    expect(fueraDeSaldo(inst())).toBe(1750)
    expect(fueraDeSaldo(inst({ cargo_extra_por_cuota: 10 }))).toBe(1680)
    expect(fueraDeSaldo(inst({ capital_pendiente: 1500.5 }))).toBe(1500.5)
    expect(fueraDeSaldo(inst({ cuotas_cobradas: 12, capital_pendiente: 99 }))).toBe(0)
  })

  it('+1 cuota cobrada sin capital informado', () => {
    expect(chargeOne(inst())).toEqual({ cuotas_cobradas: 6, capital_pendiente: null })
  })

  it('+1 cuota cobrada descuenta capital proporcional y la última lo deja en cero', () => {
    expect(chargeOne(inst({ cuotas_totales: 10, cuotas_cobradas: 6, capital_pendiente: 715.4 }))).toEqual({
      cuotas_cobradas: 7,
      capital_pendiente: 536.55,
    })
    expect(chargeOne(inst({ cuotas_totales: 12, cuotas_cobradas: 11, capital_pendiente: 120.01 }))).toEqual({
      cuotas_cobradas: 12,
      capital_pendiente: 0,
    })
  })

  it('no permite cobrar más cuotas de las que hay', () => {
    expect(() => chargeOne(inst({ cuotas_cobradas: 12 }))).toThrow()
  })
})
