import { z } from 'zod'
import type { SeedData } from './types'

// `seed/initial-data.json` tiene datos reales y está en .gitignore: si no existe (clon nuevo, deploy),
// se usa el archivo de ejemplo con datos ficticios. import.meta.glob no falla cuando el archivo falta.
const real = import.meta.glob<SeedData>('../../../seed/initial-data.json', { eager: true, import: 'default' })
const example = import.meta.glob<SeedData>('../../../seed/initial-data.example.json', {
  eager: true,
  import: 'default',
})

const realSeed = Object.values(real)[0]

/** true cuando el seed disponible es el de ejemplo (datos ficticios). */
export const isExampleSeed = realSeed === undefined
export const bundledSeed: SeedData = (realSeed ?? Object.values(example)[0]) as SeedData

const money = z.number().finite()
const nullableMoney = money.nullable().optional()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha esperada YYYY-MM-DD')

const seedSchema = z.object({
  profile: z.object({ nombre: z.string(), ingreso_mensual: money, moneda: z.string() }),
  budget_items: z.array(z.object({ concepto: z.string().min(1), monto: money })),
  debts: z
    .array(
      z
        .object({
          key: z.string().min(1),
          nombre: z.string().min(1),
          tipo: z.enum(['tarjeta', 'prestamo']),
          tasa_anual: money.nullable(),
          cuota_mensual: money.nullable(),
          seguro_mensual: nullableMoney,
          saldo_base: money,
          fecha_base: date,
        })
        .passthrough(),
    )
    .min(1, 'El archivo no tiene deudas'),
  debt_installments: z.array(
    z
      .object({
        debt: z.string(),
        descripcion: z.string(),
        monto_cuota: money,
        cuotas_totales: z.number().int().positive(),
        cuotas_cobradas: z.number().int().nonnegative(),
      })
      .passthrough(),
  ),
  monthly_snapshots_historial: z.record(z.string(), z.array(z.union([money, z.string(), z.null()]))),
  payments: z.array(z.object({ debt: z.string(), fecha: date, periodo: date, saldo_despues: money }).passthrough()),
  expenses: z.array(z.object({ fecha: date, periodo: date, monto: money }).passthrough()),
  receivables_opcional: z.array(z.object({ persona: z.string(), monto: money, saldo: money })).optional(),
  plan_inicial: z
    .object({
      nombre: z.string(),
      estrategia: z.enum(['avalancha', 'bola_nieve', 'cuotas_fijas']),
      presupuesto_deudas: money,
      fecha_inicio: date,
    })
    .passthrough(),
})

/** Valida un JSON con el formato de seed/initial-data.json (por ejemplo, subido desde el celular). */
export function parseSeed(input: unknown): SeedData {
  const result = seedSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`Archivo inválido${issue ? ` en ${issue.path.join('.')}: ${issue.message}` : ''}`)
  }
  const data = result.data as unknown as SeedData
  const keys = new Set(data.debts.map((d) => d.key))
  const refs = [...data.debt_installments, ...data.payments].map((r) => r.debt)
  const missing = refs.find((k) => !keys.has(k))
  if (missing) throw new Error(`Archivo inválido: la deuda "${missing}" no existe`)
  return data
}
