-- LUXE APARTMENT PMS - BILLING & PAYMENT MODULE MIGRATION

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate_percent DECIMAL(5,2) DEFAULT 7.5,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  status invoice_status DEFAULT 'draft'::invoice_status NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Modify Payments Table to handle invoice relationships and partials/refunds
-- (payments was created in enterprise_schema_v2.sql)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. RLS Prototype Override
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all selects for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all inserts for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all updates for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all deletes for invoices" ON invoices;

CREATE POLICY "Allow all selects for invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for invoices" ON invoices FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for invoices" ON invoices FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow all selects for payments" ON payments;
DROP POLICY IF EXISTS "Allow all inserts for payments" ON payments;
DROP POLICY IF EXISTS "Allow all updates for payments" ON payments;
DROP POLICY IF EXISTS "Allow all deletes for payments" ON payments;

CREATE POLICY "Allow all selects for payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for payments" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for payments" ON payments FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for payments" ON payments FOR DELETE USING (true);

-- 4. Auto-Generate Invoice Trigger
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
DECLARE
  calculated_subtotal DECIMAL(12,2);
  calculated_tax DECIMAL(12,2);
  tax_rate DECIMAL(5,2) := 7.5;
  inv_number TEXT;
BEGIN
  -- Subtotal is raw room stay cost + raw services cost (before discount and before tax)
  calculated_subtotal := GREATEST(0, NEW.total_room_price_ngn + NEW.total_extras_price_ngn);
  
  -- VAT is 7.5% calculated on the discounted net subtotal
  calculated_tax := GREATEST(0, (calculated_subtotal - COALESCE(NEW.discount_amount_ngn, 0)) * (tax_rate/100));
  
  inv_number := 'INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 4);

  INSERT INTO invoices (booking_id, invoice_number, due_date, subtotal, tax_rate_percent, tax_amount, total_amount, amount_paid, status)
  VALUES (
    NEW.id,
    inv_number,
    NEW.check_in_date, -- due on check-in
    calculated_subtotal,
    tax_rate,
    calculated_tax,
    NEW.total_amount_ngn, -- already calculated with tax in frontend
    NEW.amount_paid_ngn,
    CASE 
      WHEN NEW.amount_paid_ngn >= NEW.total_amount_ngn THEN 'paid'::invoice_status
      WHEN NEW.amount_paid_ngn > 0 THEN 'partial'::invoice_status
      ELSE 'draft'::invoice_status
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_invoice ON bookings;
CREATE TRIGGER trigger_auto_invoice
AFTER INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION auto_generate_invoice();

-- 5. Backfill existing bookings that don't have invoices
INSERT INTO invoices (booking_id, invoice_number, due_date, subtotal, tax_rate_percent, tax_amount, total_amount, amount_paid, status)
SELECT 
  id,
  'INV-' || to_char(created_at, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 4),
  check_in_date,
  total_amount_ngn / 1.075,
  7.5,
  total_amount_ngn - (total_amount_ngn / 1.075),
  total_amount_ngn,
  amount_paid_ngn,
  CASE 
    WHEN amount_paid_ngn >= total_amount_ngn THEN 'paid'::invoice_status
    WHEN amount_paid_ngn > 0 THEN 'partial'::invoice_status
    ELSE 'draft'::invoice_status
  END
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.booking_id = b.id);

-- 6. Automatic Booking Cancellation Trigger to erase invoices, payments, and booking services
CREATE OR REPLACE FUNCTION public.handle_booking_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
    -- Completely erase corresponding invoices from folios/billing
    DELETE FROM public.invoices WHERE booking_id = NEW.id;
    
    -- Completely erase corresponding payments from general ledger
    DELETE FROM public.payments WHERE booking_id = NEW.id;
    
    -- Completely erase corresponding booking services from active boards and folios
    DELETE FROM public.booking_services WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_cancellation ON public.bookings;
CREATE TRIGGER trg_booking_cancellation
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_cancellation();
