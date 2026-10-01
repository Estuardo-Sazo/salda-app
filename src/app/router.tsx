import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/app/require-auth'
import { ComingSoon } from '@/components/common'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/login-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { DebtsPage } from '@/features/debts/debts-page'
import { MorePage } from '@/features/more/more-page'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { RegisterPage } from '@/features/register/register-page'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'bienvenida', element: <OnboardingPage /> },
          { path: 'registrar', element: <RegisterPage /> },
          {
            path: 'registrar/pago',
            element: (
              <ComingSoon title="Registrar pago" fase={3}>
                Formulario rápido: deuda, monto, fecha, período y saldo después.
              </ComingSoon>
            ),
          },
          {
            path: 'registrar/gasto',
            element: (
              <ComingSoon title="Registrar gasto" fase={4}>
                Monto, descripción, categoría y método. Las compras con tarjeta se marcan como deuda nueva.
              </ComingSoon>
            ),
          },
          { path: 'deudas', element: <DebtsPage /> },
          { path: 'saldos', element: <ComingSoon title="Saldos mensuales" fase={5} /> },
          { path: 'plan', element: <ComingSoon title="Plan vs real" fase={5} /> },
          {
            path: 'simulador',
            element: (
              <ComingSoon title="Simulador" fase={6}>
                El motor ya calcula estrategias y consolidación; falta la pantalla.
              </ComingSoon>
            ),
          },
          { path: 'reportes', element: <ComingSoon title="Reportes" fase={7} /> },
          { path: 'mas', element: <MorePage /> },
          { path: 'mas/cobros', element: <ComingSoon title="Dinero que me deben" fase={7} /> },
          { path: 'mas/exportar', element: <ComingSoon title="Importar / exportar" fase={7} /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
