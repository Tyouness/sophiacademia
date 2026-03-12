create table if not exists public.family_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  first_name text,
  last_name text,
  level text,
  subjects jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.family_children enable row level security;

drop policy if exists "family_children_admin_all" on public.family_children;
drop policy if exists "family_children_owner_read" on public.family_children;
drop policy if exists "family_children_owner_write" on public.family_children;

create policy "family_children_admin_all"
  on public.family_children
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "family_children_owner_read"
  on public.family_children
  for select
  using (family_id = auth.uid());

create policy "family_children_owner_write"
  on public.family_children
  for all
  using (family_id = auth.uid())
  with check (family_id = auth.uid());

alter table public.family_profiles add column if not exists periods text[];
