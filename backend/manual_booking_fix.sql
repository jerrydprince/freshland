-- Migration: Add manual guest fields to bookings
-- Purpose: Allows receptionists to create walk-in/manual bookings without needing to generate an auth.users record.

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- We don't drop the `guest_id` constraint because we still want registered users to link their bookings to their profile!
-- We just rely on `guest_id` being NULL for walk-ins.
