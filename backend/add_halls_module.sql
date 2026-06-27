-- Migration: Add Halls and Hall Bookings System

BEGIN;

-- 1. Create Halls Table
CREATE TABLE IF NOT EXISTS public.halls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL,
  size_sqm INTEGER,
  description TEXT,
  base_price_ngn DECIMAL(12,2) NOT NULL, -- Daily Rate
  hourly_price_ngn DECIMAL(12,2) NOT NULL, -- Hourly Rate
  amenities TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Hall Meal Options Table (Separate meal menu for halls)
CREATE TABLE IF NOT EXISTS public.hall_meal_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- e.g., "Standard Breakfast Tea"
  course_type TEXT NOT NULL, -- 'Breakfast Tea', 'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Drinks', 'Appetizers'
  combination_items TEXT[] DEFAULT '{}', -- e.g., ['Tea', 'Snacks', 'Fruits']
  price_per_participant_ngn DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Hall Bookings Table
CREATE TABLE IF NOT EXISTS public.hall_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_reference TEXT UNIQUE NOT NULL, -- e.g., 'HALL-XXXX'
  guest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  organization_name TEXT,
  hall_id UUID REFERENCES public.halls(id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL, -- Start date
  booking_type TEXT NOT NULL CHECK (booking_type IN ('daily', 'hourly')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  num_days INTEGER DEFAULT 1 NOT NULL,
  num_hours INTEGER,
  number_of_participants INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  booking_source TEXT DEFAULT 'online' NOT NULL CHECK (booking_source IN ('online', 'front_office')),
  total_hall_price_ngn DECIMAL(12,2) NOT NULL,
  total_meals_price_ngn DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_amount_ngn DECIMAL(12,2) NOT NULL,
  amount_paid_ngn DECIMAL(12,2) DEFAULT 0 NOT NULL,
  payment_status TEXT DEFAULT 'unpaid' NOT NULL CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Hall Booking Meals Table (Kitchen routed)
CREATE TABLE IF NOT EXISTS public.hall_booking_meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hall_booking_id UUID REFERENCES public.hall_bookings(id) ON DELETE CASCADE,
  meal_option_id UUID REFERENCES public.hall_meal_options(id) ON DELETE RESTRICT,
  course_type TEXT NOT NULL,
  serving_date DATE NOT NULL,
  price_per_participant_ngn DECIMAL(12,2) NOT NULL,
  number_of_participants INTEGER NOT NULL,
  total_price_ngn DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add columns to Invoices and Payments for Hall Bookings
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS hall_booking_id UUID REFERENCES public.hall_bookings(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS hall_booking_id UUID REFERENCES public.hall_bookings(id) ON DELETE CASCADE;

-- 6. RLS Setup for new tables
ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_meal_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_booking_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all selects for halls" ON public.halls FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for halls" ON public.halls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for halls" ON public.halls FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for halls" ON public.halls FOR DELETE USING (true);

CREATE POLICY "Allow all selects for hall_meal_options" ON public.hall_meal_options FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for hall_meal_options" ON public.hall_meal_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for hall_meal_options" ON public.hall_meal_options FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for hall_meal_options" ON public.hall_meal_options FOR DELETE USING (true);

CREATE POLICY "Allow all selects for hall_bookings" ON public.hall_bookings FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for hall_bookings" ON public.hall_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for hall_bookings" ON public.hall_bookings FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for hall_bookings" ON public.hall_bookings FOR DELETE USING (true);

CREATE POLICY "Allow all selects for hall_booking_meals" ON public.hall_booking_meals FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for hall_booking_meals" ON public.hall_booking_meals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for hall_booking_meals" ON public.hall_booking_meals FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for hall_booking_meals" ON public.hall_booking_meals FOR DELETE USING (true);

-- 7. Add default halls and hall meals (Seed data)
INSERT INTO public.halls (name, capacity, size_sqm, base_price_ngn, hourly_price_ngn, description, amenities)
VALUES 
  ('Executive Boardroom', 20, 45, 120000.00, 15000.00, 'A premium boardroom perfect for executive meetings, equipped with a smart screen, high-speed Wi-Fi, and conferencing facilities.', ARRAY['Smart Screen', 'Wi-Fi', 'Air Conditioning', 'Conferencing Unit']),
  ('Grand Banquet Hall', 250, 400, 450000.00, 50000.00, 'Spacious hall suitable for banquets, weddings, and large corporate conferences. Includes built-in projector, stage, and PA system.', ARRAY['Projector', 'PA System', 'Stage', 'Wi-Fi', 'Air Conditioning'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.hall_meal_options (name, course_type, combination_items, price_per_participant_ngn)
VALUES
  ('Standard Breakfast Tea', 'Breakfast Tea', ARRAY['Tea', 'Snacks', 'Fruits'], 4500.00),
  ('Premium Breakfast Tea', 'Breakfast Tea', ARRAY['Tea', 'Coffee', 'Pancakes', 'Sausages', 'Fruits'], 6500.00),
  ('Continental Breakfast', 'Breakfast', ARRAY['Bread', 'Butter', 'Eggs', 'Juice', 'Coffee'], 6000.00),
  ('Nigerian Buffet Lunch', 'Lunch', ARRAY['Jollof Rice', 'Fried Rice', 'Beef/Chicken', 'Salad', 'Soft Drink'], 8500.00),
  ('International Buffet Dinner', 'Dinner', ARRAY['Grilled Fish', 'Steak', 'Pasta', 'Sides', 'Dessert', 'Wine/Soft Drink'], 12500.00)
ON CONFLICT (name) DO NOTHING;

-- 8. Trigger to auto-generate invoices for hall bookings (similar to room bookings)
CREATE OR REPLACE FUNCTION auto_generate_hall_invoice()
RETURNS TRIGGER AS $$
DECLARE
  calculated_subtotal DECIMAL(12,2);
  calculated_tax DECIMAL(12,2);
  tax_rate DECIMAL(5,2) := 7.5;
  inv_number TEXT;
BEGIN
  calculated_subtotal := NEW.total_hall_price_ngn + NEW.total_meals_price_ngn;
  calculated_tax := calculated_subtotal * (tax_rate/100);
  inv_number := 'INV-HALL-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 4);

  INSERT INTO invoices (hall_booking_id, invoice_number, due_date, subtotal, tax_rate_percent, tax_amount, total_amount, amount_paid, status)
  VALUES (
    NEW.id,
    inv_number,
    NEW.booking_date,
    calculated_subtotal,
    tax_rate,
    calculated_tax,
    NEW.total_amount_ngn,
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

DROP TRIGGER IF EXISTS trigger_auto_hall_invoice ON hall_bookings;
CREATE TRIGGER trigger_auto_hall_invoice
AFTER INSERT ON hall_bookings
FOR EACH ROW
EXECUTE FUNCTION auto_generate_hall_invoice();

COMMIT;
