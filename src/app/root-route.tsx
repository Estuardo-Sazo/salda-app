import { Navigate } from 'react-router'
import { useAuth } from '@/app/providers/auth'
import { LandingPage } from '@/features/landing/landing-page'

/**
 * `/`: la página pública para quien no tiene sesión; con sesión, el dashboard en /inicio.
 * Mientras se lee la sesión se muestra la página pública (es la misma que viene prerenderizada).
 */
export function RootRoute() {
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/inicio" replace />
  return <LandingPage />
}
