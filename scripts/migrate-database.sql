-- =============================================================================
-- Database Migration: Drop and Recreate All Tables
-- Run this in Supabase SQL Editor or via psql
-- WARNING: This will DESTROY all existing data. Use only for fresh setup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DROP VIEWS (must drop before tables they depend on)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.student_exam_results_view CASCADE;
DROP VIEW IF EXISTS public.student_aggregate_results_view CASCADE;
DROP VIEW IF EXISTS public.exam_session_progress_view CASCADE;
DROP VIEW IF EXISTS public.active_exam_sessions_view CASCADE;

-- -----------------------------------------------------------------------------
-- 2. DROP TABLES (CASCADE handles foreign key dependencies)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.assign_exams CASCADE;
DROP TABLE IF EXISTS public.exam_risk_logs CASCADE;
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.session_security CASCADE;
DROP TABLE IF EXISTS public.student_answers CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.grade_sections CASCADE;
DROP TABLE IF EXISTS public.grade_subjects CASCADE;
DROP TABLE IF EXISTS public.exam_sessions CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.teacher CASCADE;
DROP TABLE IF EXISTS public.admin_page_permissions CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.admin CASCADE;
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;

-- -----------------------------------------------------------------------------
-- 3. CREATE TABLES (in dependency order)
-- -----------------------------------------------------------------------------

-- Base tables (no foreign keys)
CREATE TABLE public.grades (
  id serial NOT NULL,
  grade_name text NOT NULL,
  description text NULL,
  grade_subjects text[] NULL,
  has_stream boolean NOT NULL DEFAULT false,
  CONSTRAINT grades_pkey PRIMARY KEY (id),
  CONSTRAINT grades_grade_name_key UNIQUE (grade_name)
) TABLESPACE pg_default;

CREATE TABLE public.subjects (
  id serial NOT NULL,
  subject_name text NOT NULL,
  description text NULL,
  stream text NULL,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_subject_name_key UNIQUE (subject_name),
  CONSTRAINT subjects_stream_check CHECK (
    (stream IS NULL) OR (stream = ANY (ARRAY['Natural'::text, 'Social'::text, 'Common'::text]))
  )
) TABLESPACE pg_default;

CREATE TABLE public.system_settings (
  id integer NOT NULL DEFAULT 1,
  max_risk_before_submit integer NOT NULL DEFAULT 7,
  max_time_extension_minutes integer NOT NULL DEFAULT 30,
  -- Feature flags + student visibility controls used across the app
  enable_results_archive boolean NOT NULL DEFAULT false,
  enable_student_results_portal boolean NOT NULL DEFAULT false,
  enable_student_teacher_chat boolean NOT NULL DEFAULT false,
  enable_realtime_features boolean NOT NULL DEFAULT false,
  student_current_results_mode text NOT NULL DEFAULT 'semester_1',
  current_academic_year integer NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_settings_pkey PRIMARY KEY (id),
  CONSTRAINT system_settings_single_row CHECK ((id = 1))
) TABLESPACE pg_default;

