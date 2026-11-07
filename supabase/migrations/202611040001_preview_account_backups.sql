create table if not exists public.tend_preview_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null
    check (jsonb_typeof(document) = 'object')
    check (document ->> 'format' = 'tend.synthetic-preview')
    check (document -> 'schemaVersion' = to_jsonb(schema_version)),
  schema_version integer not null check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.tend_preview_backups enable row level security;
grant usage on schema public to authenticated;

drop policy if exists "Users read their own Preview backup" on public.tend_preview_backups;
create policy "Users read their own Preview backup"
  on public.tend_preview_backups for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert their own Preview backup" on public.tend_preview_backups;
create policy "Users insert their own Preview backup"
  on public.tend_preview_backups for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update their own Preview backup" on public.tend_preview_backups;
create policy "Users update their own Preview backup"
  on public.tend_preview_backups for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.tend_preview_backups from public, anon, authenticated;
grant select on table public.tend_preview_backups to authenticated;

create or replace function public.tend_save_preview_backup(
  p_document jsonb,
  p_expected_revision bigint,
  p_schema_version integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_document is null
    or jsonb_typeof(p_document) <> 'object'
    or p_document ->> 'format' <> 'tend.synthetic-preview'
    or p_schema_version is null
    or p_schema_version < 1
    or p_document -> 'schemaVersion' is distinct from to_jsonb(p_schema_version)
    or p_expected_revision is null
    or p_expected_revision < 0 then
    raise exception 'Invalid Preview backup document' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.tend_preview_backups as inserted_backup (
      user_id,
      document,
      schema_version,
      revision,
      updated_at
    )
    values (
      v_user_id,
      p_document,
      p_schema_version,
      1,
      clock_timestamp()
    )
    on conflict (user_id) do nothing
    returning inserted_backup.revision into v_revision;
  else
    update public.tend_preview_backups as current_backup
      set document = p_document,
          schema_version = p_schema_version,
          revision = current_backup.revision + 1,
          updated_at = clock_timestamp()
      where current_backup.user_id = v_user_id
        and current_backup.revision = p_expected_revision
    returning current_backup.revision into v_revision;
  end if;

  if not found then
    raise exception 'Stale Preview backup revision' using errcode = '40001';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.tend_save_preview_backup(jsonb, bigint, integer) from public, anon;
grant execute on function public.tend_save_preview_backup(jsonb, bigint, integer) to authenticated;
