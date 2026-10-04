import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { CURRENCIES, currencySymbol, isValidCurrency } from '@/lib/finance/currency'

const OTRA = '__otra'

/** Moneda del usuario: lista de las más comunes o un código ISO 4217 libre (“Otra”). */
export function CurrencySelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (code: string) => void
  invalid?: boolean
}) {
  const enLista = CURRENCIES.some((c) => c.code === value)
  const [otra, setOtra] = useState(!enLista)
  const [codigo, setCodigo] = useState(enLista ? '' : value)

  return (
    <div className="grid gap-2">
      <select
        id={id}
        value={otra ? OTRA : value}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          if (e.target.value === OTRA) {
            setOtra(true)
            onChange(codigo)
          } else {
            setOtra(false)
            onChange(e.target.value)
          }
        }}
        className="border-input bg-background aria-invalid:border-destructive h-11 rounded-lg border px-3 text-sm"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.nombre} ({c.code} · {currencySymbol(c.code)})
          </option>
        ))}
        <option value={OTRA}>Otra moneda…</option>
      </select>
      {otra && (
        <Input
          aria-label="Código ISO de la moneda"
          placeholder="Código de 3 letras, ej. CAD"
          maxLength={3}
          className="h-11 uppercase"
          value={codigo}
          aria-invalid={(codigo.length === 3 && !isValidCurrency(codigo)) || undefined}
          onChange={(e) => {
            const code = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
            setCodigo(code)
            onChange(code)
          }}
        />
      )}
    </div>
  )
}
