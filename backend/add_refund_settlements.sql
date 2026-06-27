-- Create refund_settlements table to log guest bank details for bank payments
CREATE TABLE IF NOT EXISTS refund_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  refund_amount DECIMAL(12,2) NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE refund_settlements ENABLE ROW LEVEL SECURITY;

-- Allow public access policies (matches other table configurations in the PMS)
DROP POLICY IF EXISTS "Allow all selects for refund_settlements" ON refund_settlements;
DROP POLICY IF EXISTS "Allow all inserts for refund_settlements" ON refund_settlements;
DROP POLICY IF EXISTS "Allow all updates for refund_settlements" ON refund_settlements;
DROP POLICY IF EXISTS "Allow all deletes for refund_settlements" ON refund_settlements;

CREATE POLICY "Allow all selects for refund_settlements" ON refund_settlements FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for refund_settlements" ON refund_settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for refund_settlements" ON refund_settlements FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for refund_settlements" ON refund_settlements FOR DELETE USING (true);
