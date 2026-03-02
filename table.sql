-- =============================================================================
-- Online Exam Platform – Full schema (replace previous version)
-- Run this script on a fresh database or to reset. Includes RLS.
-- Service role bypasses RLS; use it in API routes for admin/teacher writes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: DROP EXISTING OBJECTS (reverse dependency order)
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.active_exam_sessions_view;
DROP VIEW IF EXISTS public.exam_session_progress_view;
DROP VIEW IF EXISTS public.student_aggregate_results_view;
DROP VIEW IF EXISTS public.student_exam_results_view;

DROP TABLE IF EXISTS public.activity_logs;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.student_answers;
DROP TABLE IF EXISTS public.session_security;
DROP TABLE IF EXISTS public.results;
DROP TABLE IF EXISTS public.exam_sessions;
DROP TABLE IF EXISTS public.questions;
DROP TABLE IF EXISTS public.assign_exams;
DROP TABLE IF EXISTS public.exams;
DROP TABLE IF EXISTS public.grade_sections;
DROP TABLE IF EXISTS public.grade_subjects;
DROP TABLE IF EXISTS public.students;
DROP TABLE IF EXISTS public.teacher;
DROP TABLE IF EXISTS public.grades;
DROP TABLE IF EXISTS public.subjects;
DROP TABLE IF EXISTS public.admin;

-- -----------------------------------------------------------------------------
-- PART 2: TABLES (creation order respects foreign keys)
-- -----------------------------------------------------------------------------

CREATE TABLE public.admin (
  id uuid NOT NULL,
  username text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid NULL,
  CONSTRAINT admin_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_key UNIQUE (email),
  CONSTRAINT admin_username_key UNIQUE (username),
  CONSTRAINT admin_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin (id) ON DELETE SET NULL
);

CREATE TABLE public.grades (
  id serial NOT NULL,
  grade_name text NOT NULL,
  description text NULL,
  grade_subjects text[] NULL,
  CONSTRAINT grades_pkey PRIMARY KEY (id),
  CONSTRAINT grades_grade_name_key UNIQUE (grade_name)
);

CREATE TABLE public.subjects (
  id serial NOT NULL,
  subject_name text NOT NULL,
  description text NULL,
  stream text NULL,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_subject_name_key UNIQUE (subject_name),
  CONSTRAINT subjects_stream_check CHECK (
    stream IS NULL OR stream = ANY (ARRAY['Natural'::text, 'Social'::text, 'Common'::text])
  )
);

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
  CONSTRAINT teacher_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id),
  CONSTRAINT teacher_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects (id),
  CONSTRAINT teacher_stream_check CHECK (stream IS NULL OR stream = ANY (ARRAY['Natural'::text, 'Social'::text]))
);

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
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_email_key UNIQUE (email),
  CONSTRAINT students_student_id_key UNIQUE (student_id),
  CONSTRAINT students_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id),
  CONSTRAINT students_gender_check CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))
);

CREATE TABLE public.grade_sections (
  id serial NOT NULL,
  grade_id integer NOT NULL,
  section_name text NOT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT grade_sections_pkey PRIMARY KEY (id),
  CONSTRAINT grade_sections_unique UNIQUE (grade_id, section_name),
  CONSTRAINT grade_sections_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id) ON DELETE CASCADE
);

CREATE TABLE public.grade_subjects (
  id serial NOT NULL,
  grade_id integer NOT NULL,
  subject_id integer NOT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT grade_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT grade_subjects_unique UNIQUE (grade_id, subject_id),
  CONSTRAINT grade_subjects_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id) ON DELETE CASCADE,
  CONSTRAINT grade_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects (id) ON DELETE CASCADE
);

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
  CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.teacher (id),
  CONSTRAINT exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id),
  CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects (id)
);

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
  CONSTRAINT assign_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.teacher (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher (id) ON DELETE CASCADE
);

