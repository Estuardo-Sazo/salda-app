import { z } from 'zod'
import { dateField, moneyField } from '@/lib/forms'

export const expenseSchema = z
  .object({
    monto: moneyField('Ingresá el monto').refine((v) => v > 0, 'Debe ser mayor a cero'),
    descripcion: z.string().trim().min(1, '¿En qué fue? (ej. "Supermercado")').max(80),
    categoria: z.string().min(1, 'Elegí una categoría'),
    metodo: z.enum(['efectivo', 'debito', 'tarjeta', 'transferencia']),
    debt_id: z.string(),
    fecha: dateField(),
    periodo: dateField('Elegí el período'),
  })
  // Regla de la BD (tarjeta_requiere_deuda): con tarjeta hay que decir cuál.
  .refine((v) => v.metodo !== 'tarjeta' || v.debt_id !== '', {
    path: ['debt_id'],
    message: '¿Con qué tarjeta?',
  })
  .transform((v) => ({ ...v, debt_id: v.metodo === 'tarjeta' ? v.debt_id : null }))

export type ExpenseFormInput = z.input<typeof expenseSchema>
export type ExpenseFormOutput = z.output<typeof expenseSchema>

export const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Débito' },
  { value: 'tarjeta', label: 'Tarjeta de crédito' },
  { value: 'transferencia', label: 'Transferencia' },
] as const

export const METODO_LABEL: Record<ExpenseFormInput['metodo'], string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}
