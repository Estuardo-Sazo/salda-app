import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { PublicFooter, PublicHeader } from '@/features/landing/public-layout'

/*
 * Términos y Política de privacidad. Se prerenderizan como HTML estático (scripts/prerender.mjs).
 * Describen solo lo que la app hace hoy: si cambia el manejo de datos, actualizar el texto y la fecha.
 */

export const LEGAL_UPDATED = '4 de octubre de 2026'
/** Correo para consultas y solicitudes sobre datos (variable VITE_CONTACT_EMAIL). */
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null

function Contacto() {
  return CONTACT ? (
    <a href={`mailto:${CONTACT}`} className="text-foreground underline underline-offset-2">
      {CONTACT}
    </a>
  ) : (
    <>el correo de contacto publicado en esta página</>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t pt-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground [&_strong]:text-foreground mt-3 grid gap-3 leading-relaxed [&_li]:pl-1 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6">
        <p className="text-muted-foreground text-sm">Última actualización: {LEGAL_UPDATED}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground mt-5 text-lg leading-relaxed">{intro}</p>
        <div className="mt-10 grid gap-8">{children}</div>
      </main>
      <PublicFooter />
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Términos de uso"
      intro="Estas condiciones explican qué es Saldá, qué podés esperar del servicio y qué esperamos de vos. Al crear una cuenta o usar la app las aceptás."
    >
      <Section title="1. Qué es Saldá">
        <p>
          Saldá es una aplicación web para llevar el control de tus deudas personales: registrar pagos, gastos y saldos,
          calcular intereses y proyectar un plan para terminar de pagar. La información la ingresás vos; Saldá no se
          conecta con bancos ni con ninguna otra institución financiera.
        </p>
      </Section>

      <Section title="2. No es asesoría financiera">
        <p>
          Los cálculos (intereses estimados, planes, simulaciones y fechas de liquidación) son{' '}
          <strong>estimaciones</strong> hechas con los datos que ingresás y con supuestos que la app muestra en cada
          caso. Pueden diferir de lo que cobra tu banco o tu prestamista. Saldá no es un asesor financiero, legal ni
          contable: antes de tomar una decisión importante, como consolidar deudas o cancelar un préstamo, confirmá las
          cifras con la entidad correspondiente.
        </p>
      </Section>

      <Section title="3. Tu cuenta">
        <ul>
          <li>
            Necesitás un correo válido para crear una cuenta y sos responsable de mantener el acceso a ese correo.
          </li>
          <li>Tu cuenta es personal. Cuidá tu contraseña y no la compartás.</li>
          <li>
            Si detectás un acceso que no reconocés, escribinos a <Contacto />.
          </li>
        </ul>
      </Section>

      <Section title="4. Tus datos son tuyos">
        <p>
          Lo que registrás en Saldá te pertenece. Nos das permiso únicamente para guardarlo y procesarlo con el fin de
          mostrarte la app y sus cálculos. Podés exportarlo en cualquier momento (Excel, CSV o un respaldo JSON
          completo) y borrarlo desde <strong>Más → Borrar todo y empezar de cero</strong>. El detalle está en la{' '}
          <a href="/privacidad" className="text-foreground underline underline-offset-2">
            Política de privacidad
          </a>
          .
        </p>
        <p>
          Si registrás información de otras personas, por ejemplo en “Dinero que me deben”, sos responsable de tener
          derecho a usarla y de limitarla a lo necesario.
        </p>
      </Section>

      <Section title="5. Uso aceptable">
        <p>No podés usar Saldá para:</p>
        <ul>
          <li>intentar acceder a cuentas o datos de otras personas;</li>
          <li>interferir con el servicio, sobrecargarlo o vulnerar su seguridad;</li>
          <li>actividades ilegales o para registrar información que no tenés derecho a tratar.</li>
        </ul>
        <p>Podemos suspender una cuenta que incumpla estas reglas.</p>
      </Section>

      <Section title="6. Disponibilidad">
        <p>
          Hacemos lo posible para que Saldá funcione de forma continua y segura, pero el servicio se ofrece “tal cual”:
          puede tener interrupciones, errores o cambios. Te recomendamos exportar un respaldo de vez en cuando.
        </p>
      </Section>

      <Section title="7. Responsabilidad">
        <p>
          En la medida que lo permita la ley aplicable, Saldá no es responsable por decisiones financieras tomadas con
          base en sus cálculos, por datos ingresados de forma incorrecta ni por pérdidas derivadas de interrupciones del
          servicio.
        </p>
      </Section>

      <Section title="8. Cambios y contacto">
        <p>
          Si cambiamos estos términos, actualizamos la fecha de arriba y, si el cambio es importante, te avisamos dentro
          de la app. Podés dejar de usar Saldá cuando quieras. Para cualquier consulta escribinos a <Contacto />.
        </p>
      </Section>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de privacidad"
      intro="Saldá guarda información sensible: tus deudas y tus pagos. Esta política explica qué datos guardamos, para qué, dónde y cómo podés exportarlos o borrarlos."
    >
      <Section title="1. Qué datos guardamos">
        <ul>
          <li>
            <strong>Tu cuenta:</strong> el correo con el que te registrás y, si usás contraseña, su versión cifrada
            (nunca la vemos).
          </li>
          <li>
            <strong>Lo que ingresás:</strong> deudas, pagos, saldos mensuales, gastos, ingreso y gastos fijos, ingresos
            extra, planes y el dinero que te deben (incluido el nombre que le pongás a cada persona).
          </li>
          <li>
            <strong>En tu navegador:</strong> la sesión iniciada y tu preferencia de tema (claro u oscuro), guardadas en
            el almacenamiento local del dispositivo.
          </li>
        </ul>
        <p>
          No pedimos ni guardamos credenciales bancarias, números de tarjeta ni documentos de identidad. No usamos
          herramientas de analítica, publicidad ni cookies de seguimiento.
        </p>
      </Section>

      <Section title="2. Para qué los usamos">
        <p>
          Solo para darte el servicio: mostrar tus datos, calcular intereses, planes y reportes, y enviarte los correos
          de inicio de sesión. No vendemos tus datos, no los compartimos con anunciantes y no los usamos para
          perfilarte.
        </p>
      </Section>

      <Section title="3. Dónde se guardan">
        <p>Saldá usa dos proveedores de infraestructura, que pueden tener servidores fuera de tu país:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> base de datos y autenticación (cuentas y correos de inicio de sesión).
          </li>
          <li>
            <strong>Vercel:</strong> aloja y entrega la aplicación web.
          </li>
        </ul>
        <p>
          Estos proveedores procesan la información solo para operar el servicio y pueden registrar datos técnicos, como
          la dirección IP de cada solicitud, según sus propias políticas.
        </p>
      </Section>

      <Section title="4. Cómo los protegemos">
        <ul>
          <li>Toda la comunicación viaja cifrada (HTTPS).</li>
          <li>
            Cada registro está ligado a tu cuenta y la base de datos impide que otro usuario lo lea o lo modifique.
          </li>
          <li>Las llaves de administración nunca se incluyen en la aplicación que se descarga en tu navegador.</li>
        </ul>
        <p>Ningún sistema es invulnerable; si detectamos un incidente que afecte tus datos, te lo vamos a informar.</p>
      </Section>

      <Section title="5. Tus derechos y controles">
        <ul>
          <li>
            <strong>Ver y corregir:</strong> todo lo que guardamos lo ves y editás dentro de la app.
          </li>
          <li>
            <strong>Exportar:</strong> en Más → Importar / exportar descargás un respaldo completo (JSON), Excel o CSV.
          </li>
          <li>
            <strong>Borrar:</strong> en Más → Borrar todo y empezar de cero se eliminan tus deudas, pagos, gastos,
            saldos y planes de forma definitiva.
          </li>
          <li>
            <strong>Eliminar la cuenta:</strong> para borrar también tu usuario y tu correo, escribinos a <Contacto />.
          </li>
        </ul>
      </Section>

      <Section title="6. Cuánto tiempo los guardamos">
        <p>
          Mientras tengás tu cuenta. Al borrar tus datos desde la app se eliminan de la base de datos; al eliminar la
          cuenta se borra también tu correo. Las copias de seguridad de los proveedores se renuevan según sus propios
          plazos.
        </p>
      </Section>

      <Section title="7. Menores de edad">
        <p>Saldá no está dirigido a menores de edad y no recopilamos a sabiendas datos de menores.</p>
      </Section>

      <Section title="8. Cambios y contacto">
        <p>
          Si cambiamos esta política, actualizamos la fecha de arriba y, si el cambio es importante, te avisamos dentro
          de la app. Para preguntas o solicitudes sobre tus datos escribinos a <Contacto />.
        </p>
      </Section>
    </LegalLayout>
  )
}
