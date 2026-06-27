-- BOOKING ENGINE MODULE UPDATE SCRIPT
-- Please run this script in your Supabase SQL Editor to update your database.

-- 1. Modify existing ENUMs
-- PostgreSQL doesn't allow adding to an ENUM using CREATE OR REPLACE TYPE directly if it's used.
-- The safest way to add a value to an ENUM is using ALTER TYPE.
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'no_show';

-- 2. Create new ENUMs
CREATE TYPE booking_source AS ENUM ('online', 'manual', 'phone', 'walk_in', 'group');
CREATE TYPE pricing_rule_type AS ENUM ('seasonal', 'weekend', 'holiday', 'occupancy');

-- 3. Modify rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS min_stay_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_stay_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS allowed_check_in_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
ADD COLUMN IF NOT EXISTS allowed_check_out_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}';

-- 4. Modify bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_source booking_source DEFAULT 'online'::booking_source NOT NULL,
ADD COLUMN IF NOT EXISTS group_reference TEXT;

-- 5. Create pricing_rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- if null, applies to all rooms
  name TEXT NOT NULL,
  type pricing_rule_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  adjustment_percentage DECIMAL(5,2) NOT NULL, -- e.g., 20.00 for +20%, -10.00 for -10%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. RLS for pricing_rules
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing rules are viewable by everyone." 
ON pricing_rules FOR SELECT USING (true);

CREATE POLICY "Only admins can modify pricing rules" 
ON pricing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
