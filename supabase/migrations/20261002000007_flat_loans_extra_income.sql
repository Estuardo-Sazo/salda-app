-- Saldá · Préstamos con interés fijo sobre el monto original y pago único al vencimiento,
-- e ingresos extra por mes (aguinaldo, Bono 14).

-- 1. Nuevas condiciones de deuda --------------------------------------------------
alter table public.debts
  add column interes_modo text not null default 'saldo'
    check (interes_modo in ('saldo', 'monto_original')),
  add column monto_original numeric(12,2) check (monto_original is null or monto_original > 0),
  add column pago_unico boolean not null default false,
  add constraint interes_fijo_requiere_monto
    check (interes_modo <> 'monto_original' or (monto_original is not null and tasa_anual is not null)),
  add constraint pago_unico_requiere_vencimiento
    check (not pago_unico or fecha_vencimiento is not null);

comment on column public.debts.interes_modo is
  'saldo = interés sobre el saldo (normal); monto_original = cargo fijo mensual de monto_original × tasa_anual / 12 mientras haya saldo.';
comment on column public.debts.pago_unico is
  'Todo el saldo se paga en el mes de fecha_vencimiento (sin cuotas mensuales).';

-- 2. Saldo de un préstamo de interés fijo al inicio de un período --------------------
-- El saldo base incluye el interés hasta el mes anterior a fecha_base; un pago deja el
-- saldo al cierre de su período. Cada mes completo posterior suma un cargo fijo,
-- hasta el mes de vencimiento. Un saldo en cero ya no genera interés.
create function public.flat_balance_at(p_debt_id uuid, p_periodo date)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  d public.debts%rowtype;
  v_ref numeric(12,2);
  v_desde date;
  v_hasta date;
  v_meses int;
begin
  select * into d from public.debts where id = p_debt_id;
  if not found or d.interes_modo <> 'monto_original' then
    return null;
  end if;

  select p.saldo_despues, (p.periodo + interval '1 month')::date
    into v_ref, v_desde
  from public.payments p
  where p.debt_id = p_debt_id and p.periodo < p_periodo
  order by p.periodo desc, p.fecha desc, p.created_at desc
  limit 1;

  if not found then
    v_ref := d.saldo_base;
    v_desde := date_trunc('month', d.fecha_base)::date;
  end if;

  if v_ref <= 0 then
    return v_ref;
  end if;

  v_hasta := (p_periodo - interval '1 month')::date;
  if d.fecha_vencimiento is not null then
    v_hasta := least(v_hasta, date_trunc('month', d.fecha_vencimiento)::date);
  end if;

  v_meses := greatest(
    0,
    (extract(year from v_hasta) * 12 + extract(month from v_hasta))::int
      - (extract(year from v_desde) * 12 + extract(month from v_desde))::int + 1
  );
  return (v_ref + round(d.monto_original * d.tasa_anual / 12, 2) * v_meses)::numeric(12,2);
end;
$$;

revoke execute on function public.flat_balance_at(uuid, date) from public, anon;
grant execute on function public.flat_balance_at(uuid, date) to authenticated;

-- 3. Ingresos extra ------------------------------------------------------------------
create table public.extra_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  created_at timestamptz not null default now()
);
create index extra_incomes_user_periodo_idx on public.extra_incomes (user_id, periodo);

alter table public.extra_incomes enable row level security;
create policy "own rows" on public.extra_incomes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.extra_incomes from anon;
grant select, insert, update, delete on public.extra_incomes to authenticated;

-- 4. Vistas: el interés fijo se devenga mes a mes y los ingresos extra entran al flujo --
create or replace view public.v_debt_status with (security_invoker = true) as
select
  d.id as debt_id,
  d.user_id,
  d.nombre,
  d.entidad,
  d.tipo,
  d.tasa_anual,
  d.cuota_mensual,
  d.seguro_mensual,
  d.dia_corte,
  d.dia_pago,
  d.limite_credito,
  d.saldo_base,
  d.fecha_base,
  d.saldo_cancelacion,
  d.saldo_cancelacion_fecha,
  d.prioridad,
  d.notas,
  d.activa,
  d.cerrada_en,
  coalesce(lp.saldo_despues, d.saldo_base) as saldo_actual,
  public.debt_fuera_saldo(d.id) as cuotas_fuera_saldo,
  coalesce(lp.saldo_despues, d.saldo_base) + public.debt_fuera_saldo(d.id) + coalesce(fl.devengado, 0) as deuda_real,
  coalesce(agg.interes_cargos, 0)::numeric(12,2) as interes_acumulado,
  coalesce(agg.capital, 0)::numeric(12,2) as capital_acumulado,
  coalesce(agg.pagado, 0)::numeric(12,2) as pagado_acumulado,
  lp.fecha as ultimo_pago,
  case
    when not d.activa or d.cerrada_en is not null then 'cerrada'
    when coalesce(lp.saldo_despues, d.saldo_base) + public.debt_fuera_saldo(d.id) <= 0 then 'liquidada'
    else 'activa'
  end as estado,
  d.interes_modo,
  d.monto_original,
  d.pago_unico,
  d.fecha_vencimiento,
  coalesce(fl.devengado, 0)::numeric(12,2) as interes_devengado,
  fl.para_cancelar as saldo_para_cancelar
