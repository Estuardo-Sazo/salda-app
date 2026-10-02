-- Saldá · Las cuotas fuera de saldo mantienen al día el snapshot más reciente de su deuda.
-- Al marcar "+1 cuota cobrada", agregar o borrar una cuota, el total real del mes cambia sin esperar a un pago.

create function public.installments_sync_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_debt uuid := coalesce(new.debt_id, old.debt_id);
begin
  update public.monthly_snapshots s
     set cuotas_fuera_saldo = public.debt_fuera_saldo(v_debt)
   where s.debt_id = v_debt
     and s.periodo = (
       select max(m.periodo) from public.monthly_snapshots m where m.debt_id = v_debt
     );
  return null;
end;
$$;

create trigger installments_sync_snapshot
  after insert or update or delete on public.debt_installments
  for each row execute function public.installments_sync_snapshot();
