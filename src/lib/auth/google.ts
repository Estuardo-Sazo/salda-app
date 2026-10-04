/** Google Identity Services (One Tap y botón oficial). Solo lo que usa Saldá. */

export interface GoogleCredentialResponse {
  /** ID token (JWT) firmado por Google. */
  credential: string
}

interface GoogleIdConfig {
  client_id: string
  callback: (r: GoogleCredentialResponse) => void
  nonce?: string
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  itp_support?: boolean
  use_fedcm_for_prompt?: boolean
}

interface GoogleButtonConfig {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

export interface GoogleAccountsId {
  initialize: (config: GoogleIdConfig) => void
  prompt: () => void
  renderButton: (parent: HTMLElement, options: GoogleButtonConfig) => void
  cancel: () => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

/** Client ID público de Google (VITE_GOOGLE_CLIENT_ID). Sin él no se muestra nada de Google. */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || null

const SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleAccountsId> | null = null

/** Carga el script de Google una sola vez. Falla si un bloqueador o la red lo impiden. */
export function loadGoogleIdentity(timeoutMs = 8000): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    const timer = setTimeout(() => reject(new Error('Google no respondió')), timeoutMs)
    script.onload = () => {
      clearTimeout(timer)
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('Google no está disponible'))
    }
    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('No se pudo cargar Google'))
    }
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    loading = null
    throw err
  })
  return loading
}

/** SHA-256 en hexadecimal (lo que Google espera como nonce). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Nonce para un intento de inicio de sesión: a Google se le pasa `hashed` y a Supabase `raw`
 * (Supabase lo vuelve a hashear y lo compara con el que viene dentro del ID token).
 */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes))
  return { raw, hashed: await sha256Hex(raw) }
}
