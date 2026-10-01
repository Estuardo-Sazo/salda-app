-- Saldá · Row Level Security: cada usuario ve y modifica solo sus filas.

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'budget_items', 'debts', 'debt_installments', 'payments', 'expenses',
    'monthly_snapshots', 'plans', 'plan_rows', 'receivables'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- Permisos explícitos: solo usuarios autenticados usan la API; anon no ve tablas.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
