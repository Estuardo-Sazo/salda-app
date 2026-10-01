import { LogoMark } from '@/components/brand/logo'

/** Se muestra mientras falten VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local. */
export function SetupScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="bg-card w-full max-w-lg rounded-3xl border p-6 sm:p-8">
        <LogoMark className="size-12" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Falta conectar Supabase</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Creá el archivo <code className="bg-muted rounded px-1.5 py-0.5">.env.local</code> en la raíz del proyecto con
          los datos de tu proyecto (Project Settings → API) y reiniciá <code>npm run dev</code>.
        </p>
        <pre className="bg-ink text-ink-foreground mt-5 overflow-x-auto rounded-xl p-4 text-xs leading-relaxed">
          {`VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="text-muted-foreground mt-4 text-xs">
          Usá solo la llave <strong>anon / publishable</strong>. La llave service_role nunca va en el frontend.
        </p>
      </div>
    </div>
  )
}
