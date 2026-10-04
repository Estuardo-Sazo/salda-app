import { z } from 'zod'
import { dateField, moneyField, optionalMoneyField, optionalText } from '@/lib/forms'

export const paymentSchema = z.object({
  debt_id: z.string().min(1, 'Elegí una deuda'),
  pago_total: moneyField('Ingresá el monto pagado').refine((v) => v > 0, 'Debe ser mayor a cero'),
  fecha: dateField(),
  periodo: dateField('Elegí el período'),
  saldo_despues: moneyField('Ingresá el saldo después del pago (lo ves en la app del banco)'),
  interes: optionalMoneyField(),
  cargos: optionalMoneyField(),
  fuente: optionalText(),
  notas: optionalText(),
})

export type PaymentFormInput = z.input<typeof paymentSchema>
export type PaymentFormOutput = z.output<typeof paymentSchema>
