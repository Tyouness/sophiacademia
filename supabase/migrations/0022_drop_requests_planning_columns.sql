-- Phase 3B: Drop legacy planning columns from requests.
--
-- These 4 columns have been superseded by the planned_sessions table (migration 0019).
-- All application reads and writes have been migrated to planned_sessions.
-- The trigger enforce_request_status_only no longer references these columns (migration 0021).
-- Backfill from these columns into planned_sessions was done in migration 0020.
--
-- This migration is irreversible. The data is safely preserved in planned_sessions.

alter table public.requests
  drop column if exists weekly_schedule,
  drop column if exists weekly_sessions,
  drop column if exists session_hours,
  drop column if exists first_course_at;
