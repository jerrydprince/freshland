-- LUXE APARTMENT PMS - MIGRATION FOR DEDUCTION TYPES, SALARY STRUCTURES, LEAVE MANAGEMENT & ATTENDANCE LINKAGE
-- Idempotently creates tables and adds new columns to profiles table.

DO $$ 
BEGIN
    -- 1. Alter profiles table to support deductions configuration and exceptions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deduction_type') THEN
        ALTER TABLE profiles ADD COLUMN deduction_type TEXT DEFAULT 'amount' CHECK (deduction_type IN ('amount', 'percentage'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='has_salary_exception') THEN
        ALTER TABLE profiles ADD COLUMN has_salary_exception BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='salary_exception_reason') THEN
        ALTER TABLE profiles ADD COLUMN salary_exception_reason TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='exempt_from_attendance_deduction') THEN
        ALTER TABLE profiles ADD COLUMN exempt_from_attendance_deduction BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Create Global Role-based Salary Structures table
CREATE TABLE IF NOT EXISTS salary_structures (
    role TEXT PRIMARY KEY,
    base_salary DECIMAL(12,2) DEFAULT 0,
    allowances DECIMAL(12,2) DEFAULT 0,
    deductions DECIMAL(12,2) DEFAULT 0,
    deduction_type TEXT DEFAULT 'amount' CHECK (deduction_type IN ('amount', 'percentage')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed standard role-based fallback salaries, allowances, and deductions
INSERT INTO salary_structures (role, base_salary, allowances, deductions, deduction_type) VALUES
('hotel_manager', 250000.00, 0.00, 0.00, 'amount'),
('accountant', 200000.00, 0.00, 0.00, 'amount'),
('receptionist', 140000.00, 0.00, 0.00, 'amount'),
('housekeeping', 80000.00, 0.00, 0.00, 'amount'),
('maintenance', 90000.00, 0.00, 0.00, 'amount'),
('laundry_manager', 150000.00, 0.00, 0.00, 'amount'),
('laundry_staff', 100000.00, 0.00, 0.00, 'amount'),
('super_admin', 300000.00, 0.00, 0.00, 'amount')
ON CONFLICT (role) DO UPDATE SET 
    base_salary = EXCLUDED.base_salary,
    allowances = EXCLUDED.allowances,
    deductions = EXCLUDED.deductions,
    deduction_type = EXCLUDED.deduction_type;

-- 3. Create Leave Applications table
CREATE TABLE IF NOT EXISTS leave_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'maternity', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security & Policies
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select salary_structures" ON salary_structures;
DROP POLICY IF EXISTS "Admin manage salary_structures" ON salary_structures;
CREATE POLICY "Public select salary_structures" ON salary_structures FOR SELECT USING (true);
CREATE POLICY "Admin manage salary_structures" ON salary_structures FOR ALL USING (true);

ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read leave_applications" ON leave_applications;
DROP POLICY IF EXISTS "Anyone write leave_applications" ON leave_applications;
CREATE POLICY "Public read leave_applications" ON leave_applications FOR SELECT USING (true);
CREATE POLICY "Anyone write leave_applications" ON leave_applications FOR ALL USING (true);
