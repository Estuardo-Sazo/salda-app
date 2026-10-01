export type DebtType = 'tarjeta' | 'prestamo'
export type Strategy = 'avalancha' | 'bola_nieve' | 'cuotas_fijas'

/** Cuota que el banco aún no cobra (intracuota, visacuota, extrafinanciamiento). */
export interface InstallmentInput {
  descripcion: string
  montoCuota: number
  cuotasRestantes: number
  /** Capital pendiente informado por el banco; si existe, manda sobre montoCuota × restantes. */
  capitalPendiente: number | null
  /** Interés o cargo administrativo incluido en cada cuota (cuenta como costo). */
  cargoExtraPorCuota: number
}

export interface DebtInput {
  id: string
  nombre: string
  tipo: DebtType
  saldo: number
  /** null = PENDIENTE DE CONFIRMAR (se proyecta como 0 % y se advierte). */
  tasaAnual: number | null
  cuotaMensual: number
  /** null = PENDIENTE DE CONFIRMAR (se proyecta como 0 y se advierte). */
  seguroMensual: number | null
  saldoCancelacion?: number | null
  installments?: InstallmentInput[]
}

export interface PlanInput {
  debts: DebtInput[]
  estrategia: Strategy
  presupuestoDeudas: number
  abonoExtra?: number
  /** Primer mes del plan, formato YYYY-MM-01. */
  fechaInicio: string
  ingresoMensual?: number
  gastosFijos?: number
  maxMeses?: number
}

export interface DebtMonth {
  saldo: number
  fueraSaldo: number
  total: number
  pago: number
  interes: number
  cargos: number
}

export interface PlanMonth {
  mes: number
  periodo: string
  deudas: Record<string, DebtMonth>
  saldoTotal: number
  fueraSaldoTotal: number
  deudaReal: number
  pago: number
  interesCargos: number
  flujoLibre: number
}

export interface Liquidacion {
  mes: number
  periodo: string
}

export interface PlanResult {
  meses: PlanMonth[]
  deudaInicial: number
  totalPagado: number
  totalInteresCargos: number
  /** Mes (1-based) en que la deuda real llega a cero; null si no ocurre dentro del horizonte. */
  mesLibre: number | null
  periodoLibre: string | null
  liquidaciones: Record<string, Liquidacion | null>
  supuestos: string[]
  advertencias: string[]
}
