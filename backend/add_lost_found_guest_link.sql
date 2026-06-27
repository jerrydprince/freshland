-- LUXE APARTMENT PMS - LOST & FOUND GUEST LINKAGE MIGRATION
-- Adds booking_id and guest_notified columns to lost_found_items for complete CRM tracking.

ALTER TABLE lost_found_items ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE lost_found_items ADD COLUMN IF NOT EXISTS guest_notified BOOLEAN DEFAULT false;
