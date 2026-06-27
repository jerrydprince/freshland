-- LUXE APARTMENT PMS - GROUP BOOKINGS & CORPORATE BILLING MIGRATION
-- Adds group accounts (Companies, Agencies, Churches, Groups) and links them to bookings with automated balance syncing.

-- 1. Create the Group Accounts table
CREATE TABLE IF NOT EXISTS group_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  group_type TEXT CHECK (group_type IN ('Company', 'Government Agency', 'Church', 'Group', 'Other')) NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  credit_limit DECIMAL(12,2) DEFAULT 1000000.00 CHECK (credit_limit >= 0),
  outstanding_balance DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE group_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select group_accounts" ON group_accounts;
DROP POLICY IF EXISTS "Public insert group_accounts" ON group_accounts;
DROP POLICY IF EXISTS "Public update group_accounts" ON group_accounts;
DROP POLICY IF EXISTS "Public delete group_accounts" ON group_accounts;

CREATE POLICY "Public select group_accounts" ON group_accounts FOR SELECT USING (true);
CREATE POLICY "Public insert group_accounts" ON group_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update group_accounts" ON group_accounts FOR UPDATE USING (true);
CREATE POLICY "Public delete group_accounts" ON group_accounts FOR ALL USING (true);

-- 3. Alter bookings table to support group linkage and group billing options
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_account_id UUID REFERENCES group_accounts(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bill_to_group BOOLEAN DEFAULT false;

-- 4. Create database trigger function to automatically update group account outstanding balances
CREATE OR REPLACE FUNCTION sync_group_booking_billing()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle inserts
  IF TG_OP = 'INSERT' THEN
    IF NEW.bill_to_group = true AND NEW.group_account_id IS NOT NULL THEN
      UPDATE group_accounts 
      SET outstanding_balance = outstanding_balance + NEW.total_amount_ngn
      WHERE id = NEW.group_account_id;
    END IF;
  
  -- Handle updates
  ELSIF TG_OP = 'UPDATE' THEN
    -- If it was previously billed to a group, deduct the old booking amount first
    IF OLD.bill_to_group = true AND OLD.group_account_id IS NOT NULL THEN
      UPDATE group_accounts 
      SET outstanding_balance = outstanding_balance - OLD.total_amount_ngn
      WHERE id = OLD.group_account_id;
    END IF;

    -- If it is currently billed to a group, add the new booking amount
    IF NEW.bill_to_group = true AND NEW.group_account_id IS NOT NULL THEN
      UPDATE group_accounts 
      SET outstanding_balance = outstanding_balance + NEW.total_amount_ngn
      WHERE id = NEW.group_account_id;
    END IF;
  
  -- Handle deletes
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.bill_to_group = true AND OLD.group_account_id IS NOT NULL THEN
      UPDATE group_accounts 
      SET outstanding_balance = outstanding_balance - OLD.total_amount_ngn
      WHERE id = OLD.group_account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind the billing sync trigger to the bookings table
DROP TRIGGER IF EXISTS trigger_sync_group_booking_billing ON bookings;
CREATE TRIGGER trigger_sync_group_booking_billing
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION sync_group_booking_billing();

-- 5. Seed standard mock group/corporate profiles
INSERT INTO group_accounts (name, group_type, contact_name, contact_email, contact_phone, credit_limit, outstanding_balance)
VALUES
('Chevron Nigeria Limited', 'Company', 'Kunle Johnson', 'k.johnson@chevron.com', '+234 803 111 2222', 3000000.00, 0.00),
('Federal Ministry of Finance', 'Government Agency', 'Director Alao', 'info@finance.gov.ng', '+234 805 333 4444', 5000000.00, 0.00),
('Redeemed Christian Church of God', 'Church', 'Pastor Enoch', 'camp@rccg.org', '+234 809 555 6666', 1500000.00, 0.00),
('Shell Petroleum Development Co.', 'Company', 'Grace Udemba', 'g.udemba@shell.com', '+234 802 777 8888', 4000000.00, 0.00),
('Sparkles Family Reunion Group', 'Group', 'Chief Jerry', 'jerry@sparklesgroup.com', '+234 801 999 0000', 500000.00, 0.00)
ON CONFLICT (name) DO NOTHING;
