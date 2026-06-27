-- 1. Create Maintenance Professionals Directory Table
CREATE TABLE IF NOT EXISTS maintenance_professionals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    trade_specialty TEXT NOT NULL, -- e.g., 'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Masonry', 'General Repair'
    type TEXT DEFAULT 'external' CHECK (type IN ('internal', 'external')),
    hourly_rate DECIMAL(12,2) DEFAULT 0 CHECK (hourly_rate >= 0),
    rating DECIMAL(3,2) DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Maintenance Purchases & Procurements Table
CREATE TABLE IF NOT EXISTS maintenance_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES maintenance_tickets(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_ngn DECIMAL(12,2) NOT NULL CHECK (cost_ngn >= 0),
    merchant_name TEXT,
    purchaser_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    purchaser_name TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 3. Create Maintenance Payments & Disbursements Table
CREATE TABLE IF NOT EXISTS maintenance_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID REFERENCES maintenance_purchases(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES maintenance_tickets(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES maintenance_professionals(id) ON DELETE SET NULL,
    amount_ngn DECIMAL(12,2) NOT NULL CHECK (amount_ngn >= 0),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'pos')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
    transaction_reference TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 4. Enable Row Level Security (RLS) & Bypass Policies
ALTER TABLE maintenance_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for professionals" ON maintenance_professionals;
DROP POLICY IF EXISTS "Allow all for professionals" ON maintenance_professionals;
CREATE POLICY "Allow select for professionals" ON maintenance_professionals FOR SELECT USING (true);
CREATE POLICY "Allow all for professionals" ON maintenance_professionals FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select for purchases" ON maintenance_purchases;
DROP POLICY IF EXISTS "Allow all for purchases" ON maintenance_purchases;
CREATE POLICY "Allow select for purchases" ON maintenance_purchases FOR SELECT USING (true);
CREATE POLICY "Allow all for purchases" ON maintenance_purchases FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select for payments" ON maintenance_payments;
DROP POLICY IF EXISTS "Allow all for payments" ON maintenance_payments;
CREATE POLICY "Allow select for payments" ON maintenance_payments FOR SELECT USING (true);
CREATE POLICY "Allow all for payments" ON maintenance_payments FOR ALL USING (true);

-- 5. Create Auto-sync Trigger function to Accounting Expenses Ledger
CREATE OR REPLACE FUNCTION auto_sync_maintenance_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  default_property_id UUID;
  details_desc TEXT;
  receiver_name TEXT;
BEGIN
  -- Trigger action when payment is marked 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'paid') THEN
    -- Fetch property ID
    SELECT id INTO default_property_id FROM properties ORDER BY created_at LIMIT 1;
    
    -- Compile description and target recipient
    IF NEW.professional_id IS NOT NULL THEN
      SELECT name INTO receiver_name FROM maintenance_professionals WHERE id = NEW.professional_id;
      details_desc := 'Maintenance payout to technician: ' || COALESCE(receiver_name, 'Specialist') || '. Notes: ' || COALESCE(NEW.notes, 'None');
    ELSIF NEW.purchase_id IS NOT NULL THEN
      SELECT ('Procured maintenance stock: ' || item_name || ' x' || quantity) INTO details_desc FROM maintenance_purchases WHERE id = NEW.purchase_id;
      receiver_name := 'Maintenance Procurement Vendor';
    ELSE
      details_desc := 'General maintenance disbursement. ' || COALESCE(NEW.notes, '');
      receiver_name := 'Maintenance Vendor';
    END IF;

    -- Log transaction directly into general ledger expenses table
    INSERT INTO expenses (property_id, amount, category, description, expense_date, paid_to, payment_method, status)
    VALUES (
      default_property_id,
      NEW.amount_ngn,
      'Maintenance',
      details_desc || ' | Ref: ' || COALESCE(NEW.transaction_reference, 'N/A'),
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      COALESCE(receiver_name, 'Maintenance Vendor'),
      NEW.payment_method,
      'paid'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_maintenance_expense ON maintenance_payments;
CREATE TRIGGER trigger_sync_maintenance_expense
AFTER UPDATE ON maintenance_payments
FOR EACH ROW
EXECUTE FUNCTION auto_sync_maintenance_to_expense();

-- 6. Add assignment and cost tracking columns to maintenance_tickets table safely
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_professional_id UUID REFERENCES maintenance_professionals(id) ON DELETE SET NULL;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2) DEFAULT 0;

-- 7. Seed Initial Mock Data
INSERT INTO maintenance_professionals (name, phone, email, trade_specialty, type, hourly_rate, rating) VALUES
('Abiodun Electricals Ltd', '08031234567', 'abiodun@gmail.com', 'Electrical', 'external', 15000.00, 4.8),
('Chioma HVAC Services', '08129876543', 'chioma.hvac@luxe.com', 'HVAC', 'external', 18000.00, 4.9),
('Jerry Tech (Internal)', '08055554433', 'jerry.tech@sparkles.com', 'General Repair', 'internal', 0.00, 5.0)
ON CONFLICT DO NOTHING;
