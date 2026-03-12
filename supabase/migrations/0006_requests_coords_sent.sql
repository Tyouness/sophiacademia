-- Allow tracking when coordinates are shared before approval.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'requests_status_check'
      and conrelid = 'public.requests'::regclass
  ) then
    alter table public.requests drop constraint requests_status_check;
  end if;
end;
$$;

alter table public.requests
  add constraint requests_status_check
  check (status in ('pending', 'coords_sent', 'approved', 'rejected', 'ended', 'detached'));

-- Keep uniqueness while a request is active.

drop index if exists requests_unique_pair_idx;

create unique index if not exists requests_unique_pair_idx
  on public.requests (professor_id, family_id, subject, status)
  where status in ('pending', 'coords_sent', 'approved');
