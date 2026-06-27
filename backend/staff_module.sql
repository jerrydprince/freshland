-- LUXE APARTMENT PMS - STAFF & ROLE MANAGEMENT MIGRATION

-- 1. Extend ENUMS for new roles
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hotel_owner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'maintenance';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer_support';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create Staff Attendance Table
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'present', -- present, late, absent, on_leave
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Unified System Logs Table for auditing
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email TEXT,
    log_type TEXT NOT NULL CHECK (log_type IN ('activity', 'login', 'audit')),
    action TEXT NOT NULL,
    module TEXT,
    entity_table TEXT,
    entity_id UUID,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS Overrides for MVP
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all selects for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all inserts for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all updates for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all deletes for staff_attendance" ON staff_attendance;

CREATE POLICY "Allow all selects for staff_attendance" ON staff_attendance FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for staff_attendance" ON staff_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for staff_attendance" ON staff_attendance FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for staff_attendance" ON staff_attendance FOR DELETE USING (true);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all selects for system_logs" ON system_logs;
DROP POLICY IF EXISTS "Allow all inserts for system_logs" ON system_logs;

CREATE POLICY "Allow all selects for system_logs" ON system_logs FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for system_logs" ON system_logs FOR INSERT WITH CHECK (true);

-- 5. Seed System Logs with an initial system event
INSERT INTO system_logs (action, module, log_type, metadata) 
VALUES ('System Initialization', 'System', 'activity', '{"details": "Staff & Role Management Module activated successfully."}'::jsonb)
ON CONFLICT DO NOTHING;
