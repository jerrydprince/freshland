-- =========================================================================
-- DATABASE MIGRATION: ROBUST TAX CALCULATION & INVOICE SYNC TRIGGERS
-- =========================================================================
-- This script ensures that:
-- 1. Bookings' total_amount_ngn is ALWAYS automatically calculated with 7.5% VAT.
-- 2. Taxes on services are dynamically included based on the service's tax toggle (tax_inclusive column).
-- 3. Invoices are ALWAYS automatically synchronized when booking totals change.
-- 4. Trigger mismatches are prevented.
-- =========================================================================

-- 1. Create function to automatically calculate booking total amount including VAT
CREATE OR REPLACE FUNCTION public.recalculate_booking_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_rate DECIMAL(5,2) := 7.5;
  v_room_subtotal DECIMAL(12,2);
  v_room_tax DECIMAL(12,2);
  v_taxable_extras DECIMAL(12,2);
  v_nontaxable_extras DECIMAL(12,2);
  v_extras_tax DECIMAL(12,2);
BEGIN
  -- Room subtotal is Room price minus discount
  v_room_subtotal := GREATEST(0, COALESCE(NEW.total_room_price_ngn, 0) - COALESCE(NEW.discount_amount_ngn, 0));
  v_room_tax := v_room_subtotal * (v_tax_rate/100);
  
  -- Calculate taxable and nontaxable extras for this booking from booking_services
  SELECT 
    COALESCE(SUM(CASE WHEN s.tax_inclusive = TRUE THEN bs.total_price_ngn ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.tax_inclusive = FALSE THEN bs.total_price_ngn ELSE 0 END), 0)
  INTO v_taxable_extras, v_nontaxable_extras
  FROM public.booking_services bs
  JOIN public.services s ON bs.service_id = s.id
  WHERE bs.booking_id = NEW.id AND bs.status != 'cancelled';
  
  -- Set total extras (sum of base prices of services)
  NEW.total_extras_price_ngn := v_taxable_extras + v_nontaxable_extras;
  
  -- Calculate total tax on extras
  v_extras_tax := v_taxable_extras * (v_tax_rate/100);
  
  -- Set total amount including VAT
  NEW.total_amount_ngn := v_room_subtotal + v_room_tax + (v_taxable_extras + v_extras_tax) + v_nontaxable_extras;
  
  RETURN NEW;
END;
$$;

-- Bind BEFORE trigger to bookings
DROP TRIGGER IF EXISTS trg_recalculate_booking_total ON public.bookings;
CREATE TRIGGER trg_recalculate_booking_total
  BEFORE INSERT OR UPDATE OF total_room_price_ngn, total_extras_price_ngn, discount_amount_ngn ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.recalculate_booking_total();


-- 2. Create function to automatically sync booking updates to invoices
CREATE OR REPLACE FUNCTION public.sync_booking_to_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_rate DECIMAL(5,2) := 7.5;
  v_room_subtotal DECIMAL(12,2);
  v_taxable_extras DECIMAL(12,2);
  v_nontaxable_extras DECIMAL(12,2);
  v_extras_tax DECIMAL(12,2);
  v_subtotal DECIMAL(12,2);
  v_tax DECIMAL(12,2);
BEGIN
  v_room_subtotal := GREATEST(0, COALESCE(NEW.total_room_price_ngn, 0) - COALESCE(NEW.discount_amount_ngn, 0));
  
  -- Calculate taxable and nontaxable extras for this booking
  SELECT 
    COALESCE(SUM(CASE WHEN s.tax_inclusive = TRUE THEN bs.total_price_ngn ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.tax_inclusive = FALSE THEN bs.total_price_ngn ELSE 0 END), 0)
  INTO v_taxable_extras, v_nontaxable_extras
  FROM public.booking_services bs
  JOIN public.services s ON bs.service_id = s.id
  WHERE bs.booking_id = NEW.id AND bs.status != 'cancelled';

  v_extras_tax := v_taxable_extras * (v_tax_rate/100);
  v_subtotal := COALESCE(NEW.total_room_price_ngn, 0) + v_taxable_extras + v_nontaxable_extras;
  v_tax := v_room_subtotal * (v_tax_rate/100) + v_extras_tax;

  -- Update corresponding invoice record
  UPDATE public.invoices
  SET total_amount = NEW.total_amount_ngn,
      subtotal = v_subtotal,
      tax_amount = v_tax,
      amount_paid = NEW.amount_paid_ngn,
      status = CASE 
        WHEN NEW.amount_paid_ngn >= NEW.total_amount_ngn THEN 'paid'::invoice_status
        WHEN NEW.amount_paid_ngn > 0 THEN 'partial'::invoice_status
        ELSE status -- Keep existing status if no over-payment condition
      END,
      updated_at = now()
  WHERE booking_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Bind AFTER trigger to bookings for syncing to invoices
DROP TRIGGER IF EXISTS trg_sync_booking_to_invoice ON public.bookings;
CREATE TRIGGER trg_sync_booking_to_invoice
  AFTER UPDATE OF total_amount_ngn, amount_paid_ngn ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.sync_booking_to_invoice();


-- 3. Redefine sync_booking_services_to_billing trigger function to match
CREATE OR REPLACE FUNCTION public.sync_booking_services_to_billing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_taxable_extras DECIMAL(12,2);
  v_nontaxable_extras DECIMAL(12,2);
  v_total_extras DECIMAL(12,2);
  v_extras_tax DECIMAL(12,2);
  v_total_room DECIMAL(12,2);
  v_discount DECIMAL(12,2);
  v_amount_paid DECIMAL(12,2);
  v_total_amount DECIMAL(12,2);
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

  -- Calculate taxable and nontaxable extras
  SELECT 
    COALESCE(SUM(CASE WHEN s.tax_inclusive = TRUE THEN bs.total_price_ngn ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.tax_inclusive = FALSE THEN bs.total_price_ngn ELSE 0 END), 0)
  INTO v_taxable_extras, v_nontaxable_extras
  FROM public.booking_services bs
  JOIN public.services s ON bs.service_id = s.id
  WHERE bs.booking_id = v_booking_id AND bs.status != 'cancelled';

  v_total_extras := v_taxable_extras + v_nontaxable_extras;
  v_extras_tax := v_taxable_extras * (v_tax_rate/100);

  -- Get current total_room_price_ngn, discount_amount_ngn and amount_paid_ngn from bookings
  SELECT total_room_price_ngn, COALESCE(discount_amount_ngn, 0), amount_paid_ngn INTO v_total_room, v_discount, v_amount_paid
  FROM public.bookings
  WHERE id = v_booking_id;

  -- Calculate subtotal, tax and total amount with tax
  v_subtotal := GREATEST(0, COALESCE(v_total_room, 0) + v_total_extras);
  v_tax := GREATEST(0, COALESCE(v_total_room, 0) - v_discount) * (v_tax_rate/100) + v_extras_tax;
  v_total_amount := GREATEST(0, COALESCE(v_total_room, 0) - v_discount) * (1 + v_tax_rate/100) + v_taxable_extras + v_extras_tax + v_nontaxable_extras;

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

-- Force reload PGRST cache
NOTIFY pgrst, 'reload schema';
