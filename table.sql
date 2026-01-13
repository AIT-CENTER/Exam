create table public.admin (
  id uuid not null,
  username text not null,
  full_name text not null,
  email text not null,
  phone_number text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  constraint admin_pkey primary key (id),
  constraint admin_email_key unique (email),
  constraint admin_username_key unique (username),
  constraint admin_created_by_fkey foreign KEY (created_by) references admin (id) on delete set null
) TABLESPACE pg_default;


create table public.assign_exams (
  id serial not null,
  exam_id integer not null,
  teacher_id uuid not null,
  student_id integer not null,
  grade_id integer not null,
  section text not null,
  assigned_at timestamp with time zone null default CURRENT_TIMESTAMP,
  assigned_by uuid not null,
  constraint assign_exams_pkey primary key (id),
  constraint unique_exam_student_assignment unique (exam_id, student_id),
  constraint assign_exams_exam_id_fkey foreign KEY (exam_id) references exams (id) on delete CASCADE,
  constraint assign_exams_grade_id_fkey foreign KEY (grade_id) references grades (id) on delete CASCADE,
  constraint assign_exams_assigned_by_fkey foreign KEY (assigned_by) references teacher (id) on delete CASCADE,
  constraint assign_exams_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint assign_exams_teacher_id_fkey foreign KEY (teacher_id) references teacher (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_assign_exams_teacher_student on public.assign_exams using btree (teacher_id, student_id) TABLESPACE pg_default;

create index IF not exists idx_assign_exams_assigned_by on public.assign_exams using btree (assigned_by) TABLESPACE pg_default;


create table public.exam_sessions (
  id uuid not null default gen_random_uuid (),
  student_id integer not null,
  exam_id integer not null,
  teacher_id uuid null,
  status text not null default 'in_progress'::text,
  started_at timestamp with time zone null default CURRENT_TIMESTAMP,
  submitted_at timestamp with time zone null,
  last_activity_at timestamp with time zone null default CURRENT_TIMESTAMP,
  time_remaining integer null,
  score integer null default 0,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  security_token text null,
  last_device_fingerprint text null,
  device_takeover_count integer null default 0,
  last_takeover_time timestamp with time zone null,
  constraint exam_sessions_pkey primary key (id),
  constraint exam_sessions_security_token_key unique (security_token),
  constraint exam_sessions_exam_id_fkey foreign KEY (exam_id) references exams (id) on delete CASCADE,
  constraint exam_sessions_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint exam_sessions_teacher_id_fkey foreign KEY (teacher_id) references teacher (id) on delete CASCADE,
  constraint exam_sessions_status_check check (
    (
      status = any (
        array[
          'in_progress'::text,
          'paused'::text,
          'submitted'::text,
          'inactive'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_exam_sessions_student_id on public.exam_sessions using btree (student_id) TABLESPACE pg_default;

create index IF not exists idx_exam_sessions_exam_id on public.exam_sessions using btree (exam_id) TABLESPACE pg_default;

create index IF not exists idx_exam_sessions_status on public.exam_sessions using btree (status) TABLESPACE pg_default;

create index IF not exists idx_exam_sessions_teacher_id on public.exam_sessions using btree (teacher_id) TABLESPACE pg_default;

create index IF not exists idx_exam_sessions_last_activity on public.exam_sessions using btree (last_activity_at) TABLESPACE pg_default;

create unique INDEX IF not exists unique_student_active_session on public.exam_sessions using btree (student_id) TABLESPACE pg_default
where
  (status = 'in_progress'::text);



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


create table public.grade_sections (
  id serial not null,
  grade_id integer not null,
  section_name text not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint grade_sections_pkey primary key (id),
  constraint grade_sections_unique unique (grade_id, section_name),
  constraint grade_sections_grade_id_fkey foreign KEY (grade_id) references grades (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_grade_sections_grade_id on public.grade_sections using btree (grade_id) TABLESPACE pg_default;


create table public.grade_subjects (
  id serial not null,
  grade_id integer not null,
  subject_id integer not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint grade_subjects_pkey primary key (id),
  constraint grade_subjects_unique unique (grade_id, subject_id),
  constraint grade_subjects_grade_id_fkey foreign KEY (grade_id) references grades (id) on delete CASCADE,
  constraint grade_subjects_subject_id_fkey foreign KEY (subject_id) references subjects (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_grade_subjects_grade_id on public.grade_subjects using btree (grade_id) TABLESPACE pg_default;

create index IF not exists idx_grade_subjects_subject_id on public.grade_subjects using btree (subject_id) TABLESPACE pg_default;


create table public.grades (
  id serial not null,
  grade_name text not null,
  description text null,
  grade_subjects text[] null,
  constraint grades_pkey primary key (id),
  constraint grades_grade_name_key unique (grade_name)
) TABLESPACE pg_default;


create table public.questions (
  id serial not null,
  exam_id integer not null,
  question_text text not null,
  question_type text not null,
  marks integer not null default 1,
  options jsonb null,
  correct_option_id integer null,
  correct_answer_text text null,
  image_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null,
  constraint questions_pkey primary key (id),
  constraint questions_exam_id_fkey foreign KEY (exam_id) references exams (id) on delete CASCADE,
  constraint questions_question_type_check check (
    (
      question_type = any (
        array[
          'multiple_choice'::text,
          'true_false'::text,
          'matching'::text,
          'fill_blank'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_questions_exam_id on public.questions using btree (exam_id) TABLESPACE pg_default;

create table public.results (
  id serial not null,
  exam_id integer not null,
  student_id integer not null,
  total_marks_obtained integer null default 0,
  comments text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  submission_time timestamp with time zone null default CURRENT_TIMESTAMP,
  teacher_id uuid null,
  constraint results_pkey primary key (id),
  constraint unique_exam_student unique (exam_id, student_id),
  constraint results_exam_id_fkey foreign KEY (exam_id) references exams (id) on delete CASCADE,
  constraint results_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint results_teacher_id_fkey foreign KEY (teacher_id) references teacher (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_results_exam_id on public.results using btree (exam_id) TABLESPACE pg_default;

create index IF not exists idx_results_student_id on public.results using btree (student_id) TABLESPACE pg_default;

create index IF not exists idx_results_teacher_id on public.results using btree (teacher_id) TABLESPACE pg_default;

create index IF not exists idx_results_created_at on public.results using btree (created_at) TABLESPACE pg_default;


create table public.session_security (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  student_id integer not null,
  device_fingerprint text not null,
  ip_address text null,
  user_agent text null,
  login_time timestamp with time zone null default now(),
  last_verified timestamp with time zone null default now(),
  is_active boolean null default true,
  token text not null,
  constraint session_security_pkey primary key (id),
  constraint session_security_session_id_device_fingerprint_key unique (session_id, device_fingerprint),
  constraint session_security_token_key unique (token),
  constraint session_security_session_id_fkey foreign KEY (session_id) references exam_sessions (id) on delete CASCADE,
  constraint session_security_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_session_security_student on public.session_security using btree (student_id, is_active) TABLESPACE pg_default;

create index IF not exists idx_session_security_fingerprint on public.session_security using btree (device_fingerprint) TABLESPACE pg_default;

create index IF not exists idx_session_security_token on public.session_security using btree (token) TABLESPACE pg_default;


create table public.student_answers (
  id serial not null,
  session_id uuid not null,
  question_id integer not null,
  selected_option_id integer null,
  answer_text text null,
  is_flagged boolean null default false,
  is_correct boolean null,
  answered_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  constraint student_answers_pkey primary key (id),
  constraint unique_session_question unique (session_id, question_id),
  constraint student_answers_question_id_fkey foreign KEY (question_id) references questions (id) on delete CASCADE,
  constraint student_answers_session_id_fkey foreign KEY (session_id) references exam_sessions (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_student_answers_session_id on public.student_answers using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_student_answers_question_id on public.student_answers using btree (question_id) TABLESPACE pg_default;

create index IF not exists idx_student_answers_is_correct on public.student_answers using btree (is_correct) TABLESPACE pg_default;


create table public.students (
  id serial not null,
  name text not null,
  father_name text not null,
  grandfather_name text not null,
  gender text not null,
  student_id text not null,
  grade_id integer not null,
  section text not null,
  email text null,
  stream text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint students_pkey primary key (id),
  constraint students_email_key unique (email),
  constraint students_student_id_key unique (student_id),
  constraint students_grade_id_fkey foreign KEY (grade_id) references grades (id),
  constraint students_gender_check check (
    (
      gender = any (
        array['male'::text, 'female'::text, 'other'::text]
      )
    )
  )
) TABLESPACE pg_default;


create table public.subjects (
  id serial not null,
  subject_name text not null,
  description text null,
  stream text null,
  constraint subjects_pkey primary key (id),
  constraint subjects_subject_name_key unique (subject_name),
  constraint subjects_stream_check check (
    (
      (stream is null)
      or (
        stream = any (
          array['Natural'::text, 'Social'::text, 'Common'::text]
        )
      )
    )
  )
) TABLESPACE pg_default;

create table public.teacher (
  id uuid not null default gen_random_uuid (),
  username text not null,
  full_name text not null,
  email text not null,
  phone_number text null,
  grade_id integer null,
  subject_id integer null,
  section text null,
  password text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  stream text null,
  constraint teacher_pkey primary key (id),
  constraint teacher_email_key unique (email),
  constraint teacher_username_key unique (username),
  constraint teacher_grade_id_fkey foreign KEY (grade_id) references grades (id),
  constraint teacher_subject_id_fkey foreign KEY (subject_id) references subjects (id),
  constraint teacher_stream_check check (
    (
      (stream is null)
      or (
        stream = any (array['Natural'::text, 'Social'::text])
      )
    )
  )
) TABLESPACE pg_default;



create view public.active_exam_sessions_view as
select
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
  ss.device_fingerprint as current_device_fingerprint,
  ss.is_active as security_active,
  ss.last_verified,
  EXTRACT(
    epoch
    from
      now() - es.updated_at
  ) as seconds_since_update,
  EXTRACT(
    epoch
    from
      now() - ss.last_verified
  ) as seconds_since_verification
from
  exam_sessions es
  left join session_security ss on es.id = ss.session_id
where
  es.status = 'in_progress'::text
  and ss.is_active = true;



create view public.exam_session_progress_view as
select
  es.id as session_id,
  s.id as student_id,
  s.name as student_name,
  s.student_id as student_number,
  g.grade_name,
  s.section,
  e.title as exam_title,
  e.id as exam_id,
  e.created_by as teacher_id,
  es.status,
  es.time_remaining,
  es.score as current_score,
  es.started_at,
  es.last_activity_at,
  (
    select
      count(*) as count
    from
      student_answers sa
    where
      sa.session_id = es.id
      and sa.is_correct = true
  ) as correct_answers,
  (
    select
      count(*) as count
    from
      student_answers sa
    where
      sa.session_id = es.id
  ) as questions_answered,
  (
    select
      count(*) as count
    from
      questions q
    where
      q.exam_id = e.id
  ) as total_questions,
  e.total_marks as possible_marks,
  EXTRACT(
    epoch
    from
      CURRENT_TIMESTAMP - es.last_activity_at
  ) as seconds_since_activity
from
  exam_sessions es
  join students s on s.id = es.student_id
  join exams e on e.id = es.exam_id
  join grades g on g.id = s.grade_id;


create view public.student_aggregate_results_view as
select
  s.id as student_id,
  s.name as student_name,
  s.student_id as student_number,
  s.grade_id,
  s.section,
  g.grade_name,
  count(distinct r.exam_id) as total_exams,
  sum(r.total_marks_obtained) as total_marks_obtained,
  sum(e.total_marks) as total_possible_marks,
  round(
    sum(r.total_marks_obtained)::numeric / NULLIF(sum(e.total_marks), 0)::numeric * 100::numeric,
    2
  ) as overall_percentage,
  round(avg(r.total_marks_obtained), 2) as average_score,
  min(r.total_marks_obtained) as min_score,
  max(r.total_marks_obtained) as max_score,
  max(r.submission_time) as last_exam_date
from
  students s
  join grades g on g.id = s.grade_id
  left join results r on r.student_id = s.id
  left join exams e on e.id = r.exam_id
group by
  s.id,
  s.name,
  s.student_id,
  s.grade_id,
  s.section,
  g.grade_name
order by
  s.name;


create view public.student_exam_results_view as
select
  r.id as result_id,
  r.exam_id,
  e.title as exam_title,
  e.exam_code,
  e.exam_date,
  e.total_marks as exam_total_marks,
  e.created_by as teacher_id,
  r.total_marks_obtained as score_obtained,
  round(
    r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric * 100::numeric,
    2
  ) as percentage,
  case
    when (
      r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric
    ) >= 0.9 then 'A'::text
    when (
      r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric
    ) >= 0.8 then 'B'::text
    when (
      r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric
    ) >= 0.7 then 'C'::text
    when (
      r.total_marks_obtained::numeric / NULLIF(e.total_marks, 0)::numeric
    ) >= 0.6 then 'D'::text
    else 'F'::text
  end as grade,
  r.comments,
  r.submission_time,
  r.created_at as result_date,
  r.updated_at,
  s.id as student_id,
  s.name as student_name,
  s.student_id as student_number,
  s.grade_id,
  s.section,
  g.grade_name
from
  results r
  join exams e on e.id = r.exam_id
  join students s on s.id = r.student_id
  join grades g on g.id = s.grade_id
order by
  r.created_at desc;