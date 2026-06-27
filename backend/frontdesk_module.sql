-- LUXE APARTMENT PMS - FRONT DESK MODULE MIGRATION

-- Enhance the bookings table with new columns for professional check-in workflow
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS key_issued BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signature_data TEXT, -- Base64 encoded signature image or path
ADD COLUMN IF NOT EXISTS registered_visitors JSONB DEFAULT '[]'::jsonb; -- Track in-house visitors

-- Note: The RLS policies on bookings were already set to 'Allow All' in the previous rls_booking_fix.sql
-- so these new columns can be updated directly without any new policies.
