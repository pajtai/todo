-- rls_auto_enable() is the event-trigger function behind the project's "enable
-- RLS automatically" setting; Supabase created it, not a migration. It's
-- SECURITY DEFINER and was executable by the API roles, which the security
-- advisor flags. Event triggers don't check EXECUTE, so revoking it keeps the
-- trigger working.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
