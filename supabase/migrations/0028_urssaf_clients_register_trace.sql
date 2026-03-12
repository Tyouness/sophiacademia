-- URSSAF-8: add registration traceability columns to urssaf_clients
-- registered_at: set when the URSSAF API confirms registration (status = 'registered')
-- last_error:    stores the last registration error message (cleared on success)

alter table public.urssaf_clients
  add column if not exists registered_at timestamp with time zone,
  add column if not exists last_error text;
