import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/app/require-auth'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/login-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { DataPage } from '@/features/data/data-page'
import { DebtDetailPage } from '@/features/debts/debt-detail-page'
import { DebtFormPage } from '@/features/debts/debt-form-page'
import { DebtsPage } from '@/features/debts/debts-page'
import { ExtraIncomePage } from '@/features/income/extra-income-page'
import { ExpenseFormPage } from '@/features/expenses/expense-form-page'
import { ExpensesPage } from '@/features/expenses/expenses-page'
import { MorePage } from '@/features/more/more-page'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { WizardPage } from '@/features/onboarding/wizard-page'
import { PaymentFormPage } from '@/features/payments/payment-form-page'
import { BalancesPage } from '@/features/plan/balances-page'
import { PlanPage } from '@/features/plan/plan-page'
import { ReceivablesPage } from '@/features/receivables/receivables-page'
import { RegisterPage } from '@/features/register/register-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { SimulatorPage } from '@/features/simulator/simulator-page'

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
          { path: 'mas/ingresos-extra', element: <ExtraIncomePage /> },
          { path: 'mas/cobros', element: <ReceivablesPage /> },
          { path: 'mas/exportar', element: <DataPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
