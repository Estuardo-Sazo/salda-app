-- Saldá · Un pago mantiene actualizado el saldo mensual de su deuda.

-- Capital de cuotas que el banco aún no cobra: capital_pendiente si el banco lo informa;
-- si no, (cuota − cargo extra) × cuotas restantes.
create function public.debt_fuera_saldo(p_debt_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(coalesce(i.capital_pendiente, (i.monto_cuota - i.cargo_extra_por_cuota) * (i.cuotas_totales - i.cuotas_cobradas))), 0)::numeric(12,2)
  from public.debt_installments i
  where i.debt_id = p_debt_id
    and i.activa
    and i.cuotas_cobradas < i.cuotas_totales;
$$;

-- Upsert del snapshot (debt_id, periodo) con el saldo del pago más reciente de ese mes.
-- Si ya no quedan pagos en el período, se borra el snapshot cuando su origen es 'registro'.
create function public.refresh_snapshot(p_debt_id uuid, p_periodo date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_saldo numeric(12,2);
  v_user uuid;
begin
  select p.saldo_despues, p.user_id
    into v_saldo, v_user
  from public.payments p
  where p.debt_id = p_debt_id and p.periodo = p_periodo
  order by p.fecha desc, p.created_at desc
  limit 1;

  if found then
    insert into public.monthly_snapshots (user_id, debt_id, periodo, saldo, cuotas_fuera_saldo, origen)
    values (v_user, p_debt_id, p_periodo, v_saldo, public.debt_fuera_saldo(p_debt_id), 'registro')
    on conflict (debt_id, periodo) do update
      set saldo = excluded.saldo,
          cuotas_fuera_saldo = excluded.cuotas_fuera_saldo,
          origen = 'registro';
  else
    delete from public.monthly_snapshots s
    where s.debt_id = p_debt_id and s.periodo = p_periodo and s.origen = 'registro';
  end if;
end;
$$;

create function public.payments_sync_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_snapshot(old.debt_id, old.periodo);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_snapshot(new.debt_id, new.periodo);
  end if;
  return null;
end;
$$;

create trigger payments_sync_snapshot
  after insert or update or delete on public.payments
  for each row execute function public.payments_sync_snapshot();

revoke execute on function public.refresh_snapshot(uuid, date) from public, anon;
revoke execute on function public.debt_fuera_saldo(uuid) from public, anon;
grant execute on function public.refresh_snapshot(uuid, date) to authenticated;
grant execute on function public.debt_fuera_saldo(uuid) to authenticated;
