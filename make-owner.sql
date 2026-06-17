-- Run this script in Supabase SQL Editor to make a user an OWNER (only owners can do this!)
-- Replace 'your-email@example.com' with the email of the user you want to make owner!
UPDATE public.user_profiles
SET role = 'owner'
WHERE email = 'admin_guerrero@gmail.com';

-- Verify the update:
SELECT * FROM public.user_profiles WHERE email = 'admin_guerrero@gmail.com';
