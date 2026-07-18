-- Ventas de Víctor V2.1
-- Corrige la referencia ambigua a la columna version en vv_save_state.

create or replace function public.vv_save_state(
  p_business_slug text,
  p_expected_version bigint,
  p_state jsonb,
  p_event jsonb default '{}'::jsonb
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_current bigint;
  v_new bigint;
  v_updated timestamptz;
begin
  v_role := public.vv_current_role(p_business_slug);

  if v_role not in ('admin', 'seller') then
    raise exception 'VV_FORBIDDEN' using errcode = '42501';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'VV_INVALID_STATE' using errcode = '22023';
  end if;

  select bs.version
    into v_current
  from public.business_state as bs
  where bs.business_slug = p_business_slug
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'VV_CONFLICT:0' using errcode = 'P0001';
    end if;

    insert into public.business_state (
      business_slug, version, state, updated_at, updated_by
    ) values (
      p_business_slug, 1, p_state, now(), auth.uid()
    )
    returning public.business_state.version, public.business_state.updated_at
      into v_new, v_updated;
  else
    if v_current <> coalesce(p_expected_version, -1) then
      raise exception 'VV_CONFLICT:%', v_current using errcode = 'P0001';
    end if;

    update public.business_state as bs
       set version = bs.version + 1,
           state = p_state,
           updated_at = now(),
           updated_by = auth.uid()
     where bs.business_slug = p_business_slug
     returning bs.version, bs.updated_at
       into v_new, v_updated;
  end if;

  insert into public.sync_audit (
    business_slug, user_id, state_version, event
  ) values (
    p_business_slug, auth.uid(), v_new, coalesce(p_event, '{}'::jsonb)
  );

  return query select v_new, v_updated;
end;
$$;

grant execute
on function public.vv_save_state(text, bigint, jsonb, jsonb)
to authenticated;
