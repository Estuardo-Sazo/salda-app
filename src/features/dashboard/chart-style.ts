/** Color fijo por entidad (orden de prioridad de la deuda), nunca por ranking. */
export const seriesColor = (index: number) => `var(--series-${(index % 8) + 1})`

export const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const
