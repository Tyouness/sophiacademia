-- Phase 1 fix: restore uniqueness protection for requests with NULL child_id.
--
-- Problem: the index created in 0017 uses (professor_id, family_id, child_id, subject, status).
-- In PostgreSQL, NULL values are treated as DISTINCT from each other in unique indexes,
-- so two rows with child_id = NULL and identical (professor, family, subject, status)
-- do NOT trigger a uniqueness conflict. The original protection was therefore broken.
--
-- Solution: two separate partial unique indexes, one per NULL/NOT NULL case.
-- This is idiomatic PostgreSQL and avoids any COALESCE/dummy-UUID workaround.

-- Drop the index created in 0017 that does not handle the NULL case correctly.
drop index if exists requests_unique_pair_idx;

-- Index 1: one active request per (professor, family, child, subject) when a child IS specified.
create unique index if not exists requests_unique_with_child_idx
  on public.requests (professor_id, family_id, child_id, subject, status)
  where child_id is not null
    and status in ('pending', 'coords_sent', 'approved');

-- Index 2: one active request per (professor, family, subject) when NO child is specified.
-- This restores the original behaviour for legacy / child-less requests.
create unique index if not exists requests_unique_no_child_idx
  on public.requests (professor_id, family_id, subject, status)
  where child_id is null
    and status in ('pending', 'coords_sent', 'approved');
