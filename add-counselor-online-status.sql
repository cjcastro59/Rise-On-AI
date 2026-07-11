-- ------------------------------
-- ADD COUNSELOR ONLINE STATUS
-- Adds is_online column to user_profiles for counselor availability
-- Safe to run multiple times!
-- ------------------------------

-- Add is_online column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create index for faster online counselor queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_online ON public.user_profiles(is_online) WHERE role = 'counselor';
