// Bloquea commits que incluyan datos personales. Los patrones viven en `.private-patterns`
// (ignorado por git; se genera con `npm run private:patterns` a partir del seed real).
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const PATTERNS_FILE = '.private-patterns'
if (!existsSync(PATTERNS_FILE)) process.exit(0)

const patterns = readFileSync(PATTERNS_FILE, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
if (patterns.length === 0) process.exit(0)

const all = process.argv.includes('--all')
const files = execSync(all ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && f !== 'package-lock.json' && existsSync(f))

const hits = []
for (const file of files) {
  const text = all ? readFileSync(file, 'utf8') : execSync(`git show ":${file}"`, { encoding: 'utf8' })
  const lower = text.toLowerCase()
  for (const p of patterns) if (lower.includes(p.toLowerCase())) hits.push(`${file}: "${p}"`)
}

if (hits.length) {
  console.error('✗ Datos personales detectados en archivos versionados:\n  ' + hits.join('\n  '))
  console.error('Movelos a un archivo ignorado (*.private.test.ts, seed/initial-data.json) o usá datos ficticios.')
  process.exit(1)
}
console.log(`✓ Sin datos personales (${files.length} archivos revisados)`)
