-- Allows counselors, admins, and owners to review/update distress alert notes.
-- Run this in Supabase SQL editor if counselor Review still shows a permission message.

CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_owner()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  RETURN v_role IN ('admin', 'owner', 'counselor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Counselors/admins can update distress logs" ON public.distress_logs;

CREATE POLICY "Counselors/admins can update distress logs"
  ON public.distress_logs
  FOR UPDATE
  USING (public.is_current_user_admin_or_owner())
  WITH CHECK (public.is_current_user_admin_or_owner());
