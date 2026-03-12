-- Backfill planned_sessions from requests.weekly_schedule.
-- For each request that has a non-empty weekly_schedule jsonb array,
-- insert one planned_session row per timestamp entry.
-- Duration comes from requests.session_hours (fallback: 1 hour).
-- Rows are inserted using ON CONFLICT DO NOTHING so re-runs are safe,
-- but there is no unique constraint to conflict on — the DO NOTHING
-- guard is achieved by only inserting rows not already present via
-- a NOT EXISTS check on (request_id, scheduled_at).

do $$
declare
  r record;
  ts text;
  ts_value timestamptz;
begin
  for r in
    select
      id,
      weekly_schedule,
      coalesce(session_hours, 1) as dur
    from public.requests
    where weekly_schedule is not null
      and jsonb_array_length(weekly_schedule) > 0
  loop
    for ts in
      select jsonb_array_elements_text(r.weekly_schedule)
    loop
      begin
        ts_value := ts::timestamptz;
      exception when others then
        continue;  -- skip malformed timestamps silently
      end;

      if not exists (
        select 1
        from public.planned_sessions ps
        where ps.request_id  = r.id
          and ps.scheduled_at = ts_value
      ) then
        insert into public.planned_sessions
          (request_id, scheduled_at, duration_hours, status)
        values
          (r.id, ts_value, r.dur, 'scheduled');
      end if;
    end loop;
  end loop;
end;
$$;
