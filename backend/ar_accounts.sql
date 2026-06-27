-- Create ar_accounts table
CREATE TABLE IF NOT EXISTS ar_accounts (
  id TEXT PRIMARY KEY, -- String primary key supporting generated prefixes like 'ar_'
  guest_id UUID REFERENCES crm_guests(id) ON DELETE SET NULL, -- References crm_guests
  guest_name TEXT,
  guest_email TEXT,
  balance DECIMAL(12,2) DEFAULT 0.00,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE ar_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all selects for ar_accounts" ON ar_accounts;
DROP POLICY IF EXISTS "Allow all inserts for ar_accounts" ON ar_accounts;
DROP POLICY IF EXISTS "Allow all updates for ar_accounts" ON ar_accounts;
DROP POLICY IF EXISTS "Allow all deletes for ar_accounts" ON ar_accounts;

-- Recreate policies to allow prototype access (matching crm_guests logic)
CREATE POLICY "Allow all selects for ar_accounts" ON ar_accounts FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for ar_accounts" ON ar_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for ar_accounts" ON ar_accounts FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for ar_accounts" ON ar_accounts FOR DELETE USING (true);
