-- 1. Create grades table first (no foreign keys)
CREATE TABLE IF NOT EXISTS public.grades (
  id SERIAL NOT NULL,
  grade_name TEXT NOT NULL,
  description TEXT NULL,
  grade_subjects TEXT[] NULL,
  CONSTRAINT grades_pkey PRIMARY KEY (id),
  CONSTRAINT grades_grade_name_key UNIQUE (grade_name)
) TABLESPACE pg_default;

-- 2. Create subjects table (no foreign keys)
CREATE TABLE IF NOT EXISTS public.subjects (
  id SERIAL NOT NULL,
  subject_name TEXT NOT NULL,
  description TEXT NULL,
  stream TEXT NULL,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_subject_name_key UNIQUE (subject_name),
  CONSTRAINT subjects_stream_check CHECK (
    (
      (stream IS NULL)
      OR (
        stream = ANY (
          ARRAY['Natural'::text, 'Social'::text, 'Common'::text]
        )
      )
    )
  )
) TABLESPACE pg_default;

-- 3. Create students table (depends on grades)
CREATE TABLE IF NOT EXISTS public.students (
  id SERIAL NOT NULL,
  name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  grandfather_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  student_id TEXT NOT NULL,
  grade_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  email TEXT NULL,
  stream TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_email_key UNIQUE (email),
  CONSTRAINT students_student_id_key UNIQUE (student_id),
  CONSTRAINT students_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT students_gender_check CHECK (
    (
      gender = ANY (
        ARRAY['male'::text, 'female'::text, 'other'::text]
      )
    )
  )
) TABLESPACE pg_default;

-- 4. Create teacher table (depends on grades and subjects)
CREATE TABLE IF NOT EXISTS public.teacher (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NULL,
  grade_id INTEGER NULL,
  subject_id INTEGER NULL,
  section TEXT NULL,
  password TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  stream TEXT NULL,
  CONSTRAINT teacher_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_email_key UNIQUE (email),
  CONSTRAINT teacher_username_key UNIQUE (username),
  CONSTRAINT teacher_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT teacher_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT teacher_stream_check CHECK (
    (
      (stream IS NULL)
      OR (
        stream = ANY (ARRAY['Natural'::text, 'Social'::text])
      )
    )
  )
) TABLESPACE pg_default;

-- 5. Create admin table (depends on teacher and auth.users)
-- Note: auth.users is typically from Supabase auth extension
CREATE TABLE IF NOT EXISTS public.admin (
  id UUID NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NULL,
  CONSTRAINT admin_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_key UNIQUE (email),
  CONSTRAINT admin_username_key UNIQUE (username),
  CONSTRAINT admin_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin(id) ON DELETE SET NULL
  -- CONSTRAINT admin_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
  -- Note: auth.users reference commented out - uncomment if auth schema exists
) TABLESPACE pg_default;

-- 6. Create exams table (depends on teacher, grades, subjects)
create table public.exams (
  id serial not null,
  exam_code text not null,
  title text not null,
  description text null,
  subject_id integer not null,
  grade_id integer not null,
  section text not null,
  exam_date date not null,
  duration integer null,
  total_marks integer not null,
  fullscreen_required boolean null default false,
  questions_shuffled boolean null default true,
  options_shuffled boolean null default true,
  created_by uuid null,
  image_url text null,
  exam_active boolean null default true,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  show_results boolean null default true,
  constraint exams_pkey primary key (id),
  constraint exams_exam_code_key unique (exam_code),
  constraint exams_created_by_fkey foreign KEY (created_by) references teacher (id),
  constraint exams_grade_id_fkey foreign KEY (grade_id) references grades (id),
  constraint exams_subject_id_fkey foreign KEY (subject_id) references subjects (id)
) TABLESPACE pg_default;

-- 7. Create questions table (depends on exams)
CREATE TABLE IF NOT EXISTS public.questions (
  id SERIAL NOT NULL,
  exam_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  options JSONB NULL,
  correct_option_id INTEGER NULL,
  correct_answer_text TEXT NULL,
  image_url TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
  CONSTRAINT questions_question_type_check CHECK (
    (
      question_type = ANY (
        ARRAY['multiple_choice'::text, 'true_false'::text]
      )
    )
  )
) TABLESPACE pg_default;

