-- LUXE APARTMENT PMS - GUEST SERVICES MODULE

DO $$ 
BEGIN
    -- 1. Create Enums for Services (Safe creation)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_pricing_type') THEN
        CREATE TYPE service_pricing_type AS ENUM ('fixed', 'per_person', 'per_day', 'per_night', 'per_booking', 'quantity_based', 'time_based');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_status') THEN
        CREATE TYPE service_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');
    END IF;

    -- 2. Services Master Table
    CREATE TABLE IF NOT EXISTS services (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        code TEXT UNIQUE,
        base_price_ngn DECIMAL(12,2) NOT NULL DEFAULT 0,
        pricing_type service_pricing_type NOT NULL DEFAULT 'fixed',
        icon_name TEXT DEFAULT 'Star',
        image_url TEXT,
        tax_inclusive BOOLEAN DEFAULT true,
        discount_eligible BOOLEAN DEFAULT true,
        scheduling_required BOOLEAN DEFAULT false,
        quantity_selector BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        internal_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 3. Booking Services Junction Table (Replaces booking_extras)
    CREATE TABLE IF NOT EXISTS booking_services (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
        quantity INTEGER DEFAULT 1,
        unit_price_ngn DECIMAL(12,2) NOT NULL,
        total_price_ngn DECIMAL(12,2) NOT NULL,
        scheduled_date DATE,
        scheduled_time TIME,
        notes TEXT,
        status service_status DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 4. Service Staff Assignments
    CREATE TABLE IF NOT EXISTS service_staff_assignments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        booking_service_id UUID REFERENCES booking_services(id) ON DELETE CASCADE,
        staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        status TEXT DEFAULT 'assigned'
    );

    -- 5. Add Service Permissions to Super Admin and Hotel Manager
    INSERT INTO role_permissions (role, module, has_access) 
    VALUES 
        ('super_admin', 'Guest Services', true),
        ('hotel_manager', 'Guest Services', true),
        ('receptionist', 'Guest Services', true)
    ON CONFLICT (role, module) DO NOTHING;

END $$;

-- 6. Setup Updated At Triggers
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_services_modtime ON services;
CREATE TRIGGER update_services_modtime 
BEFORE UPDATE ON services 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_booking_services_modtime ON booking_services;
CREATE TRIGGER update_booking_services_modtime 
BEFORE UPDATE ON booking_services 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 7. Add Base Services (Seed Data)
INSERT INTO services (name, description, category, base_price_ngn, pricing_type, icon_name, scheduling_required, quantity_selector, is_active)
VALUES 
('Airport Pickup', 'Premium chauffeur service from the airport directly to your suite.', 'Transportation', 25000, 'fixed', 'Car', true, false, true),
('Full English Breakfast', 'A hearty English breakfast delivered to your room or served in the dining area.', 'Food & Beverage', 10000, 'per_person', 'Coffee', false, true, true),
('Laundry Service', 'Professional washing and folding service per clothing item.', 'Housekeeping', 3000, 'quantity_based', 'Shirt', false, true, true),
('Spa & Massage', '60-minute relaxing full-body massage by a certified therapist.', 'Wellness', 40000, 'per_booking', 'Flower2', true, false, true),
('Late Checkout', 'Extend your stay until 4:00 PM without booking an extra night.', 'Room Add-ons', 15000, 'fixed', 'Clock', false, false, true)
ON CONFLICT DO NOTHING;
