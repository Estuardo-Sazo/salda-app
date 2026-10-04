const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '2026-12-01' → 'dic 2026' (sin depender de /lib/format para mantener el motor puro). */
export function formatPeriodName(periodo: string): string {
  const [y, m] = periodo.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}