CREATE TABLE public.exam_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  teacher_id uuid NULL,
  status text NOT NULL DEFAULT 'in_progress',
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
  CONSTRAINT exam_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_sessions_security_token_key UNIQUE (security_token),
  CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher (id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_status_check CHECK (
    status = ANY (ARRAY['in_progress'::text, 'paused'::text, 'submitted'::text, 'inactive'::text])
  )
);

CREATE INDEX idx_exam_sessions_student_id ON public.exam_sessions (student_id);
CREATE INDEX idx_exam_sessions_exam_id ON public.exam_sessions (exam_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions (status);
CREATE INDEX idx_exam_sessions_teacher_id ON public.exam_sessions (teacher_id);
CREATE INDEX idx_exam_sessions_last_activity ON public.exam_sessions (last_activity_at);
CREATE UNIQUE INDEX unique_student_active_session ON public.exam_sessions (student_id) WHERE status = 'in_progress';

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
  CONSTRAINT session_security_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT session_security_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE
);

CREATE INDEX idx_session_security_student ON public.session_security (student_id, is_active);
CREATE INDEX idx_session_security_fingerprint ON public.session_security (device_fingerprint);
CREATE INDEX idx_session_security_token ON public.session_security (token);

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
  CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT questions_question_type_check CHECK (
    question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'matching'::text, 'fill_blank'::text])
  )
);

CREATE INDEX idx_questions_exam_id ON public.questions (exam_id);

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
  CONSTRAINT results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT results_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher (id) ON DELETE SET NULL
);

CREATE INDEX idx_results_exam_id ON public.results (exam_id);
CREATE INDEX idx_results_student_id ON public.results (student_id);
CREATE INDEX idx_results_teacher_id ON public.results (teacher_id);
CREATE INDEX idx_results_created_at ON public.results (created_at);

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
  CONSTRAINT student_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions (id) ON DELETE CASCADE,
  CONSTRAINT student_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions (id) ON DELETE CASCADE
);

CREATE INDEX idx_student_answers_session_id ON public.student_answers (session_id);
CREATE INDEX idx_student_answers_question_id ON public.student_answers (question_id);
CREATE INDEX idx_student_answers_is_correct ON public.student_answers (is_correct);

-- Activity logs: student exam security events (tab switch, fullscreen exit, device change, heartbeat fail, disconnect)
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id integer NOT NULL,
  exam_id integer NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams (id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_event_type_check CHECK (
    event_type = ANY (ARRAY['tab_switch'::text, 'fullscreen_exit'::text, 'device_change'::text, 'heartbeat_fail'::text, 'disconnect'::text, 'reconnect'::text])
  )
);

CREATE INDEX idx_activity_logs_session_id ON public.activity_logs (session_id);
CREATE INDEX idx_activity_logs_student_id ON public.activity_logs (student_id);
CREATE INDEX idx_activity_logs_exam_id ON public.activity_logs (exam_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at);
CREATE INDEX idx_activity_logs_event_type ON public.activity_logs (event_type);

-- Audit logs: admin/teacher actions for accountability
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
  CONSTRAINT audit_logs_actor_type_check CHECK (actor_type = ANY (ARRAY['admin'::text, 'teacher'::text]))
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_type, actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

CREATE INDEX idx_assign_exams_teacher_student ON public.assign_exams (teacher_id, student_id);
CREATE INDEX idx_assign_exams_assigned_by ON public.assign_exams (assigned_by);
CREATE INDEX idx_grade_sections_grade_id ON public.grade_sections (grade_id);
CREATE INDEX idx_grade_subjects_grade_id ON public.grade_subjects (grade_id);
CREATE INDEX idx_grade_subjects_subject_id ON public.grade_subjects (subject_id);

