-- LUXE APARTMENT PMS - MIGRATION TO ADD SALARY, ALLOWANCES & DEDUCTIONS TO STAFF PROFILES
-- Idempotently alters profiles table to include core payroll fields.

DO $$ 
BEGIN
    -- 1. Add base_salary column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='base_salary') THEN
        ALTER TABLE profiles ADD COLUMN base_salary DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- 2. Add allowances column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='allowances') THEN
        ALTER TABLE profiles ADD COLUMN allowances DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- 3. Add deductions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deductions') THEN
        ALTER TABLE profiles ADD COLUMN deductions DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;