CREATE TABLE public.admin (
  id uuid NOT NULL,
  username text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid NULL,
  role text NOT NULL DEFAULT 'super_admin'::text,
  CONSTRAINT admin_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_key UNIQUE (email),
  CONSTRAINT admin_username_key UNIQUE (username),
  CONSTRAINT admin_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE TABLE public.admin_page_permissions (
  id serial NOT NULL,
  role text NOT NULL,
  page_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_page_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_page_permissions_unique UNIQUE (role, page_key),
  CONSTRAINT admin_page_permissions_role_check CHECK (
    role = ANY (ARRAY['super_admin'::text, 'admin'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id text NULL,
  action text NOT NULL,
  resource_type text NULL,
  resource_id text NULL,
  details jsonb NULL,
  ip_address text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_type_check CHECK (
    actor_type = ANY (ARRAY['admin'::text, 'teacher'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.teacher (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text NULL,
  grade_id integer NULL,
  subject_id integer NULL,
  section text NULL,
  password text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  stream text NULL,
  CONSTRAINT teacher_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_email_key UNIQUE (email),
  CONSTRAINT teacher_username_key UNIQUE (username),
  CONSTRAINT teacher_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id),
  CONSTRAINT teacher_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects (id),
  CONSTRAINT teacher_stream_check CHECK (
    (stream IS NULL) OR (stream = ANY (ARRAY['Natural'::text, 'Social'::text]))
  )
) TABLESPACE pg_default;

CREATE TABLE public.students (
  id serial NOT NULL,
  name text NOT NULL,
  father_name text NOT NULL,
  grandfather_name text NOT NULL,
  gender text NOT NULL,
  student_id text NOT NULL,
  grade_id integer NOT NULL,
  section text NOT NULL,
  email text NULL,
  stream text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  date_of_birth date NULL,
  address text NULL,
  phone text NULL,
  parent_name text NULL,
  parent_phone text NULL,
  photo_url text NULL,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_email_key UNIQUE (email),
  CONSTRAINT students_student_id_key UNIQUE (student_id),
  CONSTRAINT students_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id),
  CONSTRAINT students_gender_check CHECK (
    gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.exams (
  id serial NOT NULL,
  exam_code text NOT NULL,
  title text NOT NULL,
  description text NULL,
  subject_id integer NOT NULL,
  grade_id integer NOT NULL,
  section text NOT NULL,
  exam_date date NOT NULL,
  duration integer NULL,
  total_marks integer NOT NULL,
  fullscreen_required boolean NULL DEFAULT false,
  questions_shuffled boolean NULL DEFAULT true,
  options_shuffled boolean NULL DEFAULT true,
  created_by uuid NULL,
  image_url text NULL,
  exam_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  show_results boolean NULL DEFAULT true,
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_exam_code_key UNIQUE (exam_code),
  CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES teacher (id),
  CONSTRAINT exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id),
  CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects (id)
) TABLESPACE pg_default;

CREATE TABLE public.exam_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  teacher_id uuid NULL,
  status text NOT NULL DEFAULT 'in_progress'::text,
  started_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at timestamptz NULL,
  last_activity_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  time_remaining integer NULL,
  score integer NULL DEFAULT 0,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  security_token text NULL,
  last_device_fingerprint text NULL,
  device_takeover_count integer NULL DEFAULT 0,
  last_takeover_time timestamptz NULL,
  risk_score integer NULL DEFAULT 0,
  extra_time_seconds integer NULL DEFAULT 0,
  end_time timestamptz NULL,
  risk_count integer NOT NULL DEFAULT 0,
  instruction_seen boolean NOT NULL DEFAULT false,
  fullscreen_exit_count integer NOT NULL DEFAULT 0,
  last_tab_switch_at timestamptz NULL,
  hidden_from_monitor boolean NOT NULL DEFAULT false,
  CONSTRAINT exam_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_sessions_security_token_key UNIQUE (security_token),
  CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teacher (id) ON DELETE SET NULL,
  CONSTRAINT exam_sessions_status_check CHECK (
    status = ANY (ARRAY['in_progress'::text, 'paused'::text, 'submitted'::text, 'inactive'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.questions (
  id serial NOT NULL,
  exam_id integer NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  marks integer NOT NULL DEFAULT 1,
  options jsonb NULL,
  correct_option_id integer NULL,
  correct_answer_text text NULL,
  image_url text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  metadata jsonb NULL,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT questions_question_type_check CHECK (
    question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'matching'::text, 'fill_blank'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.grade_sections (
  id serial NOT NULL,
  grade_id integer NOT NULL,
  section_name text NOT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  stream text NULL,
  CONSTRAINT grade_sections_pkey PRIMARY KEY (id),
  CONSTRAINT grade_sections_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id) ON DELETE CASCADE,
  CONSTRAINT grade_sections_stream_check CHECK (
    (stream IS NULL) OR (stream = ANY (ARRAY['Natural'::text, 'Social'::text]))
  )
) TABLESPACE pg_default;

CREATE TABLE public.grade_subjects (
  id serial NOT NULL,
  grade_id integer NOT NULL,
  subject_id integer NOT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  stream text NOT NULL DEFAULT 'Common'::text,
  CONSTRAINT grade_subjects_pkey PRIMARY KEY (id),
  -- Allow assigning the same subject to multiple streams for the same grade
  CONSTRAINT grade_subjects_unique UNIQUE (grade_id, subject_id, stream),
  CONSTRAINT grade_subjects_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id) ON DELETE CASCADE,
  CONSTRAINT grade_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT grade_subjects_stream_check CHECK (
    stream = ANY (ARRAY['Natural'::text, 'Social'::text, 'Common'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_event_type_check CHECK (
    event_type = ANY (ARRAY['tab_switch'::text, 'fullscreen_exit'::text, 'device_change'::text, 'heartbeat_fail'::text, 'disconnect'::text, 'reconnect'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.assign_exams (
  id serial NOT NULL,
  exam_id integer NOT NULL,
  teacher_id uuid NOT NULL,
  student_id integer NOT NULL,
  grade_id integer NOT NULL,
  section text NOT NULL,
  assigned_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by uuid NOT NULL,
  CONSTRAINT assign_exams_pkey PRIMARY KEY (id),
  CONSTRAINT unique_exam_student_assignment UNIQUE (exam_id, student_id),
  CONSTRAINT assign_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES teacher (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teacher (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE public.exam_risk_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  event_type text NOT NULL,
  timestamp timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  event_value text NULL,
  CONSTRAINT exam_risk_logs_pkey PRIMARY KEY (id),
  CONSTRAINT exam_risk_logs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT exam_risk_logs_event_type_check CHECK (
    event_type = ANY (ARRAY['tab_switch'::text, 'fullscreen_exit'::text, 'disconnect'::text, 'device_change'::text, 'risk_auto_submit'::text])
  )
) TABLESPACE pg_default;

CREATE TABLE public.results (
  id serial NOT NULL,
  exam_id integer NOT NULL,
  student_id integer NOT NULL,
  total_marks_obtained integer NULL DEFAULT 0,
  comments text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  submission_time timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  teacher_id uuid NULL,
  CONSTRAINT results_pkey PRIMARY KEY (id),
  CONSTRAINT unique_exam_student UNIQUE (exam_id, student_id),
  CONSTRAINT results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT results_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teacher (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE TABLE public.session_security (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  device_fingerprint text NOT NULL,
  ip_address text NULL,
  user_agent text NULL,
  login_time timestamptz NULL DEFAULT now(),
  last_verified timestamptz NULL DEFAULT now(),
  is_active boolean NULL DEFAULT true,
  token text NOT NULL,
  CONSTRAINT session_security_pkey PRIMARY KEY (id),
  CONSTRAINT session_security_session_id_device_fingerprint_key UNIQUE (session_id, device_fingerprint),
  CONSTRAINT session_security_token_key UNIQUE (token),
  CONSTRAINT session_security_session_id_fkey FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT session_security_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE public.student_answers (
  id serial NOT NULL,
  session_id uuid NOT NULL,
  question_id integer NOT NULL,
  selected_option_id integer NULL,
  answer_text text NULL,
  is_flagged boolean NULL DEFAULT false,
  is_correct boolean NULL,
  answered_at timestamptz NULL DEFAULT now(),
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT student_answers_pkey PRIMARY KEY (id),
  CONSTRAINT unique_session_question UNIQUE (session_id, question_id),
  CONSTRAINT student_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT student_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES exam_sessions (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- -----------------------------------------------------------------------------
-- 4. CREATE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON public.activity_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_student_id ON public.activity_logs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_exam_id ON public.activity_logs USING btree (exam_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.activity_logs USING btree (event_type);

CREATE INDEX IF NOT EXISTS idx_assign_exams_teacher_student ON public.assign_exams USING btree (teacher_id, student_id);
CREATE INDEX IF NOT EXISTS idx_assign_exams_assigned_by ON public.assign_exams USING btree (assigned_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs USING btree (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_session_id ON public.exam_risk_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_student_id ON public.exam_risk_logs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_risk_logs_timestamp ON public.exam_risk_logs USING btree (timestamp);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions USING btree (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON public.exam_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_teacher_id ON public.exam_sessions USING btree (teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_last_activity ON public.exam_sessions USING btree (last_activity_at);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_end_time ON public.exam_sessions USING btree (end_time);
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_exam_active_session ON public.exam_sessions USING btree (student_id, exam_id)
  WHERE (status = 'in_progress'::text);

CREATE INDEX IF NOT EXISTS idx_grade_sections_grade_id ON public.grade_sections USING btree (grade_id);
CREATE UNIQUE INDEX IF NOT EXISTS grade_sections_grade_name_stream_key ON public.grade_sections USING btree (grade_id, section_name, COALESCE(stream, ''::text));

CREATE INDEX IF NOT EXISTS idx_grade_subjects_grade_id ON public.grade_subjects USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_subjects_subject_id ON public.grade_subjects USING btree (subject_id);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions USING btree (exam_id);

CREATE INDEX IF NOT EXISTS idx_results_exam_id ON public.results USING btree (exam_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON public.results USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_results_teacher_id ON public.results USING btree (teacher_id);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON public.results USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_session_security_student ON public.session_security USING btree (student_id, is_active);
CREATE INDEX IF NOT EXISTS idx_session_security_fingerprint ON public.session_security USING btree (device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_student_answers_session_id ON public.student_answers USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id ON public.student_answers USING btree (question_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_is_correct ON public.student_answers USING btree (is_correct);

-- -----------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY (RLS) + POLICIES
-- -----------------------------------------------------------------------------

-- Helper functions (Supabase: requires auth schema / auth.uid())
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin a WHERE a.id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.admin_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT a.role FROM public.admin a WHERE a.id = auth.uid();
$$;

-- Prefer JWT role claim for cross-table authorization (avoids policy recursion on admin)
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.teacher t WHERE t.id = auth.uid());
$$;

-- Enable + force RLS on all tables
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assign_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_risk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_page_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assign_exams FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exam_risk_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exams FORCE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.grade_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.grades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_security FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.teacher FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings FORCE ROW LEVEL SECURITY;

-- ADMIN table policies
DROP POLICY IF EXISTS admin_self_select ON public.admin;
DROP POLICY IF EXISTS admin_self_update_profile ON public.admin;
DROP POLICY IF EXISTS admin_super_admin_all ON public.admin;

CREATE POLICY admin_self_select
ON public.admin
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY admin_self_update_profile
ON public.admin
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY admin_super_admin_select_all
ON public.admin
FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY admin_super_admin_insert
ON public.admin
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY admin_super_admin_update
ON public.admin
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY admin_super_admin_delete
ON public.admin
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ADMIN_PAGE_PERMISSIONS policies
CREATE POLICY admin_page_permissions_admin_read
ON public.admin_page_permissions
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY admin_page_permissions_super_admin_write
ON public.admin_page_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY admin_page_permissions_super_admin_update
ON public.admin_page_permissions
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY admin_page_permissions_super_admin_delete
ON public.admin_page_permissions
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- SYSTEM_SETTINGS policies
CREATE POLICY system_settings_admin_read
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY system_settings_super_admin_write
ON public.system_settings
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- AUDIT_LOGS policies
CREATE POLICY audit_logs_admin_read
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY audit_logs_admin_insert
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Lookup tables (grades/subjects/grade_sections/grade_subjects)
CREATE POLICY grades_read_admin_teacher
ON public.grades
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_teacher());

CREATE POLICY grades_admin_write
ON public.grades
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY subjects_read_admin_teacher
ON public.subjects
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_teacher());

CREATE POLICY subjects_admin_write
ON public.subjects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY grade_sections_read_admin_teacher
ON public.grade_sections
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_teacher());

CREATE POLICY grade_sections_admin_write
ON public.grade_sections
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY grade_subjects_read_admin_teacher
ON public.grade_subjects
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_teacher());

CREATE POLICY grade_subjects_admin_write
ON public.grade_subjects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- TEACHER table policies
CREATE POLICY teacher_admin_all
ON public.teacher
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY teacher_self_select
ON public.teacher
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- STUDENTS table policies (admin-only by default)
CREATE POLICY students_admin_all
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- EXAMS policies
CREATE POLICY exams_admin_all
ON public.exams
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY exams_teacher_select
ON public.exams
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assign_exams ae
      WHERE ae.exam_id = exams.id AND ae.teacher_id = auth.uid()
    )
  )
);

CREATE POLICY exams_teacher_write_own
ON public.exams
FOR INSERT
TO authenticated
WITH CHECK (public.is_teacher() AND created_by = auth.uid());

CREATE POLICY exams_teacher_update_own
ON public.exams
FOR UPDATE
TO authenticated
USING (public.is_teacher() AND created_by = auth.uid())
WITH CHECK (public.is_teacher() AND created_by = auth.uid());

CREATE POLICY exams_teacher_delete_own
ON public.exams
FOR DELETE
TO authenticated
USING (public.is_teacher() AND created_by = auth.uid());

-- QUESTIONS policies
CREATE POLICY questions_admin_all
ON public.questions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY questions_teacher_select
ON public.questions
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = questions.exam_id
    AND (
      e.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.assign_exams ae WHERE ae.exam_id = e.id AND ae.teacher_id = auth.uid())
    )
  )
);

CREATE POLICY questions_teacher_write_for_own_exam
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_teacher()
  AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid())
);

CREATE POLICY questions_teacher_update_for_own_exam
ON public.questions
FOR UPDATE
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid())
)
WITH CHECK (
  public.is_teacher()
  AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid())
);

CREATE POLICY questions_teacher_delete_for_own_exam
ON public.questions
FOR DELETE
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid())
);

-- ASSIGN_EXAMS policies
CREATE POLICY assign_exams_admin_all
ON public.assign_exams
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY assign_exams_teacher_read_own
ON public.assign_exams
FOR SELECT
TO authenticated
USING (public.is_teacher() AND teacher_id = auth.uid());

CREATE POLICY assign_exams_teacher_delete_own
ON public.assign_exams
FOR DELETE
TO authenticated
USING (public.is_teacher() AND teacher_id = auth.uid());

-- EXAM_SESSIONS policies
CREATE POLICY exam_sessions_admin_all
ON public.exam_sessions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY exam_sessions_teacher_select
ON public.exam_sessions
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_sessions.exam_id AND e.created_by = auth.uid())
  )
);

-- SESSION_SECURITY policies
CREATE POLICY session_security_admin_all
ON public.session_security
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY session_security_teacher_select
ON public.session_security
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.exam_sessions es
    JOIN public.exams e ON e.id = es.exam_id
    WHERE es.id = session_security.session_id
    AND (es.teacher_id = auth.uid() OR e.created_by = auth.uid())
  )
);

-- STUDENT_ANSWERS policies
CREATE POLICY student_answers_admin_all
ON public.student_answers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY student_answers_teacher_select
ON public.student_answers
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.exam_sessions es
    JOIN public.exams e ON e.id = es.exam_id
    WHERE es.id = student_answers.session_id
    AND (es.teacher_id = auth.uid() OR e.created_by = auth.uid())
  )
);

-- RESULTS policies
CREATE POLICY results_admin_all
ON public.results
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY results_teacher_select
ON public.results
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id = results.exam_id AND e.created_by = auth.uid())
  )
);

-- ACTIVITY_LOGS policies
CREATE POLICY activity_logs_admin_all
ON public.activity_logs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY activity_logs_teacher_select
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.exam_sessions es
    JOIN public.exams e ON e.id = es.exam_id
    WHERE es.id = activity_logs.session_id
    AND (es.teacher_id = auth.uid() OR e.created_by = auth.uid())
  )
);

-- EXAM_RISK_LOGS policies
CREATE POLICY exam_risk_logs_admin_all
ON public.exam_risk_logs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY exam_risk_logs_teacher_select
ON public.exam_risk_logs
FOR SELECT
TO authenticated
USING (
  public.is_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.exam_sessions es
    JOIN public.exams e ON e.id = es.exam_id
    WHERE es.id = exam_risk_logs.session_id
    AND (es.teacher_id = auth.uid() OR e.created_by = auth.uid())
  )
);

-- -----------------------------------------------------------------------------
-- 6. PRIVILEGES (required in addition to RLS)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Do not grant table access to anon. Authenticated access is filtered by RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. CREATE VIEWS
-- -----------------------------------------------------------------------------
CREATE VIEW public.active_exam_sessions_view AS
SELECT
  es.id,
  es.student_id,
  es.exam_id,
  es.teacher_id,
  es.status,
  es.started_at,
  es.submitted_at,
  es.last_activity_at,
  es.time_remaining,
  es.score,
  es.created_at,
  es.updated_at,
  es.security_token,
  es.last_device_fingerprint,
  es.device_takeover_count,
  es.last_takeover_time,
  es.risk_score,
  es.extra_time_seconds,
  ss.device_fingerprint AS current_device_fingerprint,
  ss.is_active AS security_active,
  ss.last_verified,
  EXTRACT(epoch FROM now() - es.updated_at) AS seconds_since_update,
  EXTRACT(epoch FROM now() - ss.last_verified) AS seconds_since_verification
FROM exam_sessions es
LEFT JOIN session_security ss ON es.id = ss.session_id
WHERE es.status = 'in_progress'::text AND ss.is_active = true;

CREATE VIEW public.exam_session_progress_view AS
SELECT
  es.id AS session_id,
  s.id AS student_id,
  s.name AS student_name,
  s.student_id AS student_number,
  g.grade_name,
  s.section,
  e.title AS exam_title,
  e.id AS exam_id,
  e.created_by AS teacher_id,
  es.status,
  es.time_remaining,
  es.score AS current_score,
  es.started_at,
  es.last_activity_at,
  (SELECT count(*) FROM student_answers sa WHERE sa.session_id = es.id AND sa.is_correct = true) AS correct_answers,
  (SELECT count(*) FROM student_answers sa WHERE sa.session_id = es.id) AS questions_answered,
  (SELECT count(*) FROM questions q WHERE q.exam_id = e.id) AS total_questions,
  e.total_marks AS possible_marks,
  EXTRACT(epoch FROM CURRENT_TIMESTAMP - es.last_activity_at) AS seconds_since_activity
FROM exam_sessions es
JOIN students s ON s.id = es.student_id
JOIN exams e ON e.id = es.exam_id
JOIN grades g ON g.id = s.grade_id;

CREATE VIEW public.student_aggregate_results_view AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.student_id AS student_number,
  s.grade_id,
  s.section,
  g.grade_name,
  count(DISTINCT r.exam_id) AS total_exams,
  sum(r.total_marks_obtained) AS total_marks_obtained,
  sum(e.total_marks) AS total_possible_marks,
  round(sum(r.total_marks_obtained)::numeric / NULLIF(sum(e.total_marks), 0)::numeric * 100::numeric, 2) AS overall_percentage,
  round(avg(r.total_marks_obtained), 2) AS average_score,
  min(r.total_marks_obtained) AS min_score,
  max(r.total_marks_obtained) AS max_score,
  max(r.submission_time) AS last_exam_date
FROM students s
JOIN grades g ON g.id = s.grade_id
LEFT JOIN results r ON r.student_id = s.id
LEFT JOIN exams e ON e.id = r.exam_id
GROUP BY s.id, s.name, s.student_id, s.grade_id, s.section, g.grade_name
ORDER BY s.name;

CREATE VIEW public.student_exam_results_view AS
SELECT
  r.id AS result_id,
  r.exam_id,
  e.title AS exam_title,
  e.exam_code,
  e.exam_date,
  e.total_marks AS exam_total_marks,
  e.created_by AS teacher_id,
  r.total_marks_obtained AS score_obtained,
  round(r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric * 100::numeric, 2) AS percentage,
  CASE
    WHEN (r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric) >= 0.9 THEN 'A'::text
    WHEN (r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric) >= 0.8 THEN 'B'::text
    WHEN (r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric) >= 0.7 THEN 'C'::text
    WHEN (r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric) >= 0.6 THEN 'D'::text
    ELSE 'F'::text
  END AS grade,
  r.comments,
  r.submission_time,
  r.created_at AS result_date,
  r.updated_at,
  s.id AS student_id,
  s.name AS student_name,
  s.student_id AS student_number,
  s.grade_id,
  s.section,
  g.grade_name
FROM results r
JOIN exams e ON e.id = r.exam_id
JOIN students s ON s.id = r.student_id
JOIN grades g ON g.id = s.grade_id
ORDER BY r.created_at DESC;

-- -----------------------------------------------------------------------------
-- Migration complete
-- -----------------------------------------------------------------------------
