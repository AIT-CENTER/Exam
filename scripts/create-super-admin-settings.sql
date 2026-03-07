-- Create super_admin_settings table for feature flags and configuration
CREATE TABLE IF NOT EXISTS public.super_admin_settings (
  id SERIAL PRIMARY KEY,
  promotion_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policy for super_admin_settings
ALTER TABLE public.super_admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only super admins to read settings
CREATE POLICY "super_admin_settings_read" ON public.super_admin_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin
      WHERE admin.id = auth.uid() AND admin.role = 'super_admin'
    )
  );

-- Create policy to allow only super admins to update settings
CREATE POLICY "super_admin_settings_update" ON public.super_admin_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin
      WHERE admin.id = auth.uid() AND admin.role = 'super_admin'
    )
  );

-- Create policy to allow only super admins to insert settings
CREATE POLICY "super_admin_settings_insert" ON public.super_admin_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin
      WHERE admin.id = auth.uid() AND admin.role = 'super_admin'
    )
  );

-- Insert default settings
INSERT INTO public.super_admin_settings (id, promotion_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;
