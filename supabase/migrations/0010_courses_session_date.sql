-- Add course session date to course declarations.

alter table public.courses
  add column if not exists course_date timestamp with time zone;

create index if not exists courses_course_date_idx on public.courses (course_date);
