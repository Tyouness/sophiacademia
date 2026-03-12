do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum (
      'admin',
      'staff',
      'professor',
      'family'
    );
  end if;
end;
$$;

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'family',
  username text,
  full_name text,
  phone text,
  disabled_at timestamp with time zone,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists disabled_at timestamp with time zone;
alter table public.profiles add column if not exists deleted_at timestamp with time zone;
alter table public.profiles add column if not exists deleted_by uuid;

create unique index if not exists profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, username)
  values (
    new.id,
    'family',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'username'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.has_role_or_admin(required_role public.user_role)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', required_role)
  );
$$;

create or replace function public.is_owner(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.uid() = user_id;
$$;

drop policy if exists "Profiles are viewable by owner or admin" on public.profiles;
create policy "Profiles are viewable by owner or admin"
on public.profiles
for select
using (public.is_admin() or public.is_owner(id));

drop policy if exists "Profiles are updatable by owner or admin" on public.profiles;
create policy "Profiles are updatable by owner or admin"
on public.profiles
for update
using (public.is_admin() or public.is_owner(id))
with check (public.is_admin() or public.is_owner(id));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_user_id uuid,
  role_set text,
  metadata jsonb not null default '{}',
  created_at timestamp with time zone not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "Audit logs readable by admin" on public.audit_logs;
create policy "Audit logs readable by admin"
on public.audit_logs
for select
using (public.is_admin());

drop policy if exists "Audit logs insert by admin" on public.audit_logs;
create policy "Audit logs insert by admin"
on public.audit_logs
for insert
with check (public.is_admin());

create or replace function public.set_role_by_admin_emails(
  target_user_id uuid,
  target_email text,
  admin_emails text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(target_email, ''));
  is_admin_email boolean := exists (
    select 1
    from unnest(admin_emails) as email
    where lower(trim(email)) = normalized_email
  );
begin
  if not is_admin_email then
    return false;
  end if;

  insert into public.profiles (id, role)
  values (target_user_id, 'admin')
  on conflict (id) do update set role = 'admin';

  return true;
end;
$$;

create or replace function public.set_user_role(
  target_user_id uuid,
  new_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

grant execute on function public.set_role_by_admin_emails(uuid, text, text[]) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

do $$
declare
  table_name text;
  has_user_id boolean;
begin
  foreach table_name in array ARRAY['requests', 'assignments', 'time_entries', 'invoices'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security;', table_name);

      execute format(
        'create policy "%s admin access" on public.%I for all using (public.is_admin()) with check (public.is_admin());',
        table_name,
        table_name
      );

      execute format(
        'create policy "%s staff access" on public.%I for all using (public.has_role_or_admin(''staff'')) with check (public.has_role_or_admin(''staff''));',
        table_name,
        table_name
      );

      select exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = table_name
          and c.column_name = 'user_id'
      ) into has_user_id;

      if has_user_id then
        execute format(
          'create policy "%s owner access" on public.%I for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));',
          table_name,
          table_name
        );
      end if;
    end if;
  end loop;
end;
$$;
