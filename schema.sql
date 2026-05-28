-- TEXTILE SHIFT ATTENDANCE SYSTEM - ADVANCED PRODUCTION READY SCHEMA

-- 1. Enable UUID Extension and Cryptography
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create SHIFTS Table
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER DEFAULT 15,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create PROFILES Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'worker' CONSTRAINT role_check CHECK (role IN ('admin', 'worker')),
    full_name TEXT NOT NULL,
    worker_id TEXT UNIQUE,
    mobile TEXT,
    department TEXT,
    photo_url TEXT,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    login_enabled BOOLEAN DEFAULT TRUE, -- Admin deactivation control
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on worker_id for rapid logins
CREATE INDEX IF NOT EXISTS idx_profiles_worker_id ON public.profiles(worker_id);

-- 4. Create ATTENDANCE Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    punch_type TEXT NOT NULL CONSTRAINT punch_type_check CHECK (punch_type IN ('IN', 'OUT')),
    selfie_url TEXT NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    punch_time TIMESTAMPTZ DEFAULT NOW(),
    attendance_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CONSTRAINT status_check CHECK (status IN ('Present', 'Late', 'Half Day', 'Absent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for statistics and audit trails
CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON public.attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);

-- 5. Create SETTINGS Table
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_name TEXT DEFAULT 'Textile Shift Attendance System',
    logo_url TEXT,
    late_grace_minutes INTEGER DEFAULT 15,
    early_exit_minutes INTEGER DEFAULT 15,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 6. Insert Default Shifts
INSERT INTO public.shifts (shift_name, start_time, end_time, grace_minutes, active)
VALUES 
('Day Shift', '09:00:00', '18:00:00', 15, TRUE),
('Night Shift', '21:00:00', '06:00:00', 15, TRUE)
ON CONFLICT DO NOTHING;

-- 7. Insert Default Settings
INSERT INTO public.settings (id, company_name, late_grace_minutes, early_exit_minutes)
VALUES (1, 'Textile Shift Attendance System', 15, 15)
ON CONFLICT DO NOTHING;

-- =======================================================
-- 8. SECURITY DEFINER HELPER FUNCTIONS (RLS recursion protection)
-- =======================================================

-- Helper to check if a user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper to check if a user is an active worker
CREATE OR REPLACE FUNCTION public.is_worker(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'worker' AND login_enabled = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =======================================================
-- 9. SECURE DATABASE ADMINISTRATIVE CONTROLS (RPC)
-- =======================================================

-- Administrative password reset (Directly hashes and updates in auth.users)
CREATE OR REPLACE FUNCTION public.admin_reset_password(worker_uid UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
    -- Strict authorization check: Caller must be admin!
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can reset worker passwords';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf', 10))
    WHERE id = worker_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Administrative worker account deletion (Deletes from auth.users to cascade properly)
CREATE OR REPLACE FUNCTION public.admin_delete_worker(worker_uid UUID)
RETURNS VOID AS $$
BEGIN
    -- Strict authorization check: Caller must be admin!
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can delete worker accounts';
    END IF;

    DELETE FROM auth.users
    WHERE id = worker_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Administrative worker email/ID updates (Syncs worker login ID to auth email)
CREATE OR REPLACE FUNCTION public.admin_update_worker_email(worker_uid UUID, new_worker_id TEXT)
RETURNS VOID AS $$
DECLARE
    new_email TEXT;
BEGIN
    -- Strict authorization check: Caller must be admin!
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can update worker login IDs';
    END IF;

    new_email := lower(new_worker_id) || '@textile-attendance.com';

    UPDATE auth.users
    SET email = new_email,
        normalized_email = new_email
    WHERE id = worker_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- =======================================================
-- 10. AUTO-PROFILE CREATION TRIGGER (auth.users sync)
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, worker_id, mobile, department, shift_id, photo_url, login_enabled)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed Worker'),
        COALESCE(NEW.raw_user_meta_data->>'worker_id', NULL),
        COALESCE(NEW.raw_user_meta_data->>'mobile', NULL),
        COALESCE(NEW.raw_user_meta_data->>'department', 'Production'),
        CASE 
            WHEN NEW.raw_user_meta_data->>'shift_id' IS NOT NULL AND NEW.raw_user_meta_data->>'shift_id' <> '' 
            THEN (NEW.raw_user_meta_data->>'shift_id')::UUID 
            ELSE NULL 
        END,
        COALESCE(NEW.raw_user_meta_data->>'photo_url', NULL),
        COALESCE((NEW.raw_user_meta_data->>'login_enabled')::BOOLEAN, TRUE)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =======================================================

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Shifts Policies
CREATE POLICY "Allow read access to shifts for authenticated users" 
    ON public.shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all operations for admin on shifts" 
    ON public.shifts FOR ALL TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Profiles Policies
CREATE POLICY "Allow read access to profiles for authenticated users" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow profile update for own account or admin" 
    ON public.profiles FOR UPDATE TO authenticated 
    USING (id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Allow admin full access to profiles" 
    ON public.profiles FOR ALL TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Attendance Policies
CREATE POLICY "Allow workers to view their own attendance" 
    ON public.attendance FOR SELECT TO authenticated 
    USING ((worker_id = auth.uid() AND public.is_worker(auth.uid())) OR public.is_admin(auth.uid()));

CREATE POLICY "Allow active workers to insert their own attendance" 
    ON public.attendance FOR INSERT TO authenticated 
    WITH CHECK (worker_id = auth.uid() AND public.is_worker(auth.uid()));

CREATE POLICY "Allow admin full control on attendance" 
    ON public.attendance FOR ALL TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Settings Policies
CREATE POLICY "Allow read access to settings for authenticated users" 
    ON public.settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin to update settings" 
    ON public.settings FOR UPDATE TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- =======================================================
-- 12. STORAGE BUCKET CREATION & AUDITED SECURITY POLICIES
-- =======================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-selfies', 'attendance-selfies', TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to selfies based on folder ownership or role"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'attendance-selfies' AND 
        (
            public.is_admin(auth.uid()) OR 
            (storage.foldername(name))[1] = auth.uid()::text
        )
    );

CREATE POLICY "Allow workers to upload selfies strictly in their own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'attendance-selfies' AND 
        public.is_worker(auth.uid()) AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Allow admins full control on selfie assets"
    ON storage.objects FOR ALL TO authenticated
    USING (
        bucket_id = 'attendance-selfies' AND 
        public.is_admin(auth.uid())
    );
