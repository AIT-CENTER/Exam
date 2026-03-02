-- =============================================================================
-- Online Exam Platform - Schema migrations for new features
-- Run this on an existing database that already has table.sql applied.
-- New installs: run table.sql first, then this file.
--
-- IMPORTANT: For future schema improvements, add ALTER statements here instead
-- of modifying table.sql. This allows incremental updates without rewriting tables.
-- =============================================================================

-- 1) Add columns to exam_sessions for risk scoring and teacher-added time
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS risk_score integer NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_time_seconds integer NULL DEFAULT 0;

COMMENT ON COLUMN public.exam_sessions.risk_score IS 'Security risk score 0-100 from tab switch, disconnect, device change, heartbeat fail';
COMMENT ON COLUMN public.exam_sessions.extra_time_seconds IS 'Extra time in seconds granted by teacher';

-- Allow 'expired' status for server-side auto-submit when time runs out (optional; can use 'submitted' instead)
-- If your CHECK constraint only has in_progress, paused, submitted, inactive, add 'expired' like this:
-- ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_status_check;
-- ALTER TABLE public.exam_sessions ADD CONSTRAINT exam_sessions_status_check CHECK (
--   status = ANY (ARRAY['in_progress','paused','submitted','inactive','expired']::text[])
-- );
-- We keep existing constraint and use 'submitted' for auto-submit.

-- 2) Activity logs: student exam actions (tab switch, fullscreen exit, device change, heartbeat failure, disconnect)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'tab_switch'::text, 'fullscreen_exit'::text, 'device_change'::text,
      'heartbeat_fail'::text, 'disconnect'::text, 'reconnect'::text
    ])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON public.activity_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_student_id ON public.activity_logs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_exam_id ON public.activity_logs USING btree (exam_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs USING btree (event_type);

-- 3) Audit logs: admin/teacher actions for accountability
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id text NULL,
  action text NOT NULL,
  resource_type text NULL,
  resource_id text NULL,
  details jsonb NULL,
  ip_address text NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_type_check CHECK (actor_type = ANY (ARRAY['admin'::text, 'teacher'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs USING btree (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);

-- =============================================================================
-- 3b) Exam timer: end_time column and single active session per student per exam
-- Server-based timer: end_time = started_at + exam_duration; remaining = end_time - now().
-- =============================================================================
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS end_time timestamptz NULL;

COMMENT ON COLUMN public.exam_sessions.end_time IS 'Server-set exam end; remaining time = end_time - now(). Never pause.';

-- Backfill end_time for existing in_progress sessions (started_at + exam.duration + extra_time)
DO $$
DECLARE
  r RECORD;
  dur_min integer;
  extra_sec integer;
BEGIN
  FOR r IN
    SELECT es.id, es.started_at, es.exam_id, es.extra_time_seconds
    FROM public.exam_sessions es
    WHERE es.status = 'in_progress' AND es.end_time IS NULL
  LOOP
    SELECT COALESCE(e.duration, 60) INTO dur_min FROM public.exams e WHERE e.id = r.exam_id;
    extra_sec := COALESCE(r.extra_time_seconds, 0);
    UPDATE public.exam_sessions
    SET end_time = r.started_at + (dur_min * 60 + extra_sec) * interval '1 second'
    WHERE id = r.id;
  END LOOP;
END $$;

-- Replace one-active-per-student with one-active-per-student-per-exam
DROP INDEX IF EXISTS public.unique_student_active_session;
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_exam_active_session
  ON public.exam_sessions (student_id, exam_id) WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_exam_sessions_end_time ON public.exam_sessions (end_time);

-- =============================================================================
-- 3c) Risk & time control: system_settings, exam_risk_logs, risk_count, instruction_seen
-- =============================================================================

-- Admin roles: super_admin (full) vs admin (restricted)
ALTER TABLE public.admin
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'super_admin';

COMMENT ON COLUMN public.admin.role IS 'Admin role: super_admin (full access) or admin (restricted by admin_page_permissions).';

-- Admin-configurable: max tab switches before auto-submit, max time extension teachers can add
CREATE TABLE IF NOT EXISTS public.system_settings (
  id integer PRIMARY KEY DEFAULT 1,
  max_risk_before_submit integer NOT NULL DEFAULT 7,
  max_time_extension_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_settings_single_row CHECK (id = 1)
);

INSERT INTO public.system_settings (id, max_risk_before_submit, max_time_extension_minutes)
VALUES (1, 7, 30)
ON CONFLICT (id) DO NOTHING;

-- Risk events per session (tab_switch, disconnect, device_change)
CREATE TABLE IF NOT EXISTS public.exam_risk_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  event_type text NOT NULL,
  timestamp timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exam_risk_logs_pkey PRIMARY KEY (id),
  CONSTRAINT exam_risk_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_event_type_check CHECK (event_type IN ('tab_switch', 'fullscreen_exit', 'disconnect', 'device_change', 'risk_auto_submit'))
);