-- 8. Create exam_sessions table (depends on exams, students, teacher)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL,
  exam_id INTEGER NOT NULL,
  teacher_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'::text,
  started_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP WITH TIME ZONE NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  time_remaining INTEGER NULL,
  score INTEGER NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exam_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_status_check CHECK (
    (
      status = ANY (
        ARRAY[
          'in_progress'::text,
          'paused'::text,
          'submitted'::text,
          'inactive'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- 9. Create assign_exams table (depends on exams, teacher, students, grades)
CREATE TABLE IF NOT EXISTS public.assign_exams (
  id SERIAL NOT NULL,
  exam_id INTEGER NOT NULL,
  teacher_id UUID NOT NULL,
  student_id INTEGER NOT NULL,
  grade_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID NOT NULL,
  CONSTRAINT assign_exams_pkey PRIMARY KEY (id),
  CONSTRAINT unique_exam_student_assignment UNIQUE (exam_id, student_id),
  CONSTRAINT assign_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.teacher(id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT assign_exams_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 10. Create results table (depends on exams, students, teacher)
CREATE TABLE IF NOT EXISTS public.results (
  id SERIAL NOT NULL,
  exam_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  total_marks_obtained INTEGER NULL DEFAULT 0,
  grade TEXT NULL,
  comments TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  submission_time TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  teacher_id UUID NULL,
  CONSTRAINT results_pkey PRIMARY KEY (id),
  CONSTRAINT unique_exam_student UNIQUE (exam_id, student_id),
  CONSTRAINT results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
  CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT results_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- 11. Create student_answers table (depends on exam_sessions, questions)
CREATE TABLE IF NOT EXISTS public.student_answers (
  id SERIAL NOT NULL,
  session_id UUID NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option_id INTEGER NULL,
  answer_text TEXT NULL,
  is_flagged BOOLEAN NULL DEFAULT false,
  is_correct BOOLEAN NULL,
  answered_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT student_answers_pkey PRIMARY KEY (id),
  CONSTRAINT unique_session_question UNIQUE (session_id, question_id),
  CONSTRAINT student_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE,
  CONSTRAINT student_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 12. Create grade_sections table (depends on grades)
CREATE TABLE IF NOT EXISTS public.grade_sections (
  id SERIAL NOT NULL,
  grade_id INTEGER NOT NULL,
  section_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT grade_sections_pkey PRIMARY KEY (id),
  CONSTRAINT grade_sections_unique UNIQUE (grade_id, section_name),
  CONSTRAINT grade_sections_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 13. Create grade_subjects table (depends on grades and subjects)
CREATE TABLE IF NOT EXISTS public.grade_subjects (
  id SERIAL NOT NULL,
  grade_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT grade_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT grade_subjects_unique UNIQUE (grade_id, subject_id),
  CONSTRAINT grade_subjects_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id) ON DELETE CASCADE,
  CONSTRAINT grade_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Now create indexes (after all tables are created)
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions USING btree (exam_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions USING btree (student_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions USING btree (exam_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON public.exam_sessions USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_exam_sessions_teacher_id ON public.exam_sessions USING btree (teacher_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_exam_sessions_last_activity ON public.exam_sessions USING btree (last_activity_at) TABLESPACE pg_default;
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_active_session ON public.exam_sessions USING btree (student_id) TABLESPACE pg_default
WHERE (status = 'in_progress'::text);

CREATE INDEX IF NOT EXISTS idx_assign_exams_teacher_student ON public.assign_exams USING btree (teacher_id, student_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_assign_exams_assigned_by ON public.assign_exams USING btree (assigned_by) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_results_exam_id ON public.results USING btree (exam_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_results_student_id ON public.results USING btree (student_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_results_teacher_id ON public.results USING btree (teacher_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_results_created_at ON public.results USING btree (created_at) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_student_answers_session_id ON public.student_answers USING btree (session_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id ON public.student_answers USING btree (question_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_student_answers_is_correct ON public.student_answers USING btree (is_correct) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_grade_sections_grade_id ON public.grade_sections USING btree (grade_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_grade_subjects_grade_id ON public.grade_subjects USING btree (grade_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_grade_subjects_subject_id ON public.grade_subjects USING btree (subject_id) TABLESPACE pg_default;

-- Create views
CREATE OR REPLACE VIEW public.exam_session_progress_view AS
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
  (
    SELECT
      COUNT(*) AS count
    FROM
      student_answers sa
    WHERE
      sa.session_id = es.id
      AND sa.is_correct = TRUE
  ) AS correct_answers,
  (
    SELECT
      COUNT(*) AS count
    FROM
      student_answers sa
    WHERE
      sa.session_id = es.id
  ) AS questions_answered,
  (
    SELECT
      COUNT(*) AS count
    FROM
      questions q
    WHERE
      q.exam_id = e.id
  ) AS total_questions,
  e.total_marks AS possible_marks,
  EXTRACT(
    EPOCH
    FROM
      CURRENT_TIMESTAMP - es.last_activity_at
  ) AS seconds_since_activity
FROM
  exam_sessions es
  JOIN students s ON s.id = es.student_id
  JOIN exams e ON e.id = es.exam_id
  JOIN grades g ON g.id = s.grade_id;

CREATE OR REPLACE VIEW public.student_aggregate_results_view AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.student_id AS student_number,
  s.grade_id,
  s.section,
  g.grade_name,
  COUNT(DISTINCT r.exam_id) AS total_exams,
  SUM(r.total_marks_obtained) AS total_marks_obtained,
  SUM(e.total_marks) AS total_possible_marks,
  ROUND(
    SUM(r.total_marks_obtained)::NUMERIC / NULLIF(SUM(e.total_marks), 0)::NUMERIC * 100::NUMERIC,
    2
  ) AS overall_percentage,
  ROUND(AVG(r.total_marks_obtained), 2) AS average_score,
  MIN(r.total_marks_obtained) AS min_score,
  MAX(r.total_marks_obtained) AS max_score,
  MAX(r.submission_time) AS last_exam_date
FROM
  students s
  JOIN grades g ON g.id = s.grade_id
  LEFT JOIN results r ON r.student_id = s.id
  LEFT JOIN exams e ON e.id = r.exam_id
GROUP BY
  s.id,
  s.name,
  s.student_id,
  s.grade_id,
  s.section,
  g.grade_name
ORDER BY
  s.name;

CREATE OR REPLACE VIEW public.student_exam_results_view AS
SELECT
  r.id AS result_id,
  r.exam_id,
  e.title AS exam_title,
  e.exam_code,
  e.exam_date,
  e.total_marks AS exam_total_marks,
  e.created_by AS teacher_id,
  r.total_marks_obtained AS score_obtained,
  ROUND(
    r.total_marks_obtained::NUMERIC / NULLIF(e.total_marks, 0)::NUMERIC * 100::NUMERIC,
    2
  ) AS percentage,
  CASE
    WHEN (
      r.total_marks_obtained::NUMERIC / NULLIF(e.total_marks, 0)::NUMERIC
    ) >= 0.9 THEN 'A'::text
    WHEN (
      r.total_marks_obtained::NUMERIC / NULLIF(e.total_marks, 0)::NUMERIC
    ) >= 0.8 THEN 'B'::text
    WHEN (
      r.total_marks_obtained::NUMERIC / NULLIF(e.total_marks, 0)::NUMERIC
    ) >= 0.7 THEN 'C'::text
    WHEN (
      r.total_marks_obtained::NUMERIC / NULLIF(e.total_marks, 0)::NUMERIC
    ) >= 0.6 THEN 'D'::text
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
FROM
  results r
  JOIN exams e ON e.id = r.exam_id
  JOIN students s ON s.id = r.student_id
  JOIN grades g ON g.id = s.grade_id
ORDER BY
  r.created_at DESC;

-- Note: Triggers require functions to be created first
-- You'll need to create these functions separately:
-- 1. mark_answer()
-- 2. update_last_activity()


-- Single policy that allows all authenticated operations
CREATE POLICY "Enable all for authenticated users" ON storage.objects
FOR ALL USING (bucket_id = 'exam_images')
WITH CHECK (bucket_id = 'exam_images');