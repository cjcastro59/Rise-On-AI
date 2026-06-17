-- Run this script in Supabase SQL Editor to fill in your profile's null fields!
-- You can customize the values as needed!
UPDATE public.user_profiles
SET 
    username = 'admin_guerrero',
    full_name = 'Admin Guerrero',
    first_name = 'Admin',
    last_name = 'Guerrero',
    age = 25,
    gender = 'male',
    country = 'philippines',
    mood_baseline = 'calm',
    goals = ARRAY['Reduce stress', 'Improve mood'],
    language = 'English'
WHERE email = 'admin_guerrero@gmail.com';

-- Verify the update:
SELECT * FROM public.user_profiles WHERE email = 'admin_guerrero@gmail.com';
