-- =========================================================================
-- DATABASE MIGRATION: GUEST SERVICE REQUESTS PAYMENT & BILLING WORKFLOW
-- =========================================================================
-- This script adds workflow columns to `booking_services` and implements
-- automatic sync to bookings, invoices, and accounting when a service is requested.
-- =========================================================================

-- 1. Add workflow columns to booking_services table
ALTER TABLE public.booking_services
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' NOT NULL,
ADD COLUMN IF NOT EXISTS notified_finance BOOLEAN DEFAULT false NOT NULL;

-- 2. Create trigger function to automatically sync booking_services to bookings and invoices
CREATE OR REPLACE FUNCTION public.sync_booking_services_to_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_total_extras DECIMAL(12,2);
  v_total_room DECIMAL(12,2);
  v_discount DECIMAL(12,2);
  v_total_amount DECIMAL(12,2);
  v_amount_paid DECIMAL(12,2);
  v_tax_rate DECIMAL(5,2) := 7.5;
  v_subtotal DECIMAL(12,2);
  v_tax DECIMAL(12,2);
BEGIN
  -- Determine booking ID based on operation
  IF TG_OP = 'DELETE' THEN
    v_booking_id := OLD.booking_id;
  ELSE
    v_booking_id := NEW.booking_id;
  END IF;

  -- 1. Calculate new total extras (sum of all active, non-cancelled services)
  SELECT COALESCE(SUM(total_price_ngn), 0) INTO v_total_extras
  FROM public.booking_services
  WHERE booking_id = v_booking_id AND status != 'cancelled';

  -- Get current total_room_price_ngn, discount_amount_ngn and amount_paid_ngn from bookings
  SELECT total_room_price_ngn, COALESCE(discount_amount_ngn, 0), amount_paid_ngn INTO v_total_room, v_discount, v_amount_paid
  FROM public.bookings
  WHERE id = v_booking_id;

  v_subtotal := GREATEST(0, COALESCE(v_total_room, 0) + v_total_extras);
  v_tax := GREATEST(0, (v_subtotal - COALESCE(v_discount, 0)) * (v_tax_rate/100));
  v_total_amount := (v_subtotal - COALESCE(v_discount, 0)) + v_tax;

  -- 2. Update bookings record
  UPDATE public.bookings
  SET total_extras_price_ngn = v_total_extras,
      total_amount_ngn = v_total_amount,
      payment_status = CASE 
        WHEN v_amount_paid >= v_total_amount THEN 'paid'
        WHEN v_amount_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      updated_at = now()
  WHERE id = v_booking_id;

  -- 3. Update or generate corresponding invoice record
  -- Check if invoice exists
  IF EXISTS (SELECT 1 FROM public.invoices WHERE booking_id = v_booking_id) THEN
    UPDATE public.invoices
    SET total_amount = v_total_amount,
        subtotal = v_subtotal,
        tax_amount = v_tax,
        amount_paid = v_amount_paid,
        status = CASE 
          WHEN v_amount_paid >= v_total_amount THEN 'paid'::invoice_status
          WHEN v_amount_paid > 0 THEN 'partial'::invoice_status
          ELSE 'sent'::invoice_status
        END,
        updated_at = now()
    WHERE booking_id = v_booking_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Create AFTER trigger on booking_services for INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trg_sync_booking_services_to_billing ON public.booking_services;
CREATE TRIGGER trg_sync_booking_services_to_billing
  AFTER INSERT OR UPDATE OR DELETE ON public.booking_services
  FOR EACH ROW EXECUTE PROCEDURE public.sync_booking_services_to_billing();

-- 4. Mark existing services as 'paid' if they were already scheduled/completed
UPDATE public.booking_services
SET payment_status = 'paid'
WHERE status IN ('scheduled', 'in_progress', 'completed');

-- 5. Force reload PGRST cache
NOTIFY pgrst, 'reload schema';