-- Migration: extend event_type for existing exam_risk_logs
ALTER TABLE public.exam_risk_logs DROP CONSTRAINT IF EXISTS exam_risk_logs_event_type_check;
ALTER TABLE public.exam_risk_logs ADD CONSTRAINT exam_risk_logs_event_type_check
  CHECK (event_type IN ('tab_switch', 'fullscreen_exit', 'disconnect', 'device_change', 'risk_auto_submit'));

CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_session_id ON public.exam_risk_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_student_id ON public.exam_risk_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_timestamp ON public.exam_risk_logs (timestamp);

-- exam_sessions: risk_count (incremented on tab switch; auto-submit when >= max_risk_before_submit)
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS risk_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exam_sessions.risk_count IS 'Incremented on each tab switch; when >= max_risk_before_submit, exam auto-submits.';

-- exam_sessions: instruction_seen (skip instructions on re-login)
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS instruction_seen boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exam_sessions.instruction_seen IS 'True after student clicks Continue; skip instructions on re-login.';

-- exam_sessions: fullscreen_exit_count (first exit = warning only; fullscreen does NOT increment risk)
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS fullscreen_exit_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exam_sessions.fullscreen_exit_count IS 'First exit: toast only. Fullscreen exit never increments risk_count.';

-- exam_sessions: last_tab_switch_at for deduplication (one risk increment per tab exit)
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS last_tab_switch_at timestamptz NULL;

COMMENT ON COLUMN public.exam_sessions.last_tab_switch_at IS 'Prevents duplicate risk increment if student rapidly switches tabs.';

-- exam_sessions: hidden_from_monitor (teacher removed from live monitor view)
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS hidden_from_monitor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exam_sessions.hidden_from_monitor IS 'Teacher removed student from live monitor; exam continues.';

-- exam_risk_logs: event_value for additional context
ALTER TABLE public.exam_risk_logs
  ADD COLUMN IF NOT EXISTS event_value text NULL;

-- Admin page-level permissions (per role)
CREATE TABLE IF NOT EXISTS public.admin_page_permissions (
  id serial PRIMARY KEY,
  role text NOT NULL,
  page_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_page_permissions_role_check CHECK (role IN ('super_admin','admin')),
  CONSTRAINT admin_page_permissions_unique UNIQUE (role, page_key)
);

-- Seed default permissions for admin role (super_admin is always allowed in application logic)
INSERT INTO public.admin_page_permissions (role, page_key, allowed)
VALUES
  ('admin', 'dashboard_home', false),
  ('admin', 'analytics', false),
  ('admin', 'settings_system', false),
  ('admin', 'teachers_page', true),
  ('admin', 'teachers_create', false),
  ('admin', 'students_page', true),
  ('admin', 'students_create', true),
  ('admin', 'grades_page', true),
  ('admin', 'grades_create', true),
  ('admin', 'subjects_page', true),
  ('admin', 'subjects_create', true)
ON CONFLICT (role, page_key) DO UPDATE
SET allowed = EXCLUDED.allowed,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================================================
-- 4) RLS: All tables and views – admin full access for backup import and management
-- Ensures is_admin() exists, enables RLS on all tables, creates admin policies
-- for every table, and sets security_invoker on all views (PostgreSQL 15+).
-- =============================================================================

-- Helper (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin WHERE id = auth.uid());
$$;

-- Super admin helper (role-based)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.admin;
$$;

