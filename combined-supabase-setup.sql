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
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
    age INTEGER,
    gender TEXT,
    country TEXT,
    mood_baseline TEXT,
    goals TEXT[],
    language TEXT,
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

-- handle_new_user function (creates user profile when new user registers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

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
DROP FUNCTION IF EXISTS public.update_updated_at();

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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view their own profile') THEN
        CREATE POLICY "Users can view their own profile" 
            ON public.user_profiles 
            FOR SELECT 
            USING (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" 
            ON public.user_profiles 
            FOR UPDATE 
            USING (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert their own profile') THEN
        CREATE POLICY "Users can insert their own profile" 
            ON public.user_profiles 
            FOR INSERT 
            WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Admins/owners can view all profiles') THEN
        CREATE POLICY "Admins/owners can view all profiles" 
            ON public.user_profiles 
            FOR SELECT 
            USING (EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND role IN ('admin', 'owner')
            ));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Admins/owners can update user roles') THEN
        CREATE POLICY "Admins/owners can update user roles" 
            ON public.user_profiles 
            FOR UPDATE 
            USING (EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND role IN ('admin', 'owner')
            ));
    END IF;
END
$$;

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

-- audit_logs (Admin only)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Admins/owners can view audit logs') THEN
        CREATE POLICY "Admins/owners can view audit logs" 
            ON public.audit_logs 
            FOR SELECT 
            USING (EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND role IN ('admin', 'owner')
            ));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Admins/owners can insert audit logs') THEN
        CREATE POLICY "Admins/owners can insert audit logs" 
            ON public.audit_logs 
            FOR INSERT 
            WITH CHECK (EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND role IN ('admin', 'owner')
            ));
    END IF;
END
$$;
