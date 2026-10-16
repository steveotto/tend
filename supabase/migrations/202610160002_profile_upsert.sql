drop policy if exists "Users insert their own profile" on public.tend_profiles;
create policy "Users insert their own profile"
  on public.tend_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

grant insert (user_id, display_name) on table public.tend_profiles to authenticated;
