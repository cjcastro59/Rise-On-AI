-- Run this script in Supabase SQL Editor to make a user a researcher!
UPDATE public.user_profiles
SET role = 'researcher'
WHERE email = 'admin_guerrero@gmail.com';

-- Verify the update:
SELECT * FROM public.user_profiles WHERE email = 'admin_guerrero@gmail.com';
