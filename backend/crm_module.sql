-- LUXE APARTMENT PMS - CRM MODULE MIGRATION

-- 1. Create CRM Guests Table
CREATE TABLE IF NOT EXISTS crm_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Optional link if they have an online account
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  id_document_url TEXT,
  vip_status BOOLEAN DEFAULT false,
  segment TEXT DEFAULT 'standard', -- e.g., standard, corporate, frequent, VIP
  loyalty_points INTEGER DEFAULT 0,
  wallet_balance DECIMAL(12,2) DEFAULT 0,
  preferences JSONB DEFAULT '{}'::jsonb, -- Store allergies, floor preferences, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Communication Logs Table
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_guest_id UUID REFERENCES crm_guests(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  category TEXT NOT NULL, -- 'booking_confirmation', 'payment_reminder', 'review_request', 'abandoned_cart', 'custom'
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Modify Bookings Table to link to CRM
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS crm_guest_id UUID REFERENCES crm_guests(id) ON DELETE SET NULL;

-- 4. Set up RLS for new tables
ALTER TABLE crm_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- Allow operations for the prototype (same logic as the recent fix)
CREATE POLICY "Allow all selects for crm_guests" ON crm_guests FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for crm_guests" ON crm_guests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for crm_guests" ON crm_guests FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for crm_guests" ON crm_guests FOR DELETE USING (true);

CREATE POLICY "Allow all selects for communication_logs" ON communication_logs FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for communication_logs" ON communication_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for communication_logs" ON communication_logs FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for communication_logs" ON communication_logs FOR DELETE USING (true);

-- 5. Seed initial mock data for testing
INSERT INTO crm_guests (first_name, last_name, email, phone, nationality, vip_status, segment, loyalty_points, wallet_balance, preferences)
VALUES 
('James', 'Carter', 'james.carter@example.com', '+2348000000001', 'United States', true, 'VIP', 1250, 50000, '{"allergies": "peanuts", "floor": "high", "room_temp": "22C"}'),
('Sarah', 'Okeke', 'sarah.o@example.com', '+2348000000002', 'Nigeria', false, 'corporate', 400, 0, '{"newspaper": "daily", "late_checkout": true}'),
('Michael', 'Chen', 'm.chen@example.com', '+447000000003', 'United Kingdom', false, 'standard', 0, 0, '{}');

-- End of migration
