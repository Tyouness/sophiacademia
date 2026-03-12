-- ──────────────────────────────────────────────────────────────────────────
-- Migration 0029 — pilot_runs
--
-- Trace des pilotes encadrés lancés explicitement par un admin.
-- Un pilote couvre un professeur × une période (YYYY-MM) avec les familles
-- éligibles associées.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pilot_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Périmètre du pilote
  professor_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professor_name   text,
  period           text NOT NULL,                 -- 'YYYY-MM'
  family_ids       jsonb NOT NULL DEFAULT '[]',   -- string[] de UUIDs famille

  -- Statut du cycle de vie
  status           text NOT NULL DEFAULT 'running'
    CHECK (status IN (
      'running',
      'completed_success',
      'completed_incomplete',
      'completed_failed',
      'abandoned'
    )),

  -- Traçabilité
  launched_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  launched_at      timestamp with time zone NOT NULL DEFAULT now(),
  closed_at        timestamp with time zone,
  notes            text,

  created_at       timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pilot_runs IS
  'Declared payroll pilots: one row per explicit launch by an admin. '
  'Tracks lifecycle from running → completed_* or abandoned.';

COMMENT ON COLUMN public.pilot_runs.period IS
  'Period key in YYYY-MM format matching payslips.period.';

COMMENT ON COLUMN public.pilot_runs.family_ids IS
  'JSON array of family UUIDs in scope at launch time.';

COMMENT ON COLUMN public.pilot_runs.status IS
  'running=active; completed_success=all artifacts ok; '
  'completed_incomplete=partial artifacts; completed_failed=no payslip; '
  'abandoned=manually cancelled.';

-- ── Unicité : un seul pilote actif (running) par (professor, period) ────────
CREATE UNIQUE INDEX IF NOT EXISTS pilot_runs_active_unique
  ON public.pilot_runs(professor_id, period)
  WHERE status = 'running';

-- ── Index utilitaires ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pilot_runs_professor_idx  ON public.pilot_runs(professor_id);
CREATE INDEX IF NOT EXISTS pilot_runs_status_idx     ON public.pilot_runs(status);
CREATE INDEX IF NOT EXISTS pilot_runs_launched_at_idx ON public.pilot_runs(launched_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.pilot_runs ENABLE ROW LEVEL SECURITY;

-- Admin : lecture + écriture complète
CREATE POLICY "pilot_runs_admin_all" ON public.pilot_runs
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
