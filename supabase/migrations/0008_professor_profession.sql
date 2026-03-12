-- Add profession details for professor profiles.

alter table public.professor_profiles
  add column if not exists profession_type text,
  add column if not exists profession_title text,
  add column if not exists school_name text,
  add column if not exists employer_name text,
  add column if not exists job_title text;
