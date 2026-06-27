-- DYNAMIC PRICING & RATE MANAGEMENT MODULE UPDATE SCRIPT
-- Please run this script in your Supabase SQL Editor.

-- 1. Create room_pricing_model ENUM
CREATE TYPE room_pricing_model AS ENUM ('per_night', 'per_guest', 'per_room', 'per_occupancy');

-- 2. Modify pricing_rule_type ENUM
-- Since we can't directly add multiple values in one line easily without errors if they exist, 
-- we use ALTER TYPE ADD VALUE IF NOT EXISTS
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'early_bird';
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'last_minute';
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'promotional';
ALTER TYPE pricing_rule_type ADD VALUE IF NOT EXISTS 'long_stay';

-- 3. Modify rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS pricing_model room_pricing_model DEFAULT 'per_night'::room_pricing_model NOT NULL,
ADD COLUMN IF NOT EXISTS base_guests INTEGER DEFAULT 2;

-- 4. Create rate_plans table
CREATE TABLE IF NOT EXISTS rate_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- e.g., 'refundable', 'non_refundable', 'standard'
  price_adjustment_percentage DECIMAL(5,2) DEFAULT 0.00, -- e.g. -10.00 for non-refundable
  cancellation_policy TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL, -- 'percentage' or 'flat'
  discount_value DECIMAL(12,2) NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  usage_limit INTEGER DEFAULT null,
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Add coupon support to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discount_amount_ngn DECIMAL(12,2) DEFAULT 0;

-- 7. RLS Policies
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rate plans are viewable by everyone." ON rate_plans FOR SELECT USING (true);
CREATE POLICY "Only admins can modify rate plans" ON rate_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

CREATE POLICY "Coupons are viewable by everyone." ON coupons FOR SELECT USING (true);
CREATE POLICY "Only admins can modify coupons" ON coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 8. Seed Default Rate Plans
INSERT INTO rate_plans (name, description, type, price_adjustment_percentage, cancellation_policy) VALUES
('Standard Flexible Rate', 'Free cancellation up to 24 hours before check-in', 'refundable', 0.00, 'Free cancellation before 24h'),
('Non-Refundable', 'Save 10% on your booking. No refunds for cancellations or modifications.', 'non_refundable', -10.00, 'Strictly non-refundable');
