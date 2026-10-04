import { zodResolver } from '@hookform/resolvers/zod'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '@/app/providers/auth'
import { LogoMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'

const emailSchema = z.object({ email: z.string().trim().email('Ingresá un correo válido') })
const passwordSchema = emailSchema.extend({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

function MagicLinkForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) toast.error(error.message)
    else setSentTo(email)
  })

  if (sentTo) {
    return (
      <div className="bg-success-soft flex flex-col items-center gap-2 rounded-2xl p-5 text-center">
        <CheckCircle2 className="text-success size-6" aria-hidden />
        <p className="font-medium">Revisá tu correo</p>
        <p className="text-muted-foreground text-sm">
          Enviamos un enlace a <span className="text-foreground font-medium">{sentTo}</span>. Abrilo desde este
          dispositivo para entrar.
        </p>
        <Button variant="link" onClick={() => setSentTo(null)}>
          Usar otro correo
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="magic-email">Correo</Label>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          className="h-11"
          aria-invalid={!!form.formState.errors.email}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
        )}
      </div>
      <Button type="submit" size="lg" className="h-11" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Mail />}
        Enviarme un enlace
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) })
  const errors = form.formState.errors

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error)
        toast.error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) toast.error(error.message)
    else if (!data.session) toast.success('Cuenta creada. Confirmá tu correo para entrar.')
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="pw-email">Correo</Label>
        <Input
          id="pw-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="h-11"
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-password">Contraseña</Label>
        <Input
          id="pw-password"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          className="h-11"
          aria-invalid={!!errors.password}
          {...form.register('password')}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      <Button type="submit" size="lg" className="h-11" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
      </Button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? '¿No tenés cuenta? Creala' : '¿Ya tenés cuenta? Entrá'}
      </button>
    </form>
  )
}

export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  useDocumentTitle('Entrar')
  const from = (location.state as { from?: string } | null)?.from ?? '/inicio'
  if (!loading && session) return <Navigate to={from} replace />

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="bg-ink text-ink-foreground relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <span className="text-xl font-semibold tracking-tight">Saldá</span>
        </div>
        <div className="max-w-md">
          <p className="text-4xl leading-tight font-semibold tracking-tight">
            Cada pago te acerca al <span className="text-gold">punto final</span>.
          </p>
          <p className="text-ink-foreground/70 mt-4">
            Registrá pagos y gastos en segundos, mirá cuánto se va en intereses y seguí tu plan para quedar libre de
            deudas.
          </p>
        </div>
        <p className="text-ink-foreground/50 text-sm">Quetzales · America/Guatemala</p>
        <svg
          aria-hidden
          viewBox="0 0 400 200"
          className="pointer-events-none absolute right-0 bottom-24 w-[70%] opacity-25"
          fill="none"
        >
          <path d="M0 20 C120 30 160 110 260 140 S380 180 400 180" className="stroke-quetzal" strokeWidth="3" />
          <circle cx="396" cy="180" r="7" className="fill-gold" />
        </svg>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <LogoMark className="size-12 lg:hidden" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Entrá a Saldá</h1>
              <p className="text-muted-foreground mt-1 text-sm">Tus datos solo los ves vos.</p>
            </div>
          </div>
          <Tabs defaultValue="magic">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="magic">Enlace mágico</TabsTrigger>
              <TabsTrigger value="password">Contraseña</TabsTrigger>
            </TabsList>
            <TabsContent value="magic">
              <MagicLinkForm />
            </TabsContent>
            <TabsContent value="password">
              <PasswordForm />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}