from public.debts d
left join lateral (
  select p.saldo_despues, p.fecha, p.periodo
  from public.payments p
  where p.debt_id = d.id
  order by p.fecha desc, p.created_at desc
  limit 1
) lp on true
left join lateral (
  select
    sum(coalesce(p.interes, 0) + coalesce(p.cargos, 0)) as interes_cargos,
    sum(p.capital) as capital,
    sum(p.pago_total) as pagado
  from public.payments p
  where p.debt_id = d.id
) agg on true
left join lateral (
  -- Interés fijo ya devengado (meses completos) y monto para cancelar este mes.
  -- Si ya hay un pago en este período (o posterior), su saldo_despues es el saldo vigente.
  select
    case when lp.periodo >= public.current_period() then 0
         else public.flat_balance_at(d.id, public.current_period()) - coalesce(lp.saldo_despues, d.saldo_base)
    end as devengado,
    case when lp.periodo >= public.current_period() then lp.saldo_despues
         else public.flat_balance_at(d.id, (public.current_period() + interval '1 month')::date)
    end as para_cancelar
  where d.interes_modo = 'monto_original'
) fl on true;

create or replace view public.v_monthly_balances with (security_invoker = true) as
select
  p.user_id,
  p.periodo,
  d.id as debt_id,
  d.nombre,
  coalesce(fb.saldo, s.saldo)::numeric(12,2) as saldo,
  s.cuotas_fuera_saldo,
  (coalesce(fb.saldo, s.saldo) + s.cuotas_fuera_saldo)::numeric(12,2) as total_real,
  s.origen,
  (s.periodo = p.periodo) as es_registrado
from public.v_user_periods p
join public.debts d
  on d.user_id = p.user_id
 and (d.cerrada_en is null or p.periodo <= d.cerrada_en)
join lateral (
  select ms.periodo, ms.saldo, ms.cuotas_fuera_saldo, ms.origen
  from public.monthly_snapshots ms
  where ms.debt_id = d.id and ms.periodo <= p.periodo
  order by ms.periodo desc
  limit 1
) s on true
left join lateral (
  -- Interés fijo: el saldo crece cada mes aunque no haya pagos (salvo el mes en que se paga).
  select public.flat_balance_at(d.id, p.periodo) as saldo
  where d.interes_modo = 'monto_original'
    and p.periodo >= date_trunc('month', d.fecha_base)::date
    and not (s.periodo = p.periodo and s.origen = 'registro')
) fb on true;

create or replace view public.v_monthly_totals with (security_invoker = true) as
select
  p.user_id,
  p.periodo,
  coalesce(b.saldo_total, 0)::numeric(12,2) as saldo_total,
  coalesce(b.fuera_total, 0)::numeric(12,2) as cuotas_fuera_saldo,
  coalesce(b.total_real, 0)::numeric(12,2) as total_real,
  coalesce(pa.pagos, 0)::numeric(12,2) as pagos,
  coalesce(pa.interes_cargos, 0)::numeric(12,2) as interes_cargos,
  coalesce(pa.capital, 0)::numeric(12,2) as capital,
  coalesce(e.compras_tarjeta, 0)::numeric(12,2) as compras_tarjeta,
  coalesce(e.gastos_total, 0)::numeric(12,2) as gastos_total,
  pr.ingreso_mensual,
  coalesce(bi.gastos_fijos, 0)::numeric(12,2) as gastos_fijos,
  (coalesce(pr.ingreso_mensual, 0) + coalesce(x.extra, 0) - coalesce(bi.gastos_fijos, 0) - coalesce(pa.pagos, 0))::numeric(12,2)
    as flujo_libre,
  coalesce(x.extra, 0)::numeric(12,2) as ingresos_extra
from public.v_user_periods p
left join lateral (
  select sum(vb.saldo) as saldo_total, sum(vb.cuotas_fuera_saldo) as fuera_total, sum(vb.total_real) as total_real
  from public.v_monthly_balances vb
  where vb.user_id = p.user_id and vb.periodo = p.periodo
) b on true
left join lateral (
  select
    sum(pa.pago_total) as pagos,
    sum(coalesce(pa.interes, 0) + coalesce(pa.cargos, 0)) as interes_cargos,
    sum(pa.capital) as capital
  from public.payments pa
  where pa.user_id = p.user_id and pa.periodo = p.periodo
) pa on true
left join lateral (
  select
    sum(ex.monto) filter (where ex.metodo = 'tarjeta') as compras_tarjeta,
    sum(ex.monto) as gastos_total
  from public.expenses ex
  where ex.user_id = p.user_id and ex.periodo = p.periodo
) e on true
left join public.profiles pr on pr.id = p.user_id
left join lateral (
  select sum(bi.monto) as gastos_fijos
  from public.budget_items bi
  where bi.user_id = p.user_id and bi.activo
) bi on true
left join lateral (
  select sum(xi.monto) as extra
  from public.extra_incomes xi
  where xi.user_id = p.user_id and xi.periodo = p.periodo
) x on true;

-- 5. Borrar todo también limpia los ingresos extra -------------------------------------
create or replace function public.reset_my_data()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  delete from public.plan_rows where user_id = v_user;
  delete from public.plans where user_id = v_user;
  delete from public.payments where user_id = v_user;
  delete from public.expenses where user_id = v_user;
  delete from public.monthly_snapshots where user_id = v_user;
  delete from public.debt_installments where user_id = v_user;
  delete from public.debts where user_id = v_user;
  delete from public.budget_items where user_id = v_user;
  delete from public.receivables where user_id = v_user;
  delete from public.extra_incomes where user_id = v_user;
  update public.profiles set nombre = null, ingreso_mensual = null where id = v_user;
end;
$$;
