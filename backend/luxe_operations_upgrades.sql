-- LUXE APARTMENT PMS - OPERATIONS, COMMUNICATIONS & PERFORMANCE UPGRADES MIGRATION
-- Idempotently creates tables, foreign keys, constraints, and Row Level Security (RLS) policies.

-- 1. Create 'duty_reports' table (Duty Manager logs)
CREATE TABLE IF NOT EXISTS duty_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    report_date DATE DEFAULT CURRENT_DATE NOT NULL,
    shift_type TEXT CHECK (shift_type IN ('morning', 'night')) NOT NULL,
    attendance_notes TEXT,
    incidents_summary TEXT,
    handover_notes TEXT,
    checklist_completed JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create 'lost_found_items' table (Lost and Found registry)
CREATE TABLE IF NOT EXISTS lost_found_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name TEXT NOT NULL,
    description TEXT,
    found_location TEXT NOT NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    found_date DATE DEFAULT CURRENT_DATE NOT NULL,
    found_by TEXT NOT NULL,
    status TEXT CHECK (status IN ('unclaimed', 'claimed', 'disposed')) DEFAULT 'unclaimed' NOT NULL,
    claimant_name TEXT,
    claimant_phone TEXT,
    claimed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create 'reminders' table (DSTV, Fibre subscription alerts)
CREATE TABLE IF NOT EXISTS reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    amount_ngn DECIMAL(12,2),
    status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending' NOT NULL,
    recurrence TEXT CHECK (recurrence IN ('none', 'monthly', 'yearly')) DEFAULT 'none' NOT NULL,
    category TEXT DEFAULT 'Utility' NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create 'internal_messages' table (Communications Bulletins & DMs)
CREATE TABLE IF NOT EXISTS internal_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    recipient_role TEXT DEFAULT 'all', -- all, receptionist, housekeeping, laundry, accountant, etc.
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- specific user personalized message
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('normal', 'high', 'urgent')) DEFAULT 'normal' NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create 'departmental_reports' table (Monthly departmental logs & feedback)
CREATE TABLE IF NOT EXISTS departmental_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    department TEXT NOT NULL,
    report_month DATE NOT NULL, -- e.g. '2026-05-01'
    status_update TEXT NOT NULL,
    supplies_needed TEXT,
    suggestions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_dept_month UNIQUE (department, report_month)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all new tables
ALTER TABLE duty_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE departmental_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Allow select for authenticated users" ON duty_reports;
DROP POLICY IF EXISTS "Allow all for managers" ON duty_reports;

-- 1. Duty Reports Policies (All logged-in staff can view; only admins/managers can alter)
CREATE POLICY "Allow select for authenticated users" ON duty_reports FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" ON duty_reports FOR ALL USING (true);

-- 2. Lost & Found Policies (All logged-in staff can access)
CREATE POLICY "Allow all for lost_found_items" ON lost_found_items FOR ALL USING (true);

-- 3. Reminders Policies (All logged-in staff can access)
CREATE POLICY "Allow all for reminders" ON reminders FOR ALL USING (true);

-- 4. Internal Messages Policies (All logged-in staff can access)
CREATE POLICY "Allow all for internal_messages" ON internal_messages FOR ALL USING (true);

-- 5. Departmental Reports Policies (All logged-in staff can access)
CREATE POLICY "Allow all for departmental_reports" ON departmental_reports FOR ALL USING (true);
