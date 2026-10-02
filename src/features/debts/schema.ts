import { z } from 'zod'
import {
  dateField,
  moneyField,
  optionalDateField,
  optionalIntField,
  optionalMoneyField,
  optionalPercentField,
  optionalText,
} from '@/lib/forms'

export const debtSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Poné un nombre (ej. "Tarjeta Oro")').max(60),
    entidad: optionalText(),
    tipo: z.enum(['tarjeta', 'prestamo']),
    saldo_base: moneyField('Ingresá el saldo actual'),
    fecha_base: dateField(),
    tasa_anual: optionalPercentField(),
    tasa_efectiva_anual: optionalPercentField(),
    cuota_mensual: optionalMoneyField(),
    seguro_mensual: optionalMoneyField(),
    dia_corte: optionalIntField(1, 31),
    dia_pago: optionalIntField(1, 31),
    limite_credito: optionalMoneyField(),
    saldo_cancelacion: optionalMoneyField(),
    saldo_cancelacion_fecha: optionalDateField(),
    cuotas_totales: optionalIntField(1, 600),
    cuota_actual: optionalIntField(0, 600),
    fecha_vencimiento: optionalDateField(),
    notas: optionalText(),
  })
  .refine((d) => d.cuota_actual == null || d.cuotas_totales == null || d.cuota_actual <= d.cuotas_totales, {
    path: ['cuota_actual'],
    message: 'No puede ser mayor que el total de cuotas',
  })

export type DebtFormInput = z.input<typeof debtSchema>
export type DebtFormOutput = z.output<typeof debtSchema>

export const installmentSchema = z
  .object({
    descripcion: z.string().trim().min(1, 'Describí la compra (ej. "Celular en visacuotas")'),
    monto_cuota: moneyField('Ingresá el monto de cada cuota').refine((v) => v > 0, 'Debe ser mayor a Q0'),
    cuotas_totales: optionalIntField(1, 120).pipe(z.number({ invalid_type_error: 'Requerido' })),
    cuotas_cobradas: optionalIntField(0, 120).transform((v) => v ?? 0),
    capital_pendiente: optionalMoneyField(),
    cargo_extra_por_cuota: optionalMoneyField().transform((v) => v ?? 0),
  })
  .refine((d) => d.cuotas_cobradas <= d.cuotas_totales, {
    path: ['cuotas_cobradas'],
    message: 'No puede superar el total de cuotas',
  })

export type InstallmentFormInput = z.input<typeof installmentSchema>
export type InstallmentFormOutput = z.output<typeof installmentSchema>
