-- Saldá · Fase 5: guardar y activar planes de forma atómica, y saldos mensuales editados a mano.
-- Las funciones son security invoker: corren con el RLS del usuario autenticado.

-- 1. Guardar un plan nuevo (nunca borra los anteriores) -----------------------------
-- payload: { nombre, estrategia, presupuesto_deudas, abono_extra, fecha_inicio, activo, supuestos,
--            rows: [{ periodo, debt_id: uuid|null, saldo, pago, interes_cargos }] }
create function public.save_plan(payload jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan_id uuid;
  v_activo boolean := coalesce((payload ->> 'activo')::boolean, false);
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para guardar un plan.';
  end if;

  -- Las llaves foráneas no pasan por RLS: se valida que cada deuda sea del usuario.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(payload -> 'rows', '[]'::jsonb)) r
    where r ->> 'debt_id' is not null
      and not exists (
        select 1 from public.debts d where d.id = (r ->> 'debt_id')::uuid and d.user_id = v_user
      )
  ) then
    raise exception 'El plan incluye una deuda que no existe.';
  end if;

  if v_activo then
    update public.plans set activo = false where user_id = v_user and activo;
  end if;

  insert into public.plans (nombre, estrategia, presupuesto_deudas, abono_extra, fecha_inicio, activo, supuestos)
  values (
    payload ->> 'nombre',
    (payload ->> 'estrategia')::public.plan_strategy,
    (payload ->> 'presupuesto_deudas')::numeric,
    coalesce((payload ->> 'abono_extra')::numeric, 0),
    (payload ->> 'fecha_inicio')::date,
    v_activo,
    payload -> 'supuestos'
  )
  returning id into v_plan_id;

  insert into public.plan_rows (plan_id, periodo, debt_id, saldo, pago, interes_cargos)
  select
    v_plan_id,
    (r ->> 'periodo')::date,
    (r ->> 'debt_id')::uuid,
    (r ->> 'saldo')::numeric,
    (r ->> 'pago')::numeric,
    (r ->> 'interes_cargos')::numeric
  from jsonb_array_elements(coalesce(payload -> 'rows', '[]'::jsonb)) r;

  return v_plan_id;
end;
$$;

-- 2. Cambiar el plan activo (solo uno por usuario) ---------------------------------
create function public.activate_plan(p_plan_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if not exists (select 1 from public.plans where id = p_plan_id and user_id = v_user) then
    raise exception 'El plan no existe.';
  end if;
  update public.plans set activo = false where user_id = v_user and activo and id <> p_plan_id;
  update public.plans set activo = true where id = p_plan_id;
end;
$$;

revoke execute on function public.save_plan(jsonb) from public, anon;
revoke execute on function public.activate_plan(uuid) from public, anon;
grant execute on function public.save_plan(jsonb) to authenticated;
grant execute on function public.activate_plan(uuid) to authenticated;

-- 3. Un saldo manual también manda sobre el interés fijo calculado ---------------------
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
  -- Interés fijo: el saldo crece cada mes aunque no haya pagos (salvo el mes en que se paga
  -- o se corrige a mano).
  select public.flat_balance_at(d.id, p.periodo) as saldo
  where d.interes_modo = 'monto_original'
    and p.periodo >= date_trunc('month', d.fecha_base)::date
    and not (s.periodo = p.periodo and s.origen in ('registro', 'manual'))
) fb on true;
