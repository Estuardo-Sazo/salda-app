-- Saldá · Fase 7: la importación acepta un respaldo completo (exportar → importar da los mismos totales).
-- Compatible con el payload anterior (seed y Excel). Novedades:
--   debts: interes_modo, monto_original, pago_unico · budget_items: activo · debt_installments: activa
--   snapshots con origen 'registro' o 'manual' se reaplican después de los pagos (el trigger no los pisa)
--   extra_incomes: [{ periodo, concepto, monto }]
--   plans: [{ ...plan, rows }] además del `plan` único de antes

create or replace function public.import_initial_data(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_keys jsonb := '{}'::jsonb;
  v_item jsonb;
  v_plan jsonb;
  v_plans jsonb;
  v_id uuid;
  v_plan_id uuid;
  v_activo_id uuid;
  v_ord int := 0;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_rows int := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para importar datos.';
  end if;
  if exists (select 1 from public.debts where user_id = v_user) then
    raise exception 'Ya tienes datos cargados. Usa "Borrar todo y empezar de cero" antes de volver a importar.';
  end if;

  -- Perfil
  if payload ? 'profile' then
    insert into public.profiles (id, nombre, ingreso_mensual, moneda)
    values (
      v_user,
      payload -> 'profile' ->> 'nombre',
      (payload -> 'profile' ->> 'ingreso_mensual')::numeric,
      coalesce(payload -> 'profile' ->> 'moneda', 'GTQ')
    )
    on conflict (id) do update
      set nombre = excluded.nombre,
          ingreso_mensual = excluded.ingreso_mensual,
          moneda = excluded.moneda;
  end if;

  -- Gastos fijos
  insert into public.budget_items (concepto, monto, activo, orden)
  select
    b ->> 'concepto',
    (b ->> 'monto')::numeric,
    coalesce((b ->> 'activo')::boolean, true),
    coalesce((b ->> 'orden')::int, (ord - 1)::int)
  from jsonb_array_elements(coalesce(payload -> 'budget_items', '[]'::jsonb)) with ordinality as t(b, ord);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('budget_items', v_n);

  -- Deudas (se guarda key → uuid para resolver referencias)
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'debts', '[]'::jsonb)) loop
    v_ord := v_ord + 1;
    insert into public.debts (
      nombre, entidad, tipo, tasa_anual, tasa_efectiva_anual, cuota_mensual, seguro_mensual,
      dia_corte, dia_pago, limite_credito, saldo_base, fecha_base, saldo_cancelacion,
      saldo_cancelacion_fecha, cuotas_totales, cuota_actual, fecha_vencimiento, prioridad,
      activa, cerrada_en, notas, interes_modo, monto_original, pago_unico
    ) values (
      v_item ->> 'nombre',
      v_item ->> 'entidad',
      (v_item ->> 'tipo')::public.debt_type,
      (v_item ->> 'tasa_anual')::numeric,
      (v_item ->> 'tasa_efectiva_anual')::numeric,
      (v_item ->> 'cuota_mensual')::numeric,
      (v_item ->> 'seguro_mensual')::numeric,
      (v_item ->> 'dia_corte')::int,
      (v_item ->> 'dia_pago')::int,
      (v_item ->> 'limite_credito')::numeric,
      (v_item ->> 'saldo_base')::numeric,
      (v_item ->> 'fecha_base')::date,
      (v_item ->> 'saldo_cancelacion')::numeric,
      (v_item ->> 'saldo_cancelacion_fecha')::date,
      (v_item ->> 'cuotas_totales')::int,
      (v_item ->> 'cuota_actual')::int,
      (v_item ->> 'fecha_vencimiento')::date,
      coalesce((v_item ->> 'prioridad')::int, v_ord),
      coalesce((v_item ->> 'activa')::boolean, true),
      (v_item ->> 'cerrada_en')::date,
      v_item ->> 'notas',
      coalesce(v_item ->> 'interes_modo', 'saldo'),
      (v_item ->> 'monto_original')::numeric,
      coalesce((v_item ->> 'pago_unico')::boolean, false)
    )
    returning id into v_id;
    v_keys := v_keys || jsonb_build_object(v_item ->> 'key', v_id);
  end loop;
  v_counts := v_counts || jsonb_build_object('debts', v_ord);

  -- Planes: el `plan` único de antes o la lista `plans` de un respaldo.
  v_plans := coalesce(payload -> 'plans', '[]'::jsonb)
    || case when payload ? 'plan' then jsonb_build_array(payload -> 'plan') else '[]'::jsonb end;

  -- Valida que toda referencia a deuda exista en el payload.
  perform 1
  from (
    select x ->> 'debt' as k from jsonb_array_elements(coalesce(payload -> 'debt_installments', '[]'::jsonb)) x
    union all select x ->> 'debt' from jsonb_array_elements(coalesce(payload -> 'snapshots', '[]'::jsonb)) x
    union all select x ->> 'debt' from jsonb_array_elements(coalesce(payload -> 'payments', '[]'::jsonb)) x
    union all select x ->> 'debt' from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) x
    union all
    select r ->> 'debt'
    from jsonb_array_elements(v_plans) p, jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) r
  ) refs
  where refs.k is not null and not v_keys ? refs.k;
  if found then
    raise exception 'El archivo hace referencia a una deuda que no existe.';
  end if;

  -- Cuotas fuera de saldo
  insert into public.debt_installments (
    debt_id, descripcion, monto_cuota, cuotas_totales, cuotas_cobradas, capital_pendiente,
    cargo_extra_por_cuota, activa
  )
  select
    (v_keys ->> (i ->> 'debt'))::uuid,
    i ->> 'descripcion',
    (i ->> 'monto_cuota')::numeric,
    (i ->> 'cuotas_totales')::int,
    coalesce((i ->> 'cuotas_cobradas')::int, 0),
    (i ->> 'capital_pendiente')::numeric,
    coalesce((i ->> 'cargo_extra_por_cuota')::numeric, 0),
    coalesce((i ->> 'activa')::boolean, true)
  from jsonb_array_elements(coalesce(payload -> 'debt_installments', '[]'::jsonb)) i;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('debt_installments', v_n);

  -- Historial de saldos (antes que los pagos: el trigger de pagos los sobrescribe con origen 'registro')
  insert into public.monthly_snapshots (debt_id, periodo, saldo, cuotas_fuera_saldo, origen)
  select
    (v_keys ->> (s ->> 'debt'))::uuid,
    (s ->> 'periodo')::date,
    (s ->> 'saldo')::numeric,
    coalesce((s ->> 'cuotas_fuera_saldo')::numeric, 0),
    coalesce(s ->> 'origen', 'historial')::public.snapshot_origin
  from jsonb_array_elements(coalesce(payload -> 'snapshots', '[]'::jsonb)) s;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('monthly_snapshots', v_n);

  -- Pagos
  insert into public.payments (
    debt_id, fecha, periodo, pago_total, interes, cargos, saldo_despues, es_estimado, fuente, notas
  )
  select
    (v_keys ->> (p ->> 'debt'))::uuid,
    (p ->> 'fecha')::date,
    (p ->> 'periodo')::date,
    (p ->> 'pago_total')::numeric,
    (p ->> 'interes')::numeric,
    (p ->> 'cargos')::numeric,
    (p ->> 'saldo_despues')::numeric,
    coalesce((p ->> 'es_estimado')::boolean, false),
    p ->> 'fuente',
    p ->> 'notas'
  from jsonb_array_elements(coalesce(payload -> 'payments', '[]'::jsonb)) p
  order by (p ->> 'fecha')::date;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('payments', v_n);

  -- Un respaldo trae los saldos de cada mes tal como estaban (registro o ajuste manual):
  -- se reaplican después de los pagos para que el trigger no los cambie.
  insert into public.monthly_snapshots (debt_id, periodo, saldo, cuotas_fuera_saldo, origen)
  select
    (v_keys ->> (s ->> 'debt'))::uuid,
    (s ->> 'periodo')::date,
    (s ->> 'saldo')::numeric,
    coalesce((s ->> 'cuotas_fuera_saldo')::numeric, 0),
    (s ->> 'origen')::public.snapshot_origin
  from jsonb_array_elements(coalesce(payload -> 'snapshots', '[]'::jsonb)) s
  where s ->> 'origen' in ('registro', 'manual')
  on conflict (debt_id, periodo) do update
    set saldo = excluded.saldo,
        cuotas_fuera_saldo = excluded.cuotas_fuera_saldo,
        origen = excluded.origen;

  -- Gastos
  insert into public.expenses (fecha, periodo, descripcion, categoria, monto, metodo, debt_id)
  select
    (e ->> 'fecha')::date,
    (e ->> 'periodo')::date,
    e ->> 'descripcion',
    e ->> 'categoria',
    (e ->> 'monto')::numeric,
    (e ->> 'metodo')::public.payment_method,
    (v_keys ->> (e ->> 'debt'))::uuid
  from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) e;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('expenses', v_n);

  -- Ingresos extra
  insert into public.extra_incomes (periodo, concepto, monto)
  select (x ->> 'periodo')::date, x ->> 'concepto', (x ->> 'monto')::numeric
  from jsonb_array_elements(coalesce(payload -> 'extra_incomes', '[]'::jsonb)) x;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('extra_incomes', v_n);

  -- Dinero que me deben
  insert into public.receivables (persona, monto, saldo, notas)
  select r ->> 'persona', (r ->> 'monto')::numeric, (r ->> 'saldo')::numeric, r ->> 'notas'
  from jsonb_array_elements(coalesce(payload -> 'receivables', '[]'::jsonb)) r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('receivables', v_n);

  -- Planes (la proyección se guarda como snapshot para que la meta no cambie sola).
  -- Se insertan inactivos y al final se activa el primero marcado como activo.
  update public.plans set activo = false where user_id = v_user and activo
    and exists (select 1 from jsonb_array_elements(v_plans) p where coalesce((p ->> 'activo')::boolean, false));

  for v_plan in select * from jsonb_array_elements(v_plans) loop
    insert into public.plans (nombre, estrategia, presupuesto_deudas, abono_extra, fecha_inicio, activo, supuestos)
    values (
      v_plan ->> 'nombre',
      (v_plan ->> 'estrategia')::public.plan_strategy,
      (v_plan ->> 'presupuesto_deudas')::numeric,
      coalesce((v_plan ->> 'abono_extra')::numeric, 0),
      (v_plan ->> 'fecha_inicio')::date,
      false,
      v_plan -> 'supuestos'
    )
    returning id into v_plan_id;

    if v_activo_id is null and coalesce((v_plan ->> 'activo')::boolean, false) then
      v_activo_id := v_plan_id;
    end if;

    insert into public.plan_rows (plan_id, periodo, debt_id, saldo, pago, interes_cargos)
    select
      v_plan_id,
      (r ->> 'periodo')::date,
      (v_keys ->> (r ->> 'debt'))::uuid,
      (r ->> 'saldo')::numeric,
      (r ->> 'pago')::numeric,
      (r ->> 'interes_cargos')::numeric
    from jsonb_array_elements(coalesce(v_plan -> 'rows', '[]'::jsonb)) r;
    get diagnostics v_n = row_count;
    v_rows := v_rows + v_n;
  end loop;

  if v_activo_id is not null then
    update public.plans set activo = true where id = v_activo_id;
  end if;
  v_counts := v_counts || jsonb_build_object('plans', jsonb_array_length(v_plans), 'plan_rows', v_rows);

  return v_counts;
end;
$$;
