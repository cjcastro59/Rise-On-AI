-- Add head_counselor as an allowed role on user_profiles
-- Updates the CHECK constraint and the RLS helper function used across all policies.

-- 1. Update the role CHECK constraint to include head_counselor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;

  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('user', 'counselor', 'head_counselor', 'admin', 'owner'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 2. Update the RLS helper so head_counselor is treated like counselor/admin/owner
--    for data access (distress logs, journal entries, user profiles, etc.)
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_owner()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN v_role IN ('admin', 'owner', 'counselor', 'head_counselor');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