-- -----------------------------------------------------------------------------
-- PART 3: VIEWS
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
FROM public.exam_sessions es
LEFT JOIN public.session_security ss ON es.id = ss.session_id
WHERE es.status = 'in_progress' AND ss.is_active = true;

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
  (SELECT count(*) FROM public.student_answers sa WHERE sa.session_id = es.id AND sa.is_correct = true) AS correct_answers,
  (SELECT count(*) FROM public.student_answers sa WHERE sa.session_id = es.id) AS questions_answered,
  (SELECT count(*) FROM public.questions q WHERE q.exam_id = e.id) AS total_questions,
  e.total_marks AS possible_marks,
  EXTRACT(epoch FROM CURRENT_TIMESTAMP - es.last_activity_at) AS seconds_since_activity
FROM public.exam_sessions es
JOIN public.students s ON s.id = es.student_id
JOIN public.exams e ON e.id = es.exam_id
JOIN public.grades g ON g.id = s.grade_id;

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
  round(sum(r.total_marks_obtained)::numeric / NULLIF(sum(e.total_marks), 0)::numeric * 100, 2) AS overall_percentage,
  round(avg(r.total_marks_obtained), 2) AS average_score,
  min(r.total_marks_obtained) AS min_score,
  max(r.total_marks_obtained) AS max_score,
  max(r.submission_time) AS last_exam_date
FROM public.students s
JOIN public.grades g ON g.id = s.grade_id
LEFT JOIN public.results r ON r.student_id = s.id
LEFT JOIN public.exams e ON e.id = r.exam_id
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
  round(r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric * 100, 2) AS percentage,
  CASE
    WHEN r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric >= 0.9 THEN 'A'
    WHEN r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric >= 0.8 THEN 'B'
    WHEN r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric >= 0.7 THEN 'C'
    WHEN r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric >= 0.6 THEN 'D'
    ELSE 'F'
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
FROM public.results r
JOIN public.exams e ON e.id = r.exam_id
JOIN public.students s ON s.id = r.student_id
JOIN public.grades g ON g.id = s.grade_id
ORDER BY r.created_at DESC;

-- Views: run with invoker's permissions so base table RLS applies (PostgreSQL 15+)
ALTER VIEW public.active_exam_sessions_view SET (security_invoker = on);
ALTER VIEW public.exam_session_progress_view SET (security_invoker = on);
ALTER VIEW public.student_aggregate_results_view SET (security_invoker = on);
ALTER VIEW public.student_exam_results_view SET (security_invoker = on);

-- -----------------------------------------------------------------------------
-- PART 4: ROW LEVEL SECURITY (RLS)
-- Service role key bypasses RLS. Use service role in API routes for admin
-- and for heartbeat/activity/audit writes. Client uses anon or authenticated.
-- -----------------------------------------------------------------------------

ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
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

-- Helper: true when current user is an admin (auth.uid() exists in admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin WHERE id = auth.uid());
$$;

-- Helper: total admin count (SECURITY DEFINER so RLS doesn't hide rows). Used to allow first-admin insert.
CREATE OR REPLACE FUNCTION public.admin_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.admin;
$$;

-- Helper: true when current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.teacher WHERE id = auth.uid());
$$;

-- Admin: only own row for SELECT; admin can INSERT/UPDATE (backup import, add admin).
-- Allow first-ever admin: INSERT when no admins exist yet (e.g. alphasecure signup).
CREATE POLICY admin_select_own ON public.admin
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY admin_insert_admin ON public.admin
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.admin_count() = 0);

CREATE POLICY admin_update_admin ON public.admin
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY admin_delete_admin ON public.admin
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Teacher: read own row; admins read all; admin can INSERT/UPDATE/DELETE (backup import)
CREATE POLICY teacher_select_own ON public.teacher
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY teacher_select_admin ON public.teacher
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY teacher_insert_admin ON public.teacher
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY teacher_update_admin ON public.teacher
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY teacher_delete_admin ON public.teacher
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Students: authenticated users can read (dashboard/teacher need this)
CREATE POLICY students_select_authenticated ON public.students
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY students_all_admin ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Grades, subjects, grade_sections, grade_subjects: read for authenticated
CREATE POLICY grades_select_authenticated ON public.grades
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY grades_all_admin ON public.grades
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY subjects_select_authenticated ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY subjects_all_admin ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY grade_sections_select_authenticated ON public.grade_sections
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY grade_sections_all_admin ON public.grade_sections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY grade_subjects_select_authenticated ON public.grade_subjects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY grade_subjects_all_admin ON public.grade_subjects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Exams: anon can read (exam code entry); teachers manage own; admin all
CREATE POLICY exams_select_anon ON public.exams
  FOR SELECT TO anon
  USING (true);

