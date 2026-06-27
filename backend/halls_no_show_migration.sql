-- LUXE APARTMENT PMS - HALLS NO SHOW MIGRATION
-- This script updates the hall_bookings status check constraint to allow the 'no_show' status

BEGIN;

-- 1. Modify hall_bookings status check constraint to allow 'no_show' status
ALTER TABLE public.hall_bookings DROP CONSTRAINT IF EXISTS hall_bookings_status_check;
ALTER TABLE public.hall_bookings ADD CONSTRAINT hall_bookings_status_check 
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'));

COMMIT;
