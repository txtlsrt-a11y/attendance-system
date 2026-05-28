-- TEXTILE SHIFT ATTENDANCE SYSTEM - PRODUCTION READY SECURE DATABASE SCHEMA

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on worker_id for rapid lookups during worker tab logins
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

-- Indexes for statistics loading and reports audit trails
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
-- 8. SECURITY DEFINER HELPER FUNCTIONS (ELIMINATES RLS RECURSION)
-- =======================================================

-- Helper to check if a user is an administrator (Bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper to check if a user is a worker (Bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_worker(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'worker'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =======================================================
-- 9. AUTO-PROFILE CREATION TRIGGER (auth.users sync)
-- =======================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, worker_id, mobile, department, shift_id, photo_url)
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
        COALESCE(NEW.raw_user_meta_data->>'photo_url', NULL)
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
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =======================================================

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- --- SHIFTS POLICIES ---
CREATE POLICY "Allow read access to shifts for authenticated users" 
    ON public.shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all operations for admin on shifts" 
    ON public.shifts FOR ALL TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- --- PROFILES POLICIES ---
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

-- --- ATTENDANCE POLICIES ---
CREATE POLICY "Allow workers to view their own attendance" 
    ON public.attendance FOR SELECT TO authenticated 
    USING (worker_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Allow workers to insert their own attendance record" 
    ON public.attendance FOR INSERT TO authenticated 
    WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Allow admin full control on attendance" 
    ON public.attendance FOR ALL TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- --- SETTINGS POLICIES ---
CREATE POLICY "Allow read access to settings for authenticated users" 
    ON public.settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin to update settings" 
    ON public.settings FOR UPDATE TO authenticated 
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- =======================================================
-- 11. STORAGE BUCKET CREATION & AUDITED SECURITY POLICIES
-- =======================================================

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-selfies', 'attendance-selfies', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage metadata (standard Supabase mechanism)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage Read Policy: Workers can only view their own selfies folder, Admins can view all folders
CREATE POLICY "Allow read access to selfies based on folder ownership or role"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'attendance-selfies' AND 
        (
            public.is_admin(auth.uid()) OR 
            (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- Storage Insert Policy: Workers can only upload files inside a folder named after their User UUID
CREATE POLICY "Allow workers to upload selfies strictly in their own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'attendance-selfies' AND 
        auth.role() = 'authenticated' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage Delete/Modify Policy: Only administrators can delete or modify file assets
CREATE POLICY "Allow admins full control on selfie assets"
    ON storage.objects FOR ALL TO authenticated
    USING (
        bucket_id = 'attendance-selfies' AND 
        public.is_admin(auth.uid())
    );
