create table if not exists public.tend_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tend_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.tend_profiles enable row level security;
alter table public.tend_user_state enable row level security;
grant usage on schema public to authenticated;

drop policy if exists "Users read their own profile" on public.tend_profiles;
create policy "Users read their own profile"
  on public.tend_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users update their own profile" on public.tend_profiles;
create policy "Users update their own profile"
  on public.tend_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users read their own state" on public.tend_user_state;
create policy "Users read their own state"
  on public.tend_user_state for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert their own state" on public.tend_user_state;
create policy "Users insert their own state"
  on public.tend_user_state for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update their own state" on public.tend_user_state;
create policy "Users update their own state"
  on public.tend_user_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.tend_profiles from public, anon, authenticated;
revoke all on table public.tend_user_state from public, anon, authenticated;
grant select, update (display_name) on table public.tend_profiles to authenticated;
grant select on table public.tend_user_state to authenticated;

create or replace function public.tend_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tend_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.tend_create_profile() from public, anon, authenticated;

create or replace function public.tend_touch_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.tend_touch_profile() from public, anon, authenticated;

drop trigger if exists tend_create_profile_after_signup on auth.users;
create trigger tend_create_profile_after_signup
  after insert on auth.users
  for each row execute function public.tend_create_profile();

drop trigger if exists tend_touch_profile_before_update on public.tend_profiles;
create trigger tend_touch_profile_before_update
  before update on public.tend_profiles
  for each row execute function public.tend_touch_profile();

create or replace function public.tend_save_user_state(
  p_state jsonb,
  p_expected_revision bigint,
  p_schema_version integer
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or p_schema_version is null or p_schema_version < 1
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid state document' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.tend_user_state as inserted_state (user_id, state, schema_version, revision, updated_at)
    values (v_user_id, p_state, p_schema_version, 1, clock_timestamp())
    on conflict (user_id) do nothing
    returning inserted_state.revision, inserted_state.updated_at
      into v_revision, v_updated_at;
  else
    update public.tend_user_state as current_state
      set state = p_state,
          schema_version = p_schema_version,
          revision = current_state.revision + 1,
          updated_at = clock_timestamp()
      where current_state.user_id = v_user_id
        and current_state.revision = p_expected_revision
    returning current_state.revision, current_state.updated_at
      into v_revision, v_updated_at;
  end if;

  if not found then
    raise exception 'Stale revision; reload or resolve the device draft' using errcode = '40001';
  end if;

  return query select v_revision, v_updated_at;
end;
$$;

revoke all on function public.tend_save_user_state(jsonb, bigint, integer) from public, anon;
grant execute on function public.tend_save_user_state(jsonb, bigint, integer) to authenticated;
