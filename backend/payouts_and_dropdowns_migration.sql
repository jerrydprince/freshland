-- LUXE APARTMENT PMS - PAYOUTS AND DROPDOWNS MIGRATION
-- This script safely updates status check constraints and creates linking columns in the expenses table.

BEGIN;

-- 1. Modify maintenance_payments check constraint to allow 'approved' status
ALTER TABLE public.maintenance_payments DROP CONSTRAINT IF EXISTS maintenance_payments_payment_status_check;
ALTER TABLE public.maintenance_payments ADD CONSTRAINT maintenance_payments_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'approved'));

-- 2. Modify reminders status check constraint to allow 'approved' status
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_status_check;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check 
  CHECK (status IN ('pending', 'paid', 'cancelled', 'approved'));

-- 3. Add link columns to expenses table safely
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS maintenance_payment_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reminder_id UUID;

-- 4. Update the trigger function auto_sync_maintenance_to_expense to prevent duplicate expenses
CREATE OR REPLACE FUNCTION public.auto_sync_maintenance_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  default_property_id UUID;
  details_desc TEXT;
  receiver_name TEXT;
  existing_id UUID;
BEGIN
  -- Trigger action when payment is marked 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'paid') THEN
    -- Fetch property ID
    SELECT id INTO default_property_id FROM properties ORDER BY created_at LIMIT 1;
    
    -- Compile description and target recipient
    IF NEW.professional_id IS NOT NULL THEN
      SELECT name INTO receiver_name FROM public.maintenance_professionals WHERE id = NEW.professional_id;
      details_desc := 'Maintenance payout to technician: ' || COALESCE(receiver_name, 'Specialist') || '. Notes: ' || COALESCE(NEW.notes, 'None');
    ELSIF NEW.purchase_id IS NOT NULL THEN
      SELECT ('Procured maintenance stock: ' || item_name || ' x' || quantity) INTO details_desc FROM public.maintenance_purchases WHERE id = NEW.purchase_id;
      receiver_name := 'Maintenance Procurement Vendor';
    ELSE
      details_desc := 'General maintenance disbursement. ' || COALESCE(NEW.notes, '');
      receiver_name := 'Maintenance Vendor';
    END IF;

    -- Check if a pending expense already exists for this maintenance payment
    SELECT id INTO existing_id FROM public.expenses WHERE maintenance_payment_id = NEW.id LIMIT 1;

    IF existing_id IS NOT NULL THEN
      -- Update existing expense status to paid and lock transaction info
      UPDATE public.expenses
      SET status = 'paid',
          expense_date = COALESCE(NEW.paid_at::date, CURRENT_DATE),
          payment_method = NEW.payment_method,
          description = details_desc || ' | Ref: ' || COALESCE(NEW.transaction_reference, 'N/A')
      WHERE id = existing_id;
    ELSE
      -- Log transaction directly into general ledger expenses table (fallback)
      INSERT INTO public.expenses (property_id, amount, category, description, expense_date, paid_to, payment_method, status, maintenance_payment_id)
      VALUES (
        default_property_id,
        NEW.amount_ngn,
        'Maintenance',
        details_desc || ' | Ref: ' || COALESCE(NEW.transaction_reference, 'N/A'),
        COALESCE(NEW.paid_at::date, CURRENT_DATE),
        COALESCE(receiver_name, 'Maintenance Vendor'),
        NEW.payment_method,
        'paid',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
