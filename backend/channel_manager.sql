-- LUXE APARTMENT PMS - CHANNEL MANAGER (iCal) MIGRATION

-- 1. Extend ENUMS
DO $$ BEGIN
    ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'airbnb';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'booking_com';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'expedia';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'agoda';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'hotels_com';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Modify Bookings Table to handle OTA Syncs
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS ota_reference TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS ota_commission_ngn DECIMAL(12,2) DEFAULT 0;

-- 3. Create iCal Links Table
CREATE TABLE IF NOT EXISTS ota_ical_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL, -- e.g., 'airbnb', 'booking_com'
    import_url TEXT, -- The .ics URL we pull from the OTA
    export_token TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 16), -- Generates a unique path for the OTA to pull from us
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status TEXT DEFAULT 'idle', -- 'idle', 'success', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, channel_name)
);

-- RLS Prototype Override
ALTER TABLE ota_ical_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all selects for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "Allow all inserts for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "Allow all updates for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "Allow all deletes for ota_ical_links" ON ota_ical_links;

CREATE POLICY "Allow all selects for ota_ical_links" ON ota_ical_links FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for ota_ical_links" ON ota_ical_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for ota_ical_links" ON ota_ical_links FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for ota_ical_links" ON ota_ical_links FOR DELETE USING (true);

-- Seed existing rooms with blank iCal profiles for Airbnb and Booking.com
INSERT INTO ota_ical_links (room_id, channel_name)
SELECT id, 'airbnb' FROM rooms
ON CONFLICT DO NOTHING;

INSERT INTO ota_ical_links (room_id, channel_name)
SELECT id, 'booking_com' FROM rooms
ON CONFLICT DO NOTHING;
