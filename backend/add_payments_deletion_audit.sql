-- LUXE APARTMENT PMS - MIGRATION FOR DELETED TRANSACTIONS AUDITING & RESTORATION
-- Idempotently creates deleted_payments_audit table and configures the automatic deletion backup trigger.

CREATE TABLE IF NOT EXISTS deleted_payments_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID NOT NULL,
    booking_id UUID,
    processed_by UUID,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    method TEXT,
    transaction_ref TEXT,
    status TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    receipt_url TEXT,
    notes TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_by TEXT DEFAULT 'Unknown Admin'
);

-- Enable RLS
ALTER TABLE deleted_payments_audit ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted access for prototype contexts
DROP POLICY IF EXISTS "Public select deleted_payments_audit" ON deleted_payments_audit;
DROP POLICY IF EXISTS "Public insert deleted_payments_audit" ON deleted_payments_audit;
DROP POLICY IF EXISTS "Public update deleted_payments_audit" ON deleted_payments_audit;
DROP POLICY IF EXISTS "Public delete deleted_payments_audit" ON deleted_payments_audit;

CREATE POLICY "Public select deleted_payments_audit" ON deleted_payments_audit FOR SELECT USING (true);
CREATE POLICY "Public insert deleted_payments_audit" ON deleted_payments_audit FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update deleted_payments_audit" ON deleted_payments_audit FOR UPDATE USING (true);
CREATE POLICY "Public delete deleted_payments_audit" ON deleted_payments_audit FOR ALL USING (true);

-- Create trigger function to automatically capture deleted payments
CREATE OR REPLACE FUNCTION log_deleted_payment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO deleted_payments_audit (
        payment_id,
        booking_id,
        processed_by,
        amount,
        currency,
        method,
        transaction_ref,
        status,
        processed_at,
        receipt_url,
        notes,
        deleted_at
    ) VALUES (
        OLD.id,
        OLD.booking_id,
        OLD.processed_by,
        OLD.amount,
        OLD.currency,
        OLD.method::text,
        OLD.transaction_ref,
        OLD.status::text,
        OLD.processed_at,
        OLD.receipt_url,
        OLD.notes,
        now()
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on payments table
DROP TRIGGER IF EXISTS trigger_log_deleted_payment ON payments;
CREATE TRIGGER trigger_log_deleted_payment
BEFORE DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION log_deleted_payment();
