import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from '@/app/providers/theme'
import { Button } from '@/components/ui/button'
import { createNonce, GOOGLE_CLIENT_ID, loadGoogleIdentity, type GoogleCredentialResponse } from '@/lib/auth/google'
import { supabase } from '@/lib/supabase/client'

/** Logo "G" de Google para el botón de respaldo (colores oficiales). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

/**
 * Iniciar sesión con Google: One Tap (FedCM) + botón oficial. Ambos devuelven un ID token que
 * Supabase valida con el nonce. Si el script de Google no carga, queda un botón con redirección.
 */
export function GoogleSignIn() {
  const { resolvedTheme } = useTheme()
  const container = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'cargando' | 'listo' | 'respaldo'>('cargando')
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let activo = true
    let cancelar: (() => void) | undefined

    void (async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()])
        if (!activo || !container.current) return
        google.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          nonce: nonce.hashed,
          context: 'signin',
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_prompt: true,
          callback: async ({ credential }: GoogleCredentialResponse) => {
            setEntrando(true)
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: credential,
              nonce: nonce.raw,
            })
            setEntrando(false)
            // Con sesión, LoginPage redirige sola a la app.
            if (error) toast.error(`No se pudo entrar con Google: ${error.message}`)
          },
        })
        const width = Math.min(400, Math.max(200, Math.round(container.current.offsetWidth)))
        container.current.replaceChildren()
        google.renderButton(container.current, {
          type: 'standard',
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width,
          locale: 'es',
        })
        google.prompt()
        cancelar = () => google.cancel()
        setState('listo')
      } catch {
        if (activo) setState('respaldo')
      }
    })()

    return () => {
      activo = false
      cancelar?.()
    }
  }, [resolvedTheme])

  if (!GOOGLE_CLIENT_ID) return null

  const conRedireccion = async () => {
    setEntrando(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setEntrando(false)
      toast.error(`No se pudo entrar con Google: ${error.message}`)
    }
  }

  return (
    <div className="mb-4 grid gap-4">
      <div className="relative min-h-11">
        {state !== 'respaldo' && (
          // El botón de Google es un iframe: con la página en modo oscuro y el iframe en claro, el navegador
          // le pinta un fondo blanco. `color-scheme: light` en el contenedor lo deja transparente.
          <div ref={container} className="flex h-11 w-full justify-center [color-scheme:light]" />
        )}
        {state === 'cargando' && <div className="bg-muted absolute inset-0 animate-pulse rounded-full" aria-hidden />}
        {state === 'respaldo' && (
          <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={conRedireccion}>
            <GoogleG />
            Continuar con Google
          </Button>
        )}
        {entrando && (
          <div className="bg-background/80 absolute inset-0 grid place-items-center rounded-full" role="status">
            <Loader2 className="size-5 animate-spin" aria-label="Entrando con Google" />
          </div>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" aria-hidden />o con tu correo
        <span className="bg-border h-px flex-1" aria-hidden />
      </div>
    </div>
  )
}
