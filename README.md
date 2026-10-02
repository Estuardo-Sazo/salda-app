# Saldá

Web app personal y mobile-first para controlar deudas en quetzales: registrar pagos y gastos, ver la evolución de
saldos, comparar contra un plan (avalancha) y simular escenarios. El plan de producto vive en `docs/PLAN.md`, que es un
archivo local y no se versiona (ver [Datos privados](#datos-privados)).

> **Saldá** viene de *saldar* (en voseo: "¡saldá!"). El icono es una **S** que termina en un punto: saldado, punto final.

## Stack

React 19 · Vite 8 · TypeScript strict · Tailwind v4 · shadcn/ui · TanStack Query · React Hook Form + Zod · Recharts ·
React Router · Supabase (Postgres + Auth + RLS) · Vitest · PWA (vite-plugin-pwa).

## Requisitos

- Node.js 20 o superior (probado con 22) y npm.
- Una cuenta gratuita en [supabase.com](https://supabase.com). El CLI de Supabase ya viene como dependencia del proyecto
  (`npx supabase …`), no hace falta instalarlo aparte.

## Instalación

```bash
npm install
cp .env.example .env.local   # y completá los valores
npm run dev                  # http://localhost:5173
```

### Variables de entorno (`.env.local`)

| Variable | Dónde se obtiene |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / publishable key |

Nunca pongas la llave `service_role` en el frontend ni en el repositorio.

## Base de datos (Supabase en la nube, desde la consola)

```bash
npm run db:login                          # abre el navegador para autorizar el CLI (una sola vez)
npm run db:link -- --project-ref <ref>    # el ref está en la URL del proyecto; pide la contraseña de la BD
npm run db:push                           # aplica supabase/migrations/*.sql
npx supabase config push                  # sube la config de auth (URLs de redirección del magic link)
npm run db:types                          # regenera src/lib/supabase/database.types.ts
```

Migraciones incluidas:

| Archivo | Contenido |
|---|---|
| `…01_schema.sql` | Enums, tablas de la sección 5, índices y perfil automático al registrarse |
| `…02_rls.sql` | RLS en todas las tablas (`user_id = auth.uid()`); `anon` sin acceso |
| `…03_snapshots_trigger.sql` | Un pago hace upsert del saldo mensual de su deuda; borrar el último pago lo limpia |
| `…04_views.sql` | `v_debt_status`, `v_monthly_balances` (carry-forward), `v_monthly_totals` |
| `…05_import_reset.sql` | RPC `import_initial_data(payload)` (todo en una transacción) y `reset_my_data()` |

Para un cambio nuevo de BD: `npx supabase migration new <nombre>`, escribí el SQL y corré `npm run db:push`.

## Cargar mis datos (seed)

1. Entrá a la app (magic link o correo + contraseña).
2. La primera vez se abre **Bienvenida** → **Cargar mis datos**. Importa el seed para tu usuario y genera el plan
   inicial como plan activo.
   - Si existe `seed/initial-data.json` (local), se usa ese.
   - Si no existe (clon nuevo o deploy), se usa `seed/initial-data.example.json` con datos ficticios.
   - En cualquier caso podés tocar **Subir mi archivo .json** y elegir tu `initial-data.json` desde el celular.
3. Para repetir: **Más → Borrar todo y empezar de cero** (doble confirmación).

## Datos privados

Estos archivos están en `.gitignore` y **nunca** deben subirse al repositorio:

| Archivo | Contenido |
|---|---|
| `docs/PLAN.md` | Plan de producto con datos financieros reales |
| `seed/initial-data.json` | Seed real (mismo formato que `initial-data.example.json`) |
| `*.private.test.ts` | Tests de aceptación con los valores reales de la sección 6.3 del plan |

Un hook de pre-commit (`.githooks/pre-commit`, se activa con `npm install`) bloquea cualquier commit que incluya
los patrones de `.private-patterns`. Generalo con `npm run private:patterns` después de clonar.

Guardalos en un lugar seguro fuera del repo (por ejemplo, un gestor de contraseñas o una nube privada). Sin ellos la
app compila y los tests del repo pasan con datos sintéticos.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` / `npm run test:coverage` | Vitest (motor financiero con cobertura ≥ 90 %) |
| `npm run lint` | oxlint |
| `npm run format` | Prettier |
| `npm run build` | Typecheck + build de producción con service worker |
| `npm run icons` | Regenera los PNG de la PWA desde `public/icons/*.svg` |
| `npm run private:patterns` | Genera `.private-patterns` (local) con nombres y montos del seed real |
| `npm run private:check` | Revisa que ningún archivo versionado tenga datos personales |

## Deploy

- **Frontend:** Vercel o Netlify. Build `npm run build`, carpeta `dist`, y las dos variables `VITE_…` en el panel.
  Configurá el fallback de SPA (todas las rutas → `index.html`).
- **Auth:** agregá la URL de producción en `supabase/config.toml` (`site_url` y `additional_redirect_urls`) y corré
  `npx supabase config push`.

## Estructura

```
src/
  app/            providers (tema, auth), router y guardia de rutas
  components/     UI compartida (shadcn en components/ui, layout, marca)
  features/       dashboard, debts, onboarding, more, register, auth
  lib/finance/    motor financiero PURO + tests (sección 6)
  lib/seed/       conversión del seed → payload de importación y → entrada del motor
  lib/supabase/   cliente y tipos
  lib/format/     GTQ, fechas dd/mm/yyyy, zona America/Guatemala
supabase/         config.toml y migrations/
seed/             initial-data.json (sección 9)
```
