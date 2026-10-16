alter table public.tend_profiles enable row level security;

drop policy if exists "Users read their own profile" on public.tend_profiles;
create policy "Users read their own profile"
  on public.tend_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users update their own profile" on public.tend_profiles;
create policy "Users update their own profile"
  on public.tend_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users insert their own profile" on public.tend_profiles;
create policy "Users insert their own profile"
  on public.tend_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.tend_profiles from public, anon, authenticated;
grant select (user_id, display_name) on table public.tend_profiles to authenticated;
grant update (display_name) on table public.tend_profiles to authenticated;
grant insert (user_id, display_name) on table public.tend_profiles to authenticated;
