-- =========================================================================
-- LUXE ENTERPRISE PMS - V2 SCHEMA UPGRADE
-- =========================================================================
-- This script upgrades the base MVP schema to the massive 15-Module Enterprise level.
-- It is idempotent (safe to run multiple times).

-- -------------------------------------------------------------------------
-- 1. NEW ENUMS & CUSTOM TYPES
-- -------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE housekeeping_status AS ENUM ('pending', 'cleaning', 'inspected', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_status AS ENUM ('reported', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('stripe', 'paystack', 'paypal', 'bank_transfer', 'pos', 'cash');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS & CONFIGURATION (Module 1)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------------------
-- 3. MULTI-PROPERTY MANAGEMENT (Module 2)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  base_currency TEXT DEFAULT 'NGN',
  tax_rate_percent DECIMAL(5,2) DEFAULT 7.5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Headquarters Property if none exists
INSERT INTO properties (name, address, city, state, country)
SELECT 'Luxe Headquarters', '123 Luxury Avenue', 'Lagos', 'Lagos', 'Nigeria'
WHERE NOT EXISTS (SELECT 1 FROM properties);

-- -------------------------------------------------------------------------
-- 4. ROOMS & INVENTORY ENHANCEMENTS (Module 2)
-- -------------------------------------------------------------------------
-- Altering existing rooms table safely
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bed_type TEXT DEFAULT 'King';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Update existing rooms to attach to HQ
UPDATE rooms SET property_id = (SELECT id FROM properties LIMIT 1) WHERE property_id IS NULL;

-- -------------------------------------------------------------------------
-- 5. GUEST CRM & FRONT DESK ENHANCEMENTS (Modules 5 & 6)
-- -------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vip_status BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance_ngn DECIMAL(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- -------------------------------------------------------------------------
-- 6. DYNAMIC PRICING ENGINE (Module 4)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  room_type TEXT, -- Applies to all rooms of this type
  rule_name TEXT NOT NULL, -- e.g., 'Holiday Surcharge', 'Weekend Rate'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  modifier_value DECIMAL(10,2) NOT NULL,
  modifier_type TEXT NOT NULL CHECK (modifier_type IN ('percentage', 'fixed_amount')),
  is_active BOOLEAN DEFAULT true
);

-- -------------------------------------------------------------------------
-- 7. HOUSEKEEPING & MAINTENANCE (Module 7)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  housekeeper_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status housekeeping_status DEFAULT 'pending'::housekeeping_status NOT NULL,
  task_type TEXT DEFAULT 'checkout_cleaning', -- e.g., deep_cleaning, daily_refresh
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority maintenance_priority DEFAULT 'medium'::maintenance_priority NOT NULL,
  issue_category TEXT NOT NULL, -- e.g., 'Plumbing', 'Electrical'
  description TEXT NOT NULL,
  status maintenance_status DEFAULT 'reported'::maintenance_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- -------------------------------------------------------------------------
-- 8. BILLING & PAYMENTS (Module 8)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Receptionist who processed it (if POS/Cash)
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  method payment_method NOT NULL,
  transaction_ref TEXT UNIQUE, -- Gateway reference
  status payment_status DEFAULT 'pending'::payment_status NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  receipt_url TEXT
);

-- -------------------------------------------------------------------------
-- 9. AUDIT & SECURITY LOGS (Module 15) - Unified System Logs
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- SECURITY & RLS POLICIES FOR NEW TABLES
-- -------------------------------------------------------------------------
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Basic Public/Admin read access to properties
CREATE POLICY "Properties are viewable by everyone" ON properties FOR SELECT USING (true);
CREATE POLICY "Admins manage properties" ON properties FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- Housekeeping Access
CREATE POLICY "Housekeepers view own tasks" ON housekeeping_tasks FOR SELECT USING (
  auth.uid() = housekeeper_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Housekeepers update own tasks" ON housekeeping_tasks FOR UPDATE USING (
  auth.uid() = housekeeper_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- Authenticated users can view system logs, anonymous/authenticated can insert
DROP POLICY IF EXISTS "Allow authenticated selects for system_logs" ON system_logs;
CREATE POLICY "Allow authenticated selects for system_logs" ON system_logs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow anonymous inserts for system_logs" ON system_logs;
CREATE POLICY "Allow anonymous inserts for system_logs" ON system_logs FOR INSERT WITH CHECK (true);

-- =========================================================================
-- V2 SCHEMA UPGRADE COMPLETE
-- =========================================================================
