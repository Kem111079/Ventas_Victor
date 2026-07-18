-- Ventas de Víctor · Supabase multiusuario
-- Ejecutar completo en Supabase > SQL Editor.
-- Versión 2.0.0 · 2026-07-18

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  slug text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_slug text not null references public.businesses(slug) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'seller' check (role in ('admin','seller','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (business_slug, user_id)
);

create table if not exists public.business_state (
  business_slug text primary key references public.businesses(slug) on delete cascade,
  version bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.document_sequences (
  business_slug text not null references public.businesses(slug) on delete cascade,
  prefix text not null,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (business_slug, prefix)
);

create table if not exists public.sync_audit (
  id bigint generated always as identity primary key,
  business_slug text not null references public.businesses(slug) on delete cascade,
  user_id uuid references public.profiles(id),
  state_version bigint not null,
  event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute procedure public.handle_new_user();

-- Crear perfiles faltantes si los usuarios ya existían antes de ejecutar este script.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(coalesce(email,''), '@', 1))
from auth.users
on conflict (id) do nothing;

create or replace function public.vv_current_role(p_business_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select bm.role
  from public.business_members bm
  where bm.business_slug = p_business_slug
    and bm.user_id = auth.uid()
    and bm.active = true
  limit 1;
$$;

create or replace function public.vv_next_document(
  p_business_slug text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_prefix text;
  v_next bigint;
begin
  v_role := public.vv_current_role(p_business_slug);
  if v_role not in ('admin','seller') then
    raise exception 'VV_FORBIDDEN' using errcode = '42501';
  end if;

  v_prefix := upper(regexp_replace(coalesce(p_prefix,''), '[^A-Z0-9]', '', 'g'));
  if v_prefix = '' or length(v_prefix) > 4 then
    raise exception 'VV_INVALID_PREFIX' using errcode = '22023';
  end if;

  insert into public.document_sequences (business_slug, prefix, last_value)
  values (p_business_slug, v_prefix, 1)
  on conflict (business_slug, prefix)
  do update set last_value = public.document_sequences.last_value + 1,
                updated_at = now()
  returning last_value into v_next;

  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;

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
  if v_role not in ('admin','seller') then
    raise exception 'VV_FORBIDDEN' using errcode = '42501';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'VV_INVALID_STATE' using errcode = '22023';
  end if;

  select bs.version
    into v_current
  from public.business_state bs
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
    returning business_state.version, business_state.updated_at
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

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.business_state enable row level security;
alter table public.document_sequences enable row level security;
alter table public.sync_audit enable row level security;

-- Limpiar políticas anteriores del mismo nombre para permitir reejecución.
drop policy if exists "vv businesses select" on public.businesses;
drop policy if exists "vv profiles own select" on public.profiles;
drop policy if exists "vv members own select" on public.business_members;
drop policy if exists "vv members admin select" on public.business_members;
drop policy if exists "vv state member select" on public.business_state;
drop policy if exists "vv audit admin select" on public.sync_audit;

create policy "vv businesses select"
on public.businesses for select
to authenticated
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_slug = businesses.slug
      and bm.user_id = auth.uid()
      and bm.active = true
  )
);

create policy "vv profiles own select"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "vv members own select"
on public.business_members for select
to authenticated
using (user_id = auth.uid());

create policy "vv members admin select"
on public.business_members for select
to authenticated
using (public.vv_current_role(business_slug) = 'admin');

create policy "vv state member select"
on public.business_state for select
to authenticated
using (public.vv_current_role(business_slug) is not null);

create policy "vv audit admin select"
on public.sync_audit for select
to authenticated
using (public.vv_current_role(business_slug) = 'admin');

-- Las escrituras directas quedan bloqueadas; se realizan mediante RPC con control de rol y versión.
revoke insert, update, delete on public.business_state from anon, authenticated;
revoke insert, update, delete on public.document_sequences from anon, authenticated;
revoke insert, update, delete on public.sync_audit from anon, authenticated;

grant select on public.businesses, public.profiles, public.business_members, public.business_state to authenticated;
grant select on public.sync_audit to authenticated;
grant execute on function public.vv_current_role(text) to authenticated;
grant execute on function public.vv_next_document(text, text) to authenticated;
grant execute on function public.vv_save_state(text, bigint, jsonb, jsonb) to authenticated;

insert into public.businesses (slug, name)
values ('ventas-victor', 'Ventas de Víctor')
on conflict (slug) do update set name = excluded.name;

-- Activar Realtime para la fila compartida.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'business_state'
  ) then
    alter publication supabase_realtime add table public.business_state;
  end if;
end $$;

-- PASO FINAL (después de crear los 3 usuarios en Authentication > Users):
-- Reemplace los correos y ejecute. Debe existir exactamente un administrador.
--
-- insert into public.business_members (business_slug, user_id, role)
-- select 'ventas-victor', id, 'admin' from auth.users where email = 'administrador@correo.com'
-- on conflict (business_slug, user_id) do update set role = excluded.role, active = true;
--
-- insert into public.business_members (business_slug, user_id, role)
-- select 'ventas-victor', id, 'seller' from auth.users where email in ('vendedor1@correo.com','vendedor2@correo.com')
-- on conflict (business_slug, user_id) do update set role = excluded.role, active = true;
