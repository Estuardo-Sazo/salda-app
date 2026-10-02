import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false mientras falte el .env: la app muestra la pantalla de configuración. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** Devuelve los datos de una respuesta de supabase-js o lanza su error. */
export function unwrap<R extends Result>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R['data']>
}

/** Postgres devuelve numeric como string; esto lo normaliza a number. */
export function num(value: number | string | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}

export function numOrNull(value: number | string | null | undefined): number | null {
  return value == null ? null : num(value)
}
