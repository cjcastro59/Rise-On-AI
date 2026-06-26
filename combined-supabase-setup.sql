-- ------------------------------
-- COMBINED FULL SUPABASE SETUP
-- Includes all tables, triggers, and RLS policies
-- Safe to run multiple times!
-- ------------------------------

-- ------------------------------
-- 1. Enable Extensions
-- ------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------
-- 2. Create Tables (if they don't exist)
-- ------------------------------

-- user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'researcher', 'counselor', 'admin', 'owner')),
  age INTEGER,
  gender TEXT,
  country TEXT,
  mood_baseline TEXT,
  goals TEXT[],
  language TEXT,
  -- Mood preferences
  mood_reminder_enabled BOOLEAN DEFAULT false,
  mood_reminder_time TIME,
  -- Emergency support
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT,
    mood TEXT,
    emotions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- mood_logs table
CREATE TABLE IF NOT EXISTS public.mood_logs (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    mood TEXT,
    score INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- distress_logs table
CREATE TABLE IF NOT EXISTS public.distress_logs (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    severity TEXT,
    trigger TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- mood_analytics table
CREATE TABLE IF NOT EXISTS public.mood_analytics (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    avg_mood_score NUMERIC,
    dominant_emotion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT,
    target_id UUID,
    target_type TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------
-- 3. Add Missing Columns to user_profiles
-- ------------------------------
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS mood_baseline TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS goals TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure role has default value
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- ------------------------------
-- 4. Create Functions & Triggers
-- ------------------------------

-- Helper function to check if user is owner ONLY (SAFE, avoids recursion!)
DROP FUNCTION IF EXISTS public.is_current_user_owner() CASCADE;
CREATE OR REPLACE FUNCTION public.is_current_user_owner() 
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN v_role = 'owner';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin/owner/researcher/counselor (SAFE, avoids recursion!)
DROP FUNCTION IF EXISTS public.is_current_user_admin_or_owner() CASCADE;
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_owner() 
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_role IN ('admin', 'owner', 'researcher', 'counselor');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to prevent non-owners from changing user roles
DROP FUNCTION IF EXISTS public.prevent_role_change_by_non_owner() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_role_change_by_non_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if role is being changed
    IF NEW.role <> OLD.role THEN
        -- Only allow owners to change roles
        IF NOT public.is_current_user_owner() THEN
            RAISE EXCEPTION 'Only owners can change user roles';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_profiles table
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.user_profiles;
CREATE OR REPLACE TRIGGER prevent_role_change_trigger
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_change_by_non_owner();

-- handle_new_user function (creates user profile when new user registers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, role, created_at, updated_at)
    VALUES (NEW.id, NEW.email, 'user', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- update_updated_at function (auto-updates updated_at column)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON public.journal_entries;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE OR REPLACE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------
-- 5. Enable RLS on All Tables
-- ------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------
-- 6. RLS Policies for user_profiles (safe create using DO blocks)
-- ------------------------------
-- First, DROP ALL existing policies for user_profiles to start fresh!
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins/owners can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins/owners can update user roles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update all" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile (no role)" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins/owners can update non-role fields" ON public.user_profiles;
DROP POLICY IF EXISTS "Only owners can update role field" ON public.user_profiles;
DROP POLICY IF EXISTS "Only owners can delete profiles" ON public.user_profiles;

-- Now create ALL necessary policies explicitly!
-- Policy 1: Users can view their own profile OR admins/owners can view all
CREATE POLICY "Users can view their own profile or admins can view all"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id OR public.is_current_user_admin_or_owner());

-- Policy 2: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own profile OR admins/owners can update any profile (role changes protected by trigger!)
CREATE POLICY "Users can update their own profile or admins can update all"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_current_user_admin_or_owner())
    WITH CHECK (auth.uid() = id OR public.is_current_user_admin_or_owner());

-- Policy 4: Only owners can delete profiles
CREATE POLICY "Only owners can delete profiles"
    ON public.user_profiles
    FOR DELETE
    USING (public.is_current_user_owner());

-- ------------------------------
-- 7. RLS Policies for Other Tables (safe create)
-- ------------------------------

-- journal_entries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Users can view their own journal entries') THEN
        CREATE POLICY "Users can view their own journal entries" 
            ON public.journal_entries 
            FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Users can insert their own journal entries') THEN
        CREATE POLICY "Users can insert their own journal entries" 
            ON public.journal_entries 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Users can update their own journal entries') THEN
        CREATE POLICY "Users can update their own journal entries" 
            ON public.journal_entries 
            FOR UPDATE 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Users can delete their own journal entries') THEN
        CREATE POLICY "Users can delete their own journal entries" 
            ON public.journal_entries 
            FOR DELETE 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

-- mood_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_logs' AND policyname = 'Users can view their own mood logs') THEN
        CREATE POLICY "Users can view their own mood logs" 
            ON public.mood_logs 
            FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_logs' AND policyname = 'Users can insert their own mood logs') THEN
        CREATE POLICY "Users can insert their own mood logs" 
            ON public.mood_logs 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- distress_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'distress_logs' AND policyname = 'Users can view their own distress logs') THEN
        CREATE POLICY "Users can view their own distress logs" 
            ON public.distress_logs 
            FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'distress_logs' AND policyname = 'Users can insert their own distress logs') THEN
        CREATE POLICY "Users can insert their own distress logs" 
            ON public.distress_logs 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- activity_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can view their own activity logs') THEN
        CREATE POLICY "Users can view their own activity logs" 
            ON public.activity_logs 
            FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can insert their own activity logs') THEN
        CREATE POLICY "Users can insert their own activity logs" 
            ON public.activity_logs 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- mood_analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_analytics' AND policyname = 'Users can view their own mood analytics') THEN
        CREATE POLICY "Users can view their own mood analytics" 
            ON public.mood_analytics 
            FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mood_analytics' AND policyname = 'Users can insert their own mood analytics') THEN
        CREATE POLICY "Users can insert their own mood analytics" 
            ON public.mood_analytics 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- audit_logs (Admin/Owner only)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Admins/owners can view audit logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "Admins/owners can insert audit logs" ON public.audit_logs;
END
$$;

CREATE POLICY "Admins/owners can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_current_user_admin_or_owner());

CREATE POLICY "Admins/owners can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (public.is_current_user_admin_or_owner());

-- ------------------------------
-- 8. GRANT PERMISSIONS TO ROLES
-- ------------------------------
-- Grant usage on schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant all privileges on all tables in public schema (for service role)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant specific privileges to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant privileges on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