CREATE POLICY exams_select_authenticated ON public.exams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY exams_insert_teacher ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY exams_update_teacher ON public.exams
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY exams_all_admin ON public.exams
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Assign_exams: teacher and admin
CREATE POLICY assign_exams_select_authenticated ON public.assign_exams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY assign_exams_insert_teacher ON public.assign_exams
  FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid() OR public.is_admin());

CREATE POLICY assign_exams_all_admin ON public.assign_exams
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Exam_sessions: anon insert/select (start exam, resume); teacher read own; admin insert/update (backup import)
CREATE POLICY exam_sessions_select_anon ON public.exam_sessions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY exam_sessions_insert_anon ON public.exam_sessions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY exam_sessions_update_anon ON public.exam_sessions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY exam_sessions_insert_admin ON public.exam_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY exam_sessions_update_admin ON public.exam_sessions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY exam_sessions_select_teacher ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY exam_sessions_select_admin ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY exam_sessions_delete_admin ON public.exam_sessions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Session_security: anon can insert/select/update (exam flow); admin insert/update/delete (backup import)
CREATE POLICY session_security_select_anon ON public.session_security
  FOR SELECT TO anon
  USING (true);

CREATE POLICY session_security_insert_anon ON public.session_security
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY session_security_update_anon ON public.session_security
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY session_security_insert_admin ON public.session_security
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY session_security_update_admin ON public.session_security
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY session_security_delete_admin ON public.session_security
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY session_security_select_authenticated ON public.session_security
  FOR SELECT TO authenticated
  USING (true);

-- Questions: anon read (exam taking); teacher/admin manage via service role or policies
CREATE POLICY questions_select_anon ON public.questions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY questions_select_authenticated ON public.questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY questions_all_admin ON public.questions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Results: teacher read own; admin all; admin can insert/update any (backup import); teacher only own rows
CREATE POLICY results_select_teacher ON public.results
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY results_select_admin ON public.results
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY results_insert_admin ON public.results
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY results_insert_teacher ON public.results
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY results_update_admin ON public.results
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY results_update_teacher ON public.results
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY results_delete_admin ON public.results
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Student_answers: anon select/insert/update (exam flow); admin insert/update/delete (backup import)
CREATE POLICY student_answers_select_anon ON public.student_answers
  FOR SELECT TO anon
  USING (true);

CREATE POLICY student_answers_insert_anon ON public.student_answers
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY student_answers_update_anon ON public.student_answers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY student_answers_insert_admin ON public.student_answers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY student_answers_update_admin ON public.student_answers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY student_answers_delete_admin ON public.student_answers
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY student_answers_select_authenticated ON public.student_answers
  FOR SELECT TO authenticated
  USING (true);

-- Activity_logs: admin full CRUD (read, insert, update, delete for backup import and cleanup).
CREATE POLICY activity_logs_select_admin ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY activity_logs_insert_admin ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY activity_logs_update_admin ON public.activity_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY activity_logs_delete_admin ON public.activity_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Audit_logs: admin full CRUD (read, insert, update, delete for backup import and cleanup).
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY audit_logs_insert_admin ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY audit_logs_update_admin ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY audit_logs_delete_admin ON public.audit_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- END
-- -----------------------------------------------------------------------------
