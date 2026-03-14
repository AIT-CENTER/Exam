-- Patch: Fix admin RLS recursion + grant privileges (apply to existing DB)
-- Run in Supabase SQL Editor.

-- 1) Replace is_super_admin to use JWT role claim (no recursion)
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

-- 2) Fix admin table policies (remove recursive ones)
DROP POLICY IF EXISTS admin_super_admin_all ON public.admin;
DROP POLICY IF EXISTS admin_self_update_profile ON public.admin;
DROP POLICY IF EXISTS admin_self_select ON public.admin;

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

-- 3) Ensure privileges exist (RLS is not enough)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

