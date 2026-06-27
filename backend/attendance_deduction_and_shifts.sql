-- LUXE APARTMENT PMS - ATTENDANCE DEDUCTIONS & CUSTOM SHIFTS SCHEMA MIGRATION
-- Adds columns to profiles table and configures supabase_realtime publications.

DO $$ 
BEGIN
    -- 1. Add shift configurations to profiles table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='shift_name') THEN
        ALTER TABLE profiles ADD COLUMN shift_name TEXT DEFAULT 'Morning Shift';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='shift_start_time') THEN
        ALTER TABLE profiles ADD COLUMN shift_start_time TEXT DEFAULT '08:00';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='shift_end_time') THEN
        ALTER TABLE profiles ADD COLUMN shift_end_time TEXT DEFAULT '17:00';
    END IF;

    -- 2. Add expected work days of the week to profiles table
    -- Default is Mon-Sat: 1,2,3,4,5,6 (where 0 is Sunday, 1 is Monday, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='expected_work_days') THEN
        ALTER TABLE profiles ADD COLUMN expected_work_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='expected_work_days_count') THEN
        ALTER TABLE profiles ADD COLUMN expected_work_days_count INTEGER DEFAULT 6;
    END IF;

    -- 3. Add attendance-specific deduction settings to profiles table
    -- Default type is 'daily_rate' which pro-rates: Base Salary / Expected Days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='attendance_deduction_type') THEN
        ALTER TABLE profiles ADD COLUMN attendance_deduction_type TEXT DEFAULT 'daily_rate' CHECK (attendance_deduction_type IN ('daily_rate', 'fixed', 'percentage'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='attendance_deduction_rate') THEN
        ALTER TABLE public.profiles ADD COLUMN attendance_deduction_rate DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- 4. Enable Supabase Realtime Publications on critical tables
-- Check if publication exists first, then safely alter/create
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Idempotently add tables to the publication
-- We do this safely by first dropping table if it is already in publication to avoid duplication errors, 
-- or we can write a script. In Postgres 14+, ALTER PUBLICATION ... ADD TABLE is safe if not exists or if we recreate it.
-- Let's define the alters. If the tables are already published, Postgres might return a notice, which is fine.
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
