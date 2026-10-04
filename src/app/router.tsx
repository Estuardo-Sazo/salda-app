import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/app/require-auth'
import { RootRoute } from '@/app/root-route'
// El login va en el bundle inicial: es la primera pantalla sin sesión y evita una descarga en cadena.
import { LoginPage } from '@/features/auth/login-page'
import { lazy, Suspense, type ComponentType } from 'react'

/** Cada pantalla se descarga al visitarla: el primer render solo trae lo necesario. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}

const AppLayout = page(() => import('@/components/layout/app-layout'), 'AppLayout')
const DashboardPage = page(() => import('@/features/dashboard/dashboard-page'), 'DashboardPage')
const DataPage = page(() => import('@/features/data/data-page'), 'DataPage')
const DebtDetailPage = page(() => import('@/features/debts/debt-detail-page'), 'DebtDetailPage')
const DebtFormPage = page(() => import('@/features/debts/debt-form-page'), 'DebtFormPage')
const DebtsPage = page(() => import('@/features/debts/debts-page'), 'DebtsPage')
const ExtraIncomePage = page(() => import('@/features/income/extra-income-page'), 'ExtraIncomePage')
const ExpenseFormPage = page(() => import('@/features/expenses/expense-form-page'), 'ExpenseFormPage')
const ExpensesPage = page(() => import('@/features/expenses/expenses-page'), 'ExpensesPage')
const BudgetPage = page(() => import('@/features/more/budget-page'), 'BudgetPage')
const MorePage = page(() => import('@/features/more/more-page'), 'MorePage')
const OnboardingPage = page(() => import('@/features/onboarding/onboarding-page'), 'OnboardingPage')
const WizardPage = page(() => import('@/features/onboarding/wizard-page'), 'WizardPage')
const PaymentFormPage = page(() => import('@/features/payments/payment-form-page'), 'PaymentFormPage')
const BalancesPage = page(() => import('@/features/plan/balances-page'), 'BalancesPage')
const PlanPage = page(() => import('@/features/plan/plan-page'), 'PlanPage')
const ReceivablesPage = page(() => import('@/features/receivables/receivables-page'), 'ReceivablesPage')
const RegisterPage = page(() => import('@/features/register/register-page'), 'RegisterPage')
const ReportsPage = page(() => import('@/features/reports/reports-page'), 'ReportsPage')
const TermsPage = page(() => import('@/features/legal/legal-pages'), 'TermsPage')
const PrivacyPage = page(() => import('@/features/legal/legal-pages'), 'PrivacyPage')
const SimulatorPage = page(() => import('@/features/simulator/simulator-page'), 'SimulatorPage')

export const router = createBrowserRouter([
  { path: '/', element: <RootRoute /> },
  {
    path: '/terminos',
    element: (
      <Suspense fallback={null}>
        <TermsPage />
      </Suspense>
    ),
  },
  {
    path: '/privacidad',
    element: (
      <Suspense fallback={null}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: (
          <Suspense fallback={null}>
            <AppLayout />
          </Suspense>
        ),
        children: [
          { path: 'inicio', element: <DashboardPage /> },
          { path: 'bienvenida', element: <OnboardingPage /> },
          { path: 'bienvenida/cero', element: <WizardPage /> },
          { path: 'registrar', element: <RegisterPage /> },
          { path: 'registrar/pago', element: <PaymentFormPage /> },
          { path: 'registrar/gasto', element: <ExpenseFormPage /> },
          { path: 'gastos', element: <ExpensesPage /> },
          { path: 'gastos/:id/editar', element: <ExpenseFormPage /> },
          { path: 'deudas', element: <DebtsPage /> },
          { path: 'deudas/nueva', element: <DebtFormPage /> },
          { path: 'deudas/:id', element: <DebtDetailPage /> },
          { path: 'deudas/:id/editar', element: <DebtFormPage /> },
          { path: 'pagos/:id/editar', element: <PaymentFormPage /> },
          { path: 'saldos', element: <BalancesPage /> },
          { path: 'plan', element: <PlanPage /> },
          { path: 'simulador', element: <SimulatorPage /> },
          { path: 'reportes', element: <ReportsPage /> },
          { path: 'mas', element: <MorePage /> },
          { path: 'mas/presupuesto', element: <BudgetPage /> },
          { path: 'mas/ingresos-extra', element: <ExtraIncomePage /> },
          { path: 'mas/cobros', element: <ReceivablesPage /> },
          { path: 'mas/exportar', element: <DataPage /> },
          { path: '*', element: <Navigate to="/inicio" replace /> },
        ],
      },
    ],
  },
])
