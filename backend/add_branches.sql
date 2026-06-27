-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Prototype Override for branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all selects for prototype branches" ON branches;
DROP POLICY IF EXISTS "Allow all inserts for prototype branches" ON branches;
DROP POLICY IF EXISTS "Allow all updates for prototype branches" ON branches;
DROP POLICY IF EXISTS "Allow all deletes for prototype branches" ON branches;

CREATE POLICY "Allow all selects for prototype branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for prototype branches" ON branches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for prototype branches" ON branches FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for prototype branches" ON branches FOR DELETE USING (true);

-- Add branch_id to rooms table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
