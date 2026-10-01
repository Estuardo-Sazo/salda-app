import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/app/providers/auth'

/** Protege las rutas privadas: sin sesión redirige a /login y recuerda a dónde iba. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Cargando" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
