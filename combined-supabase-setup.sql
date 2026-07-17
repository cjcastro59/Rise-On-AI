-- ------------------------------
-- COMBINED FULL SUPABASE SETUP
-- Includes all tables, triggers, and RLS policies
-- Safe to run multiple times!
-- ------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'counselor', 'admin', 'owner')),
  age INTEGER,
  sex TEXT,
  country TEXT,
  bio TEXT,
  avatar_url TEXT,
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
  -- 2FA
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  -- Account status
  is_active BOOLEAN DEFAULT true,
  -- Counselor online status
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT,
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

-- system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    counselor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS mood_baseline TEXT;

-- Ensure role check constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists to ensure we have the correct allowed roles
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;
  
  -- Add the constraint with all allowed roles
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('user', 'counselor', 'admin', 'owner'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Update any existing researcher role to counselor or user
UPDATE public.user_profiles SET role = 'counselor' WHERE role = 'researcher';
UPDATE public.user_profiles SET role = 'user' WHERE role NOT IN ('user', 'counselor', 'admin', 'owner');
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS goals TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- 2FA columns
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
-- Counselor online status
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Ensure role has default value
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- Add title column to journal_entries if missing
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS title TEXT;


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

-- Trigger function to enforce single owner and role change permissions
DROP FUNCTION IF EXISTS public.enforce_role_change_rules() CASCADE;
CREATE OR REPLACE FUNCTION public.enforce_role_change_rules()
RETURNS TRIGGER AS $$
DECLARE
    current_user_role TEXT;
    owner_count INTEGER;
BEGIN
    -- Get current user's role
    SELECT role INTO current_user_role
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1;

    -- Check if role is being changed
    IF NEW.role <> OLD.role THEN
        -- Only allow owners or admins to change roles
        IF current_user_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Only owners and admins can change user roles';
        END IF;

        -- Prevent changing role directly to 'owner' (must use transfer_ownership function)
        IF NEW.role = 'owner' THEN
            RAISE EXCEPTION 'Cannot set role to owner directly. Use transfer_ownership function instead.';
        END IF;

        -- Prevent changing role away from 'owner' (must use transfer_ownership function)
        IF OLD.role = 'owner' THEN
            RAISE EXCEPTION 'Cannot change owner role directly. Use transfer_ownership function instead.';
        END IF;
    END IF;

    -- Check if is_active is being changed on the owner account
    IF NEW.is_active <> OLD.is_active AND OLD.role = 'owner' THEN
        -- Only allow owner to change their own active status
        IF current_user_role != 'owner' OR auth.uid() != OLD.id THEN
            RAISE EXCEPTION 'Only the owner can change their own active status';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_profiles table for role change rules
DROP TRIGGER IF EXISTS enforce_role_change_rules_trigger ON public.user_profiles;
CREATE OR REPLACE TRIGGER enforce_role_change_rules_trigger
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_role_change_rules();

-- Function to transfer ownership to another user (only callable by current owner)
DROP FUNCTION IF EXISTS public.transfer_ownership(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.transfer_ownership(new_owner_id TEXT)
RETURNS VOID AS $$
DECLARE
    current_owner_id TEXT;
BEGIN
    -- Get current owner
    SELECT id INTO current_owner_id
    FROM public.user_profiles
    WHERE role = 'owner'
    LIMIT 1;

    -- Verify current user is the owner
    IF current_owner_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the current owner can transfer ownership';
    END IF;

    -- Verify new owner exists
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = new_owner_id) THEN
        RAISE EXCEPTION 'New owner user does not exist';
    END IF;

    -- Update current owner to admin
    UPDATE public.user_profiles
    SET role = 'admin'
    WHERE id = current_owner_id;

    -- Update new owner to owner
    UPDATE public.user_profiles
    SET role = 'owner'
    WHERE id = new_owner_id;

    -- Log to audit logs
    INSERT INTO public.audit_logs (admin_id, action, target_id, target_type, details)
    VALUES (auth.uid(), 'Ownership Transferred', new_owner_id, 'user', 'Ownership transferred to new user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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


ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

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

-- journal_entries
-- First, drop existing select policy to replace it
DROP POLICY IF EXISTS "Users can view their own journal entries" ON public.journal_entries;

-- New policy: users can view their own OR admins/owners/counselors can view all
CREATE POLICY "Users can view their own or admins can view all journal entries" 
    ON public.journal_entries 
    FOR SELECT 
    USING (auth.uid() = user_id OR public.is_current_user_admin_or_owner());

-- Insert, update, delete policies remain the same (only own entries)
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
-- Update select policy for admins
DROP POLICY IF EXISTS "Users can view their own mood logs" ON public.mood_logs;
CREATE POLICY "Users can view their own or admins can view all mood logs" 
    ON public.mood_logs 
    FOR SELECT 
    USING (auth.uid() = user_id OR public.is_current_user_admin_or_owner());

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
-- Update select policy for admins
DROP POLICY IF EXISTS "Users can view their own distress logs" ON public.distress_logs;
DROP POLICY IF EXISTS "Counselors/admins can update distress logs" ON public.distress_logs;
CREATE POLICY "Users can view their own or admins can view all distress logs" 
    ON public.distress_logs 
    FOR SELECT 
    USING (auth.uid() = user_id OR public.is_current_user_admin_or_owner());

CREATE POLICY "Counselors/admins can update distress logs"
    ON public.distress_logs
    FOR UPDATE
    USING (public.is_current_user_admin_or_owner())
    WITH CHECK (public.is_current_user_admin_or_owner());

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
-- Update select policy for admins
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own or admins can view all activity logs" 
    ON public.activity_logs 
    FOR SELECT 
    USING (auth.uid() = user_id OR public.is_current_user_admin_or_owner());

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
-- Update select policy for admins
DROP POLICY IF EXISTS "Users can view their own mood analytics" ON public.mood_analytics;
CREATE POLICY "Users can view their own or admins can view all mood analytics" 
    ON public.mood_analytics 
    FOR SELECT 
    USING (auth.uid() = user_id OR public.is_current_user_admin_or_owner());

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

-- system_settings
DO $$
BEGIN
    DROP POLICY IF EXISTS "Only owners can view system settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Only owners can update system settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Only owners can insert system settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Counselors can view their own settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Counselors can update their own settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Counselors can insert their own settings" ON public.system_settings;
END
$$;

-- Policy for owners to manage all system settings
CREATE POLICY "Only owners can view system settings"
    ON public.system_settings
    FOR SELECT
    USING (public.is_current_user_owner());

CREATE POLICY "Only owners can update system settings"
    ON public.system_settings
    FOR UPDATE
    USING (public.is_current_user_owner())
    WITH CHECK (public.is_current_user_owner());

CREATE POLICY "Only owners can insert system settings"
    ON public.system_settings
    FOR INSERT
    WITH CHECK (public.is_current_user_owner());

-- Policies for counselors to manage their own notification settings
CREATE POLICY "Counselors can view their own settings"
    ON public.system_settings
    FOR SELECT
    USING (
        public.is_current_user_admin_or_owner()
        AND (
            public.is_current_user_owner()
            OR (key LIKE 'counselor_notifications_%' AND key = 'counselor_notifications_' || auth.uid()::text)
        )
    );

CREATE POLICY "Counselors can update their own settings"
    ON public.system_settings
    FOR UPDATE
    USING (
        public.is_current_user_admin_or_owner()
        AND (
            public.is_current_user_owner()
            OR (key LIKE 'counselor_notifications_%' AND key = 'counselor_notifications_' || auth.uid()::text)
        )
    )
    WITH CHECK (
        public.is_current_user_admin_or_owner()
        AND (
            public.is_current_user_owner()
            OR (key LIKE 'counselor_notifications_%' AND key = 'counselor_notifications_' || auth.uid()::text)
        )
    );

CREATE POLICY "Counselors can insert their own settings"
    ON public.system_settings
    FOR INSERT
    WITH CHECK (
        public.is_current_user_admin_or_owner()
        AND (
            public.is_current_user_owner()
            OR (key LIKE 'counselor_notifications_%' AND key = 'counselor_notifications_' || auth.uid()::text)
        )
    );

-- announcements table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Everyone can view active announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admins/owners can manage announcements" ON public.announcements;
END
$$;

-- Everyone can view active announcements
CREATE POLICY "Everyone can view active announcements"
    ON public.announcements
    FOR SELECT
    USING (is_active = true);

-- Admins/owners can manage all announcements
CREATE POLICY "Admins/owners can manage announcements"
    ON public.announcements
    FOR ALL
    USING (public.is_current_user_admin_or_owner())
    WITH CHECK (public.is_current_user_admin_or_owner());

-- ------------------------------
-- RLS Policies for conversations
-- ------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can view all conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can insert conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can update conversations" ON public.conversations;
END
$$;

CREATE POLICY "Users can view their own conversations"
    ON public.conversations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Counselors/admins can view all conversations"
    ON public.conversations
    FOR SELECT
    USING (public.is_current_user_admin_or_owner());

CREATE POLICY "Users can insert their own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Counselors/admins can insert conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (public.is_current_user_admin_or_owner());

CREATE POLICY "Counselors/admins can update conversations"
    ON public.conversations
    FOR UPDATE
    USING (public.is_current_user_admin_or_owner())
    WITH CHECK (public.is_current_user_admin_or_owner());

-- ------------------------------
-- RLS Policies for conversations
-- ------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can view all conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can insert conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Counselors/admins can update conversations" ON public.conversations;
END
$$;

CREATE POLICY "Users can view their own conversations"
    ON public.conversations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Counselors/admins can view all conversations"
    ON public.conversations
    FOR SELECT
    USING (public.is_current_user_admin_or_owner());

CREATE POLICY "Users can insert their own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Counselors/admins can insert conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (public.is_current_user_admin_or_owner());

CREATE POLICY "Counselors/admins can update conversations"
    ON public.conversations
    FOR UPDATE
    USING (public.is_current_user_admin_or_owner())
    WITH CHECK (public.is_current_user_admin_or_owner());

-- ------------------------------
-- RLS Policies for messages
-- ------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
    DROP POLICY IF EXISTS "Counselors/admins can view all messages" ON public.messages;
    DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;
    DROP POLICY IF EXISTS "Counselors/admins can insert messages" ON public.messages;
END
$$;

CREATE POLICY "Users can view messages from their conversations"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE public.conversations.id = public.messages.conversation_id
            AND public.conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Counselors/admins can view all messages"
    ON public.messages
    FOR SELECT
    USING (public.is_current_user_admin_or_owner());

CREATE POLICY "Users can insert messages to their conversations"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversations
            WHERE public.conversations.id = public.messages.conversation_id
            AND public.conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Counselors/admins can insert messages"
    ON public.messages
    FOR INSERT
    WITH CHECK (public.is_current_user_admin_or_owner());

-- ------------------------------
-- Triggers for updated_at
-- ------------------------------
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE OR REPLACE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to update conversation's updated_at when a new message is inserted
DROP FUNCTION IF EXISTS public.update_conversation_updated_at_on_message() CASCADE;
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at_on_message() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run the function when a message is inserted
DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.messages;
CREATE OR REPLACE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_updated_at_on_message();

-- ------------------------------
-- RLS Policies for notes
-- ------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
    DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
    DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
    DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
END
$$;

CREATE POLICY "Users can view their own notes"
    ON public.notes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
    ON public.notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
    ON public.notes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
    ON public.notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Enable RLS on notes table
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger for notes table
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE OR REPLACE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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

-- ------------------------------
-- 9. Storage Buckets for Profile Pictures
-- ------------------------------
-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies first to avoid conflict
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Allow public access to the avatars bucket
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow authenticated users can upload their own avatars
CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users can update their own avatars
CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users can delete their own avatars
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- Add new columns to user_profiles (for existing tables)
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS two_factor_secret text;

-- Add two_factor_skipped column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS two_factor_skipped BOOLEAN DEFAULT FALSE;

-- ==========================================
-- Real-Time Setup
-- ==========================================
-- Create the supabase_realtime publication if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add conversations and messages tables to the real-time publication
DO $$
BEGIN
  -- Add conversations table if not already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  
  -- Add messages table if not already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- Verify which tables are in the real-time publication
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

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

-- Restricts chat message visibility to conversation participants only:
-- the user who owns the conversation and the assigned counselor.
-- Conversation lists are scoped in the app UI; message content is enforced here.

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Counselors/admins can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can view messages from their conversations" ON public.messages;

CREATE POLICY "Participants can view messages from their conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND (
          public.conversations.user_id = auth.uid()
          OR public.conversations.counselor_id = auth.uid()
        )
        AND public.messages.sender_id IN (
          public.conversations.user_id,
          public.conversations.counselor_id
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Counselors/admins can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages to their conversations" ON public.messages;

CREATE POLICY "Participants can insert messages to their conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND (
          public.conversations.user_id = auth.uid()
          OR public.conversations.counselor_id = auth.uid()
        )
    )
  );

-- ------------------------------
-- ADD COUNSELOR ONLINE STATUS
-- Adds is_online column to user_profiles for counselor availability
-- Safe to run multiple times!
-- ------------------------------

-- Add is_online column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create index for faster online counselor queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_online ON public.user_profiles(is_online) WHERE role = 'counselor';
