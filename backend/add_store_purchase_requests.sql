-- LUXE APARTMENT PMS - MIGRATION FOR STORE PURCHASE REQUESTS & RETIREMENT WORKFLOW
-- Idempotently creates store_purchase_requests table and configures RLS policies.

CREATE TABLE IF NOT EXISTS store_purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES store_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    estimated_cost DECIMAL(12,2) DEFAULT 0 CHECK (estimated_cost >= 0),
    purchaser_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    purchaser_name TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending_purchase' CHECK (status IN ('pending_purchase', 'completed_retired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    retired_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    retired_by TEXT DEFAULT NULL
);

-- Enable Row Level Security
ALTER TABLE store_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted access for prototype contexts
DROP POLICY IF EXISTS "Public select store_purchase_requests" ON store_purchase_requests;
DROP POLICY IF EXISTS "Public insert store_purchase_requests" ON store_purchase_requests;
DROP POLICY IF EXISTS "Public update store_purchase_requests" ON store_purchase_requests;
DROP POLICY IF EXISTS "Public delete store_purchase_requests" ON store_purchase_requests;

CREATE POLICY "Public select store_purchase_requests" ON store_purchase_requests FOR SELECT USING (true);
CREATE POLICY "Public insert store_purchase_requests" ON store_purchase_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update store_purchase_requests" ON store_purchase_requests FOR UPDATE USING (true);
CREATE POLICY "Public delete store_purchase_requests" ON store_purchase_requests FOR ALL USING (true);

-- Seed a couple of mock purchase requests
INSERT INTO store_purchase_requests (item_name, quantity, estimated_cost, purchaser_name, notes, status)
VALUES
('Luxury Bath Rugs (White)', 20, 75000.00, 'Jerry Purchaser', 'Urgent restocking request for premium suite master bathrooms.', 'pending_purchase'),
('Egyptian Linens 800TC', 15, 120000.00, 'Jerry Purchaser', 'Procurement for presidential suite upgrades.', 'pending_purchase')
ON CONFLICT DO NOTHING;
