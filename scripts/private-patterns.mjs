// Genera `.private-patterns` a partir de seed/initial-data.json (nombres, entidades, personas y saldos).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

if (!existsSync('seed/initial-data.json')) {
  console.log('No existe seed/initial-data.json: nada que generar.')
  process.exit(0)
}
const seed = JSON.parse(readFileSync('seed/initial-data.json', 'utf8'))
const money = (n) => (typeof n === 'number' && n >= 100 ? [n.toFixed(2), n.toLocaleString('en-US', { minimumFractionDigits: 2 })] : [])
const set = new Set([
  seed.profile?.nombre,
  ...seed.debts.flatMap((d) => [d.nombre, d.entidad, d.key, ...money(d.saldo_base), ...money(d.saldo_cancelacion)]),
  ...seed.debt_installments.flatMap((i) => [i.descripcion]),
  ...(seed.receivables_opcional ?? []).map((r) => r.persona.split(' ')[0]),
  ...seed.expenses.map((e) => e.descripcion),
])
const generic = new Set(['comida', 'luz', 'internet', 'superpacks', 'google play'])
const lines = [...set].filter((v) => typeof v === 'string' && v.length >= 4 && !generic.has(v.toLowerCase()))
writeFileSync('.private-patterns', `# Generado por npm run private:patterns — NO versionar\n${lines.join('\n')}\n`)
console.log(`✓ .private-patterns con ${lines.length} patrones`)
