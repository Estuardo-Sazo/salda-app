import { ZERO, dec, sumMoney, toMoney } from './money'

export const CATEGORIAS = ['Comida', 'Recargas', 'Suscripción', 'Juegos', 'Servicios', 'Emergencia', 'Otro'] as const
export type Metodo = 'efectivo' | 'debito' | 'tarjeta' | 'transferencia'

export interface ExpenseLike {
  monto: number
  categoria: string
  metodo: Metodo
  debt_id: string | null
}

export interface ExpenseSummary {
  total: number
  /** Compras con tarjeta = deuda nueva. */
  tarjeta: number
  porCategoria: { categoria: string; total: number; pct: number }[]
  porMetodo: Record<Metodo, number>
  /** Tasa anual ponderada por monto de las compras con tarjeta (null si no hay tasas conocidas). */
  tasaTarjeta: number | null
  /** Interés aproximado de un mes si las compras con tarjeta no se pagan completas. */
  interesMensualTarjeta: number
}

/** Resumen de gastos de un período. `tasas` mapea debt_id → tasa anual (null = PENDIENTE). */
export function summarizeExpenses(expenses: ExpenseLike[], tasas: Record<string, number | null> = {}): ExpenseSummary {
  const total = sumMoney(expenses.map((e) => dec(e.monto)))
  const porMetodo: Record<Metodo, number> = { efectivo: 0, debito: 0, tarjeta: 0, transferencia: 0 }
  const categorias = new Map<string, ReturnType<typeof dec>>()
  let tarjeta = ZERO
  let conTasa = ZERO
  let ponderado = ZERO

  for (const e of expenses) {
    const monto = dec(e.monto)
    porMetodo[e.metodo] = toMoney(dec(porMetodo[e.metodo]).plus(monto))
    categorias.set(e.categoria, (categorias.get(e.categoria) ?? ZERO).plus(monto))
    if (e.metodo === 'tarjeta') {
      tarjeta = tarjeta.plus(monto)
      const tasa = e.debt_id ? tasas[e.debt_id] : null
      if (tasa != null) {
        conTasa = conTasa.plus(monto)
        ponderado = ponderado.plus(monto.times(tasa))
      }
    }
  }

  const tasaTarjeta = conTasa.gt(0) ? ponderado.div(conTasa).toDecimalPlaces(4).toNumber() : null
  return {
    total: toMoney(total),
    tarjeta: toMoney(tarjeta),
    porCategoria: [...categorias.entries()]
      .map(([categoria, t]) => ({
        categoria,
        total: toMoney(t),
        pct: total.gt(0) ? t.div(total).toDecimalPlaces(4).toNumber() : 0,
      }))
      .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria)),
    porMetodo,
    tasaTarjeta,
    interesMensualTarjeta: toMoney(ponderado.div(12)),
  }
}

/** Interés de un mes sobre una compra con tarjeta que no se paga al corte. */
export function monthlyInterestOn(monto: number, tasaAnual: number | null): number | null {
  if (tasaAnual == null) return null
  return toMoney(dec(monto).times(tasaAnual).div(12))
}
