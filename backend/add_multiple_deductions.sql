-- LUXE APARTMENT PMS - MIGRATION FOR MULTIPLE DEDUCTIONS
-- Idempotently adds `deductions_list` JSONB column to support multiple named deductions per role and staff profile.

DO $$ 
BEGIN
    -- 1. Add deductions_list to salary_structures
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salary_structures' AND column_name = 'deductions_list'
    ) THEN
        ALTER TABLE salary_structures ADD COLUMN deductions_list JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- 2. Add deductions_list to profiles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'deductions_list'
    ) THEN
        ALTER TABLE profiles ADD COLUMN deductions_list JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- 3. Add deductions_list to staff_salaries
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_salaries' AND column_name = 'deductions_list'
    ) THEN
        ALTER TABLE staff_salaries ADD COLUMN deductions_list JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
