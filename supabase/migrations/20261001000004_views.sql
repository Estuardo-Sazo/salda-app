-- Saldá · Vistas de estado y totales mensuales.
-- security_invoker = true hace que las vistas respeten el RLS del usuario que consulta.

create function public.current_period()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'America/Guatemala')::date;
$$;

-- Estado actual de cada deuda ---------------------------------------------------
create view public.v_debt_status with (security_invoker = true) as
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
  coalesce(lp.saldo_despues, d.saldo_base) + public.debt_fuera_saldo(d.id) as deuda_real,
  coalesce(agg.interes_cargos, 0)::numeric(12,2) as interes_acumulado,
  coalesce(agg.capital, 0)::numeric(12,2) as capital_acumulado,
  coalesce(agg.pagado, 0)::numeric(12,2) as pagado_acumulado,
  lp.fecha as ultimo_pago,
  case
    when not d.activa or d.cerrada_en is not null then 'cerrada'
    when coalesce(lp.saldo_despues, d.saldo_base) + public.debt_fuera_saldo(d.id) <= 0 then 'liquidada'
    else 'activa'
  end as estado
from public.debts d
left join lateral (
  select p.saldo_despues, p.fecha
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
) agg on true;

-- Meses con actividad de cada usuario (hasta el mes actual o el último registrado) --
create view public.v_user_periods with (security_invoker = true) as
with bounds as (
  select user_id, min(periodo) as desde, max(periodo) as hasta
  from (
    select user_id, periodo from public.monthly_snapshots
    union all select user_id, periodo from public.payments
    union all select user_id, periodo from public.expenses
  ) x
  group by user_id
)
select b.user_id, gs::date as periodo
from bounds b,
  generate_series(b.desde, greatest(b.hasta, public.current_period()), interval '1 month') gs;

-- Saldo por deuda y mes con carry-forward del último snapshot conocido -------------
create view public.v_monthly_balances with (security_invoker = true) as
select
  p.user_id,
  p.periodo,
  d.id as debt_id,
  d.nombre,
  s.saldo,
  s.cuotas_fuera_saldo,
  (s.saldo + s.cuotas_fuera_saldo)::numeric(12,2) as total_real,
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
) s on true;

-- Totales por mes -------------------------------------------------------------------
create view public.v_monthly_totals with (security_invoker = true) as
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
  (coalesce(pr.ingreso_mensual, 0) - coalesce(bi.gastos_fijos, 0) - coalesce(pa.pagos, 0))::numeric(12,2) as flujo_libre
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
) bi on true;

revoke all on public.v_debt_status, public.v_user_periods, public.v_monthly_balances, public.v_monthly_totals from anon;
grant select on public.v_debt_status, public.v_user_periods, public.v_monthly_balances, public.v_monthly_totals to authenticated;
