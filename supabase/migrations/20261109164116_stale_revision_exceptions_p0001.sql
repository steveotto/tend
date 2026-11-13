-- Version 20261109164116 matches the already-applied live migration record.
-- The live migration used a guarded replacement; this local source is not
-- asserted to be byte-identical to that applied SQL.

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
    raise exception 'Stale revision; reload or resolve the device draft' using errcode = 'P0001';
  end if;

  return query select v_revision, v_updated_at;
end;
$$;

revoke all on function public.tend_save_user_state(jsonb, bigint, integer) from public, anon;
grant execute on function public.tend_save_user_state(jsonb, bigint, integer) to authenticated;

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
    raise exception 'Stale Preview backup revision' using errcode = 'P0001';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.tend_save_preview_backup(jsonb, bigint, integer) from public, anon;
grant execute on function public.tend_save_preview_backup(jsonb, bigint, integer) to authenticated;
