create table if not exists public.tend_preview_backup_recoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_revision bigint not null check (source_revision > 0),
  document jsonb not null,
  schema_version integer not null check (schema_version > 0),
  source_updated_at timestamptz not null,
  preserved_at timestamptz not null default now(),
  primary key (user_id, source_revision),
  check (jsonb_typeof(document) = 'object'),
  check (document ->> 'format' = 'tend.synthetic-preview'),
  check (document -> 'schemaVersion' = to_jsonb(schema_version))
);

alter table public.tend_preview_backup_recoveries enable row level security;

drop policy if exists "Users read their own Preview backup recoveries"
  on public.tend_preview_backup_recoveries;
create policy "Users read their own Preview backup recoveries"
  on public.tend_preview_backup_recoveries for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.tend_preview_backup_recoveries from public, anon, authenticated;

create or replace function public.tend_preserve_preview_backup(
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_document jsonb;
  v_schema_version integer;
  v_revision bigint;
  v_updated_at timestamptz;
  v_archived_document jsonb;
  v_archived_schema_version integer;
  v_archived_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid Preview backup revision' using errcode = '22023';
  end if;

  select document, schema_version, revision, updated_at
    into v_document, v_schema_version, v_revision, v_updated_at
    from public.tend_preview_backups
    where user_id = v_user_id
    for update;

  if not found or v_revision <> p_expected_revision then
    raise exception 'Stale Preview backup revision' using errcode = 'P0001';
  end if;

  insert into public.tend_preview_backup_recoveries (
    user_id,
    source_revision,
    document,
    schema_version,
    source_updated_at
  )
  values (
    v_user_id,
    v_revision,
    v_document,
    v_schema_version,
    v_updated_at
  )
  on conflict (user_id, source_revision) do nothing;

  select document, schema_version, source_updated_at
    into v_archived_document, v_archived_schema_version, v_archived_updated_at
    from public.tend_preview_backup_recoveries
    where user_id = v_user_id
      and source_revision = v_revision;

  if not found then
    raise exception 'Preview recovery archive could not be verified' using errcode = 'P0001';
  end if;
  if v_archived_document is distinct from v_document
    or v_archived_schema_version is distinct from v_schema_version
    or v_archived_updated_at is distinct from v_updated_at then
    raise exception 'Preview recovery archive conflict' using errcode = 'P0001';
  end if;

  return v_revision;
end;
$$;

create or replace function public.tend_read_preview_backup_recovery(
  p_source_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_archive jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_source_revision is null or p_source_revision < 1 then
    raise exception 'Invalid Preview recovery revision' using errcode = '22023';
  end if;

  select jsonb_build_object(
      'document', document,
      'schemaVersion', schema_version,
      'revision', source_revision,
      'updatedAt', source_updated_at,
      'preservedAt', preserved_at
    )
    into v_archive
    from public.tend_preview_backup_recoveries
    where user_id = v_user_id
      and source_revision = p_source_revision;

  return v_archive;
end;
$$;

create or replace function public.tend_list_preview_backup_recoveries()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_archives jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'document', document,
          'schemaVersion', schema_version,
          'revision', source_revision,
          'updatedAt', source_updated_at,
          'preservedAt', preserved_at
        )
        order by source_revision desc
      ),
      '[]'::jsonb
    )
    into v_archives
    from public.tend_preview_backup_recoveries
    where user_id = v_user_id;

  return v_archives;
end;
$$;

revoke all on function public.tend_preserve_preview_backup(bigint) from public, anon;
revoke all on function public.tend_read_preview_backup_recovery(bigint) from public, anon;
revoke all on function public.tend_list_preview_backup_recoveries() from public, anon;
grant execute on function public.tend_preserve_preview_backup(bigint) to authenticated;
grant execute on function public.tend_read_preview_backup_recovery(bigint) to authenticated;
grant execute on function public.tend_list_preview_backup_recoveries() to authenticated;
