-- Saldá · Esquema base (sección 5 de docs/PLAN.md)
-- Dinero en numeric(12,2). Cada fila pertenece a un usuario (user_id = auth.uid()).

create type public.debt_type as enum ('tarjeta', 'prestamo');
create type public.payment_method as enum ('efectivo', 'debito', 'tarjeta', 'transferencia');
create type public.snapshot_origin as enum ('historial', 'registro', 'manual');
create type public.plan_strategy as enum ('avalancha', 'bola_nieve', 'cuotas_fijas');

-- Perfil / presupuesto base -------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text,
  ingreso_mensual numeric(12,2) check (ingreso_mensual is null or ingreso_mensual >= 0),
  moneda text not null default 'GTQ',
  created_at timestamptz not null default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  concepto text not null,
  monto numeric(12,2) not null check (monto >= 0),
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Deudas -----------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  entidad text,
  tipo public.debt_type not null,
  tasa_anual numeric(7,4) check (tasa_anual is null or tasa_anual >= 0),           -- null = PENDIENTE
  tasa_efectiva_anual numeric(7,4) check (tasa_efectiva_anual is null or tasa_efectiva_anual >= 0),
  cuota_mensual numeric(12,2) check (cuota_mensual is null or cuota_mensual >= 0),
  seguro_mensual numeric(12,2) check (seguro_mensual is null or seguro_mensual >= 0), -- null = PENDIENTE
  dia_corte int check (dia_corte between 1 and 31),
  dia_pago int check (dia_pago between 1 and 31),
  limite_credito numeric(12,2) check (limite_credito is null or limite_credito >= 0),
  saldo_base numeric(12,2) not null,
  fecha_base date not null,
  saldo_cancelacion numeric(12,2),                                                    -- null = PENDIENTE
  saldo_cancelacion_fecha date,
  cuotas_totales int check (cuotas_totales is null or cuotas_totales > 0),
  cuota_actual int check (cuota_actual is null or cuota_actual >= 0),
  fecha_vencimiento date,
  prioridad int,
  activa boolean not null default true,
  cerrada_en date,
  notas text,
  created_at timestamptz not null default now()
);
create index debts_user_idx on public.debts (user_id);

-- Cuotas que el banco aún no cobra (intracuotas / visacuotas / extrafinanciamientos)
create table public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id uuid not null references public.debts on delete cascade,
  descripcion text not null,
  monto_cuota numeric(12,2) not null check (monto_cuota >= 0),
  cuotas_totales int not null check (cuotas_totales > 0),
  cuotas_cobradas int not null default 0 check (cuotas_cobradas >= 0),
  capital_pendiente numeric(12,2) check (capital_pendiente is null or capital_pendiente >= 0),
  cargo_extra_por_cuota numeric(12,2) not null default 0 check (cargo_extra_por_cuota >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cobradas_no_excede check (cuotas_cobradas <= cuotas_totales)
);
create index debt_installments_debt_idx on public.debt_installments (debt_id);

-- Pagos ------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id uuid not null references public.debts on delete restrict,
  fecha date not null,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  pago_total numeric(12,2) not null check (pago_total >= 0),
  interes numeric(12,2) check (interes is null or interes >= 0),
  cargos numeric(12,2) check (cargos is null or cargos >= 0),
  capital numeric(12,2) generated always as (pago_total - coalesce(interes, 0) - coalesce(cargos, 0)) stored,
  saldo_despues numeric(12,2) not null,
  es_estimado boolean not null default false,
  fuente text,
  notas text,
  created_at timestamptz not null default now()
);
create index payments_debt_fecha_idx on public.payments (debt_id, fecha desc, created_at desc);
create index payments_user_periodo_idx on public.payments (user_id, periodo);

-- Gastos -----------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fecha date not null,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  descripcion text not null,
  categoria text not null,
  monto numeric(12,2) not null check (monto > 0),
  metodo public.payment_method not null,
  debt_id uuid references public.debts on delete restrict,
  created_at timestamptz not null default now(),
  constraint tarjeta_requiere_deuda check (metodo <> 'tarjeta' or debt_id is not null)
);
create index expenses_user_periodo_idx on public.expenses (user_id, periodo);

-- Saldos mensuales (historial + generado por pagos) ------------------------------
create table public.monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id uuid not null references public.debts on delete cascade,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  saldo numeric(12,2) not null,
  cuotas_fuera_saldo numeric(12,2) not null default 0,
  origen public.snapshot_origin not null,
  unique (debt_id, periodo)
);
create index monthly_snapshots_user_periodo_idx on public.monthly_snapshots (user_id, periodo);

-- Planes (meta) ----------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  estrategia public.plan_strategy not null,
  presupuesto_deudas numeric(12,2) not null check (presupuesto_deudas >= 0),
  abono_extra numeric(12,2) not null default 0 check (abono_extra >= 0),
  fecha_inicio date not null check (fecha_inicio = date_trunc('month', fecha_inicio)::date),
  activo boolean not null default false,
  supuestos jsonb,
  created_at timestamptz not null default now()
);
-- Solo un plan activo por usuario.
create unique index plans_un_activo_por_usuario on public.plans (user_id) where activo;

create table public.plan_rows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  periodo date not null,
  debt_id uuid references public.debts on delete cascade, -- null = fila de totales
  saldo numeric(12,2),
  pago numeric(12,2),
  interes_cargos numeric(12,2)
);
create index plan_rows_plan_periodo_idx on public.plan_rows (plan_id, periodo);

-- Dinero que me deben (opcional) -------------------------------------------------
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  persona text not null,
  monto numeric(12,2) not null check (monto >= 0),
  saldo numeric(12,2) not null check (saldo >= 0),
  notas text,
  created_at timestamptz not null default now()
);

-- Perfil automático al registrarse ---------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
