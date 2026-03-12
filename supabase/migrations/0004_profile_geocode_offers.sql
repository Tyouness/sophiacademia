alter table public.profiles add column if not exists addr1 text;
alter table public.profiles add column if not exists addr2 text;
alter table public.profiles add column if not exists postcode text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists lat numeric;
alter table public.profiles add column if not exists lng numeric;
alter table public.profiles add column if not exists address_hash text;
alter table public.profiles add column if not exists geocoded_at timestamp with time zone;

alter table public.family_profiles add column if not exists addr1 text;
alter table public.family_profiles add column if not exists addr2 text;
alter table public.family_profiles add column if not exists country text;
alter table public.family_profiles add column if not exists address_hash text;
alter table public.family_profiles add column if not exists geocoded_at timestamp with time zone;

alter table public.professor_profiles add column if not exists addr1 text;
alter table public.professor_profiles add column if not exists addr2 text;
alter table public.professor_profiles add column if not exists country text;
alter table public.professor_profiles add column if not exists address_hash text;
alter table public.professor_profiles add column if not exists geocoded_at timestamp with time zone;

-- Owner update policies for profiles and profile tables.
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "family_profiles_owner_update" on public.family_profiles;
drop policy if exists "professor_profiles_owner_update" on public.professor_profiles;

create policy "profiles_owner_update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "family_profiles_owner_update"
  on public.family_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "professor_profiles_owner_update"
  on public.professor_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
