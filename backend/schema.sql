-- LUXE APARTMENT BOOKING PMS SCHEMA

-- 1. ENUMS (Custom Types)
CREATE TYPE user_role AS ENUM ('super_admin', 'hotel_manager', 'receptionist', 'housekeeping', 'accountant', 'guest');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE extra_pricing_type AS ENUM ('fixed', 'per_person', 'per_person_per_night');
CREATE TYPE booking_source AS ENUM ('online', 'manual', 'phone', 'walk_in', 'group');
CREATE TYPE pricing_rule_type AS ENUM ('seasonal', 'weekend', 'holiday', 'occupancy');

-- 2. PROFILES (Extends Supabase Auth Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role user_role DEFAULT 'guest'::user_role NOT NULL,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ROOMS & INVENTORY
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'Penthouse', 'Studio'
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 2,
  size_sqm INTEGER,
  base_price_ngn DECIMAL(12,2) NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  image_url TEXT,
  status room_status DEFAULT 'available'::room_status NOT NULL,
  min_stay_days INTEGER DEFAULT 1,
  max_stay_days INTEGER DEFAULT 30,
  allowed_check_in_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  allowed_check_out_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. EXTRA SERVICES
CREATE TABLE extra_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_ngn DECIMAL(10,2) NOT NULL,
  pricing_type extra_pricing_type NOT NULL,
  icon_name TEXT, -- Lucide icon reference
  is_active BOOLEAN DEFAULT true
);

-- 5. BOOKINGS (Reservations)
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_reference TEXT UNIQUE NOT NULL, -- e.g., 'LUXE-8A2F'
  guest_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  special_requests TEXT,
  status booking_status DEFAULT 'pending'::booking_status NOT NULL,
  booking_source booking_source DEFAULT 'online'::booking_source NOT NULL,
  group_reference TEXT,
  total_room_price_ngn DECIMAL(12,2) NOT NULL,
  total_extras_price_ngn DECIMAL(12,2) DEFAULT 0,
  total_amount_ngn DECIMAL(12,2) NOT NULL,
  amount_paid_ngn DECIMAL(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, partial, paid, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. BOOKING EXTRAS (Many-to-Many mapping)
CREATE TABLE booking_extras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES extra_services(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  calculated_price_ngn DECIMAL(10,2) NOT NULL
);

-- 6.5 PRICING RULES (Dynamic Pricing)
CREATE TABLE pricing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type pricing_rule_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  adjustment_percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CMS: PAGES
CREATE TABLE cms_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. CMS: GALLERY
CREATE TABLE cms_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 9. CMS: TESTIMONIALS
CREATE TABLE cms_testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  quote TEXT NOT NULL,
  stay_date TEXT,
  rating INTEGER DEFAULT 5,
  is_published BOOLEAN DEFAULT false
);

-- 10. CMS: FAQ
CREATE TABLE cms_faq (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);


-- ROW LEVEL SECURITY (RLS) POLICIES --
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Rooms RLS
CREATE POLICY "Rooms are viewable by everyone." ON rooms FOR SELECT USING (true);
CREATE POLICY "Only admins can modify rooms" ON rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- Pricing Rules RLS
CREATE POLICY "Pricing rules are viewable by everyone." ON pricing_rules FOR SELECT USING (true);
CREATE POLICY "Only admins can modify pricing rules" ON pricing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- Bookings RLS
CREATE POLICY "Guests can view their own bookings" ON bookings FOR SELECT USING (
  auth.uid() = guest_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Guests can insert their own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = guest_id);

-- SEED MOCK DATA
INSERT INTO rooms (room_number, name, type, capacity, size_sqm, base_price_ngn, amenities, image_url) VALUES 
('PH-01', 'Premium Penthouse Suite', 'Suite', 4, 120, 150000, ARRAY['Ocean View', 'Private Balcony', 'King Bed'], 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9'),
('ST-10', 'Luxury Studio Apartment', 'Studio', 2, 65, 85000, ARRAY['City View', 'Queen Bed', 'Kitchenette'], 'https://images.unsplash.com/photo-1502672260266-1c1de2d9d0d9');

INSERT INTO extra_services (name, description, price_ngn, pricing_type, icon_name) VALUES 
('Premium Breakfast', 'Continental luxury breakfast', 15000, 'per_person_per_night', 'Coffee'),
('Airport Pickup', 'Private chauffeur to/from airport', 35000, 'fixed', 'Car'),
('Spa Access', 'Full day pass to wellness spa', 25000, 'per_person', 'Wind');
