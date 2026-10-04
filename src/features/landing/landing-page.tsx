import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { FAQ, FEATURES, PASOS } from './content'

/*
 * Página pública. Se prerenderiza a HTML estático en el build (scripts/prerender.mjs), así que no usa
 * el router ni nada del navegador al renderizar: los enlaces son <a> normales.
 */

const LOGIN = '/login'
const YEAR = new Date().getFullYear()

function CtaPrimary({ children = 'Empezar con Saldá' }: { children?: string }) {
  return (
    <a
      href={LOGIN}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-medium transition focus-visible:ring-3 focus-visible:outline-none"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  )
}

/** Fragmento de la app con datos de ejemplo (no son datos de ningún usuario). */
function ProductSample() {
  const pagos = [
    { nombre: 'Tarjeta Oro', fecha: '17/10/2026', monto: 'Q500.00', pagado: true },
    { nombre: 'Préstamo moto', fecha: '25/10/2026', monto: 'Q1,180.00', pagado: false },
    { nombre: 'Visa Clásica', fecha: '28/10/2026', monto: 'Q350.00', pagado: false },
  ]
  return (
    <figure aria-label="Ejemplo del inicio de Saldá con datos ficticios" className="grid gap-3">
      <div className="bg-ink text-ink-foreground rounded-3xl p-6">
        <p className="text-ink-foreground/70 text-sm">Deuda total real · oct 2026</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight">Q48,215.60</p>
        <p className="text-ink-foreground/70 mt-1 text-sm">
          Bajó <span className="text-quetzal tabular font-medium">Q1,312.40</span> este mes
        </p>
        <svg viewBox="0 0 320 96" className="mt-5 h-24 w-full" aria-hidden>
          <path
            d="M0 14 L40 22 L80 30 L120 41 L160 50 L200 61 L240 72 L280 82 L320 90"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <path
            d="M0 10 L40 19 L80 24 L120 38 L160 44 L200 52"
            fill="none"
            className="stroke-quetzal"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="200" cy="52" r="5" className="fill-gold" />
        </svg>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="bg-gold text-ink rounded-full px-3 py-1 font-medium">Libre de deudas · mar 2028</span>
          <span className="bg-quetzal/15 text-quetzal rounded-full px-3 py-1 font-medium">Q640.15 adelantado</span>
        </div>
      </div>
      <div className="bg-card rounded-2xl border p-4">
        <p className="mb-2 text-sm font-medium">Pagos de octubre</p>
        <ul className="divide-y text-sm">
          {pagos.map((p) => (
            <li key={p.nombre} className="flex items-center gap-3 py-2">
              {p.pagado ? (
                <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
              ) : (
                <Circle className="text-muted-foreground/60 size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.nombre}</span>
                <span className="text-muted-foreground text-xs">
                  {p.fecha} · {p.pagado ? 'Pagado' : 'Pendiente'}
                </span>
              </span>
              <span className={p.pagado ? 'text-muted-foreground tabular line-through' : 'tabular'}>{p.monto}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-muted-foreground text-xs">Datos de ejemplo.</figcaption>
    </figure>
  )
}

export function LandingPage() {
  useDocumentTitle('Controlá tus deudas en quetzales')

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2" aria-label="Saldá, inicio">
          <LogoMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Saldá</span>
        </a>
        <nav aria-label="Secciones" className="flex items-center gap-6 text-sm">
          <a href="#funciones" className="text-muted-foreground hover:text-foreground hidden sm:inline">
            Funciones
          </a>
          <a href="#como-funciona" className="text-muted-foreground hover:text-foreground hidden sm:inline">
            Cómo funciona
          </a>
          <a href="#preguntas" className="text-muted-foreground hover:text-foreground hidden sm:inline">
            Preguntas
          </a>
          <a href={LOGIN} className="hover:bg-accent rounded-lg border px-3 py-1.5 font-medium transition">
            Iniciar sesión
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <div>
            <p className="text-muted-foreground text-sm font-medium tracking-wide">Control de deudas · Guatemala</p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Saldá tus deudas, mes a mes, hasta llegar a{' '}
              <span className="decoration-gold underline decoration-double decoration-4 underline-offset-[0.18em]">
                Q0
              </span>
              .
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
              Registrá cada pago de tus tarjetas y préstamos, mirá cuánto se va en intereses y seguí un plan con la
              fecha exacta en que terminás de pagar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <CtaPrimary />
              <a href={LOGIN} className="text-sm font-medium underline-offset-4 hover:underline">
                Ya tengo cuenta · Iniciar sesión
              </a>
            </div>
            <p className="text-muted-foreground mt-6 text-sm">Sin conectar tu banco. Tus datos solo los ves vos.</p>
          </div>
          <ProductSample />
        </section>

        <section id="funciones" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Todo lo que hace tu hoja de control, sin la hoja.
              </h2>
              <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">
                Saldá nació de un Excel real de deudas: tarjetas con intracuotas, préstamos con interés fijo, aguinaldo
                para el pago grande de diciembre. Por eso calcula lo que una app genérica no ve.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.titulo} className="border-t py-6">
                  <dt className="font-semibold">{f.titulo}</dt>
                  <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{f.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="como-funciona" className="bg-ink text-ink-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cómo funciona</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="border-ink-foreground/20 border-t pt-5">
                  <span className="text-gold tabular text-sm font-medium">Paso {i + 1}</span>
                  <h3 className="mt-2 text-xl font-semibold">{p.titulo}</h3>
                  <p className="text-ink-foreground/75 mt-2 leading-relaxed">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Hecho para cómo se paga en Guatemala
              </h2>
            </div>
            <ul className="grid gap-4 text-[15px] leading-relaxed">
              <li className="border-t pt-4">
                <span className="font-semibold">Quetzales y fechas como las escribís:</span>{' '}
                <span className="text-muted-foreground">Q1,234.56 y 30/09/2026, en español de Guatemala.</span>
              </li>
              <li className="border-t pt-4">
                <span className="font-semibold">Aguinaldo y Bono 14:</span>{' '}
                <span className="text-muted-foreground">
                  los registrás una vez y Saldá te dice si alcanzan para un pago grande o cuánto apartar cada mes.
                </span>
              </li>
              <li className="border-t pt-4">
                <span className="font-semibold">Intracuotas y visacuotas:</span>{' '}
                <span className="text-muted-foreground">
                  con un botón marcás la cuota que el banco ya cobró y la deuda real se ajusta.
                </span>
              </li>
              <li className="border-t pt-4">
                <span className="font-semibold">Nada inventado:</span>{' '}
                <span className="text-muted-foreground">
                  si el banco no te dio la tasa o el saldo de cancelación, queda como pendiente de confirmar.
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section id="preguntas" className="border-t">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y border-y">
              {FAQ.map((q) => (
                <details key={q.pregunta} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q.pregunta}
                    <span aria-hidden className="text-muted-foreground transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 leading-relaxed">{q.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Tu deuda tiene fecha de fin. Empezá a contarla hoy.
            </p>
            <CtaPrimary>Crear mi cuenta</CtaPrimary>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark className="size-5" />© {YEAR} Saldá · Hecho en Guatemala
          </span>
          <a href={LOGIN} className="hover:text-foreground">
            Iniciar sesión
          </a>
        </div>
      </footer>
    </div>
  )
}
