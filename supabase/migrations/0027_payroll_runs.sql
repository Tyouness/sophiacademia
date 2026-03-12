-- ──────────────────────────────────────────────────────────────────────────
-- Migration 0027 — payroll_runs
--
-- Tracabilite des runs de paie mensuelle.
-- Chaque appel a computeMonthlyPayslipsForPeriod cree une ligne ici.
-- Idempotent : un re-run sur la meme periode cree une nouvelle ligne (audit).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period               text NOT NULL,                          -- 'YYYY-MM'
  status               text NOT NULL DEFAULT 'running'        -- 'running' | 'success' | 'partial' | 'failed'
                          CHECK (status IN ('running','success','partial','failed')),
  triggered_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at           timestamp with time zone NOT NULL DEFAULT now(),
  finished_at          timestamp with time zone,
  professors_processed integer NOT NULL DEFAULT 0,
  payslips_created     integer NOT NULL DEFAULT 0,
  family_docs_created  integer NOT NULL DEFAULT 0,
  family_docs_failed   integer NOT NULL DEFAULT 0,
  contrib_errors       integer NOT NULL DEFAULT 0,
  errors_count         integer NOT NULL DEFAULT 0,
  error_details        jsonb,    -- array of {professorId, message}
  notes                text,
  created_at           timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll_runs IS
  'Audit trail of monthly payroll run executions. One row per run attempt.';

COMMENT ON COLUMN public.payroll_runs.period IS
  'Period key in YYYY-MM format (e.g. 2026-02).';

COMMENT ON COLUMN public.payroll_runs.status IS
  'running = in progress; success = all ok; partial = some professor errors; failed = run aborted early.';

COMMENT ON COLUMN public.payroll_runs.error_details IS
  'Array of {professorId: string, message: string} objects for per-professor errors.';

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS payroll_runs_period_idx ON public.payroll_runs(period);
CREATE INDEX IF NOT EXISTS payroll_runs_started_at_idx ON public.payroll_runs(started_at DESC);

-- RLS: admin can read and write; staff can read only.
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_admin_all" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "payroll_runs_staff_read" ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );
