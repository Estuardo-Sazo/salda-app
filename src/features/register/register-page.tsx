import { ArrowDownCircle, Receipt } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/common'

const OPTIONS = [
  { to: '/registrar/pago', title: 'Registrar pago', text: 'Abono a una tarjeta o préstamo', icon: ArrowDownCircle },
  { to: '/registrar/gasto', title: 'Registrar gasto', text: 'Efectivo, débito o tarjeta', icon: Receipt },
]

export function RegisterPage() {
  return (
    <>
      <PageHeader title="Registrar" description="Elegí qué querés anotar." />
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ to, title, text, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-card hover:border-primary/40 hover:bg-accent flex items-center gap-4 rounded-2xl border p-5 transition"
          >
            <span className="bg-ink text-quetzal grid size-12 place-items-center rounded-xl">
              <Icon className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="text-muted-foreground block text-sm">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
