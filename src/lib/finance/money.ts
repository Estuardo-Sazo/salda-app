import Decimal from 'decimal.js'

/** Instancia aislada para no depender de la configuración global de decimal.js. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export type Dec = InstanceType<typeof D>

export const ZERO = new D(0)
/** Por debajo de un centavo se considera saldado. */
export const EPSILON = new D('0.005')

export function dec(value: number | string | Dec): Dec {
  return new D(value)
}

/** Redondea a centavos y devuelve un number listo para mostrar o guardar. */
export function toMoney(value: Dec): number {
  return value.toDecimalPlaces(2).toNumber()
}

export function sumMoney(values: Iterable<Dec>): Dec {
  let total = ZERO
  for (const value of values) total = total.plus(value)
  return total
}
