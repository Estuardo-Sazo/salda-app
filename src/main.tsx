import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/app/providers/auth'
import { ThemeProvider } from '@/app/providers/theme'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import { SetupScreen } from '@/features/auth/setup-screen'
import { listenForInstallPrompt } from '@/lib/pwa/install'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import './index.css'

listenForInstallPrompt()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {isSupabaseConfigured ? <RouterProvider router={router} /> : <SetupScreen />}
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
