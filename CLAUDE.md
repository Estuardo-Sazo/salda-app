# Saldá – instrucciones para Claude Code

Saldá es la web app "Control de Deudas" descrita en `docs/PLAN.md`.

- Lee docs/PLAN.md antes de cualquier cambio (es local, está en .gitignore). Trabaja por fases y no avances sin cumplir los criterios de aceptación.
- Stack: React 19 + Vite 8 + TS strict, Tailwind v4, shadcn/ui (radix-nova), TanStack Query, RHF + Zod, Recharts, React Router, Supabase.
- Lint con oxlint (`npm run lint`) y formato con Prettier (`npm run format`). Reemplazan a ESLint del plan original.
- Moneda GTQ (es-GT), fechas dd/mm/yyyy, zona America/Guatemala, UI en español.
- Dinero: nunca operar con floats sin control; usa centavos enteros o decimal.js en /src/lib/finance.
- /src/lib/finance es TypeScript puro (sin React ni Supabase) y todo cambio va con tests en Vitest.
- Datos personales fuera de git: docs/PLAN.md, seed/initial-data.json y *.private.test.ts. Tests versionados usan datos sintéticos o seed/initial-data.example.json; nunca copies montos, bancos ni nombres reales a archivos versionados.
- No inventes tasas, seguros ni saldos de cancelación: null en BD y etiqueta "PENDIENTE DE CONFIRMAR" en UI.
- Toda tabla nueva lleva user_id + RLS. Las vistas usan `security_invoker = true`. Cambios de BD solo vía migraciones en supabase/migrations.
- Supabase se usa solo en la nube: `npm run db:push` aplica migraciones y `npm run db:types` regenera `src/lib/supabase/database.types.ts`.
- Antes de terminar una tarea: npm run lint && npm test && npm run build.
- Commits pequeños con mensajes en español (feat:, fix:, chore:).
