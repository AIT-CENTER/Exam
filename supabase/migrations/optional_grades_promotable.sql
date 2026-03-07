-- Optional: add explicit promotable flag to grades (Grade 9, 10, 11 only).
-- Run this if you want to control upgradable grades via DB. The app currently
-- derives promotable from grade_name (numbers 9, 10, 11); if this column exists
-- and is set, the app could use it instead.

ALTER TABLE public.grades
ADD COLUMN IF NOT EXISTS promotable boolean DEFAULT false;

COMMENT ON COLUMN public.grades.promotable IS 'When true, students in this grade can be promoted to the next grade (e.g. Grade 9, 10, 11).';