-- Enable RLS on all tables (idempotent)
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assign_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------- Admin ----------
DROP POLICY IF EXISTS admin_insert_admin ON public.admin;
DROP POLICY IF EXISTS admin_update_admin ON public.admin;
DROP POLICY IF EXISTS admin_delete_admin ON public.admin;
CREATE POLICY admin_insert_admin ON public.admin FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.admin_count() = 0);
CREATE POLICY admin_update_admin ON public.admin FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_delete_admin ON public.admin FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Admin_page_permissions ----------
DROP POLICY IF EXISTS admin_page_permissions_select_admin ON public.admin_page_permissions;
DROP POLICY IF EXISTS admin_page_permissions_all_super_admin ON public.admin_page_permissions;
CREATE POLICY admin_page_permissions_select_admin ON public.admin_page_permissions
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY admin_page_permissions_all_super_admin ON public.admin_page_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------- Teacher ----------
DROP POLICY IF EXISTS teacher_insert_admin ON public.teacher;
DROP POLICY IF EXISTS teacher_update_admin ON public.teacher;
DROP POLICY IF EXISTS teacher_delete_admin ON public.teacher;
CREATE POLICY teacher_insert_admin ON public.teacher FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY teacher_update_admin ON public.teacher FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY teacher_delete_admin ON public.teacher FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Students ----------
DROP POLICY IF EXISTS students_all_admin ON public.students;
CREATE POLICY students_all_admin ON public.students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Grades ----------
DROP POLICY IF EXISTS grades_all_admin ON public.grades;
CREATE POLICY grades_all_admin ON public.grades FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Subjects ----------
DROP POLICY IF EXISTS subjects_all_admin ON public.subjects;
CREATE POLICY subjects_all_admin ON public.subjects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Grade_sections ----------
DROP POLICY IF EXISTS grade_sections_all_admin ON public.grade_sections;
CREATE POLICY grade_sections_all_admin ON public.grade_sections FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Grade_subjects ----------
DROP POLICY IF EXISTS grade_subjects_all_admin ON public.grade_subjects;
CREATE POLICY grade_subjects_all_admin ON public.grade_subjects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Exams ----------
DROP POLICY IF EXISTS exams_all_admin ON public.exams;
CREATE POLICY exams_all_admin ON public.exams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Assign_exams ----------
DROP POLICY IF EXISTS assign_exams_all_admin ON public.assign_exams;
CREATE POLICY assign_exams_all_admin ON public.assign_exams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Exam_sessions ----------
DROP POLICY IF EXISTS exam_sessions_insert_admin ON public.exam_sessions;
DROP POLICY IF EXISTS exam_sessions_update_admin ON public.exam_sessions;
DROP POLICY IF EXISTS exam_sessions_delete_admin ON public.exam_sessions;
CREATE POLICY exam_sessions_insert_admin ON public.exam_sessions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY exam_sessions_update_admin ON public.exam_sessions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY exam_sessions_delete_admin ON public.exam_sessions FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Session_security ----------
DROP POLICY IF EXISTS session_security_insert_admin ON public.session_security;
DROP POLICY IF EXISTS session_security_update_admin ON public.session_security;
DROP POLICY IF EXISTS session_security_delete_admin ON public.session_security;
CREATE POLICY session_security_insert_admin ON public.session_security FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY session_security_update_admin ON public.session_security FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY session_security_delete_admin ON public.session_security FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Questions ----------
DROP POLICY IF EXISTS questions_all_admin ON public.questions;
CREATE POLICY questions_all_admin ON public.questions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Results ----------
DROP POLICY IF EXISTS results_insert_authenticated ON public.results;
DROP POLICY IF EXISTS results_update_authenticated ON public.results;
DROP POLICY IF EXISTS results_insert_admin ON public.results;
DROP POLICY IF EXISTS results_insert_teacher ON public.results;
DROP POLICY IF EXISTS results_update_admin ON public.results;
DROP POLICY IF EXISTS results_update_teacher ON public.results;
DROP POLICY IF EXISTS results_delete_admin ON public.results;
CREATE POLICY results_insert_admin ON public.results FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY results_insert_teacher ON public.results FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY results_update_admin ON public.results FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY results_update_teacher ON public.results FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY results_delete_admin ON public.results FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Student_answers ----------
DROP POLICY IF EXISTS student_answers_insert_admin ON public.student_answers;
DROP POLICY IF EXISTS student_answers_update_admin ON public.student_answers;
DROP POLICY IF EXISTS student_answers_delete_admin ON public.student_answers;
CREATE POLICY student_answers_insert_admin ON public.student_answers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY student_answers_update_admin ON public.student_answers FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY student_answers_delete_admin ON public.student_answers FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Activity_logs ----------
DROP POLICY IF EXISTS activity_logs_insert_admin ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_update_admin ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_delete_admin ON public.activity_logs;
CREATE POLICY activity_logs_insert_admin ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY activity_logs_update_admin ON public.activity_logs FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY activity_logs_delete_admin ON public.activity_logs FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Exam_risk_logs (admin views all; API uses service role) ----------
ALTER TABLE public.exam_risk_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_risk_logs_select_admin ON public.exam_risk_logs;
CREATE POLICY exam_risk_logs_select_admin ON public.exam_risk_logs FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS exam_risk_logs_insert_service ON public.exam_risk_logs;
CREATE POLICY exam_risk_logs_insert_service ON public.exam_risk_logs FOR INSERT TO service_role WITH CHECK (true);

-- ---------- Audit_logs ----------
DROP POLICY IF EXISTS audit_logs_insert_admin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_update_admin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_delete_admin ON public.audit_logs;
CREATE POLICY audit_logs_insert_admin ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY audit_logs_update_admin ON public.audit_logs FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY audit_logs_delete_admin ON public.audit_logs FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- Views: security invoker so base table RLS applies (PostgreSQL 15+) ----------
ALTER VIEW public.active_exam_sessions_view SET (security_invoker = on);
ALTER VIEW public.exam_session_progress_view SET (security_invoker = on);
ALTER VIEW public.student_aggregate_results_view SET (security_invoker = on);
ALTER VIEW public.student_exam_results_view SET (security_invoker = on);
