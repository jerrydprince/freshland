-- =========================================================================
-- ROOM STATUS & PAWPAW BOOKINGS SYNCHRONIZATION
-- =========================================================================
-- Run this script inside your Supabase Dashboard SQL Editor to:
-- 1. Synchronize room statuses to 'occupied' for all rooms that currently have checked-in guests.
-- 2. Link all historic Pawpaw bookings to his new authenticated profile and email.
-- =========================================================================

-- 1. Link Guest Pawpaw Pawww's historic bookings to his provisioned profile (055db666-5be2-4af0-9b45-f4da43372483)
-- and update the guest email to pawpaw@gmail.com.
-- This ensures they instantly show up in his Guest Dashboard booking history.
UPDATE public.bookings
SET guest_id = '055db666-5be2-4af0-9b45-f4da43372483',
    guest_email = 'pawpaw@gmail.com'
WHERE crm_guest_id = 'b9580788-7698-4f6e-b7fe-4408c6a33197';


-- 2. Synchronize room statuses for all active checked-in bookings in the property.
-- This changes any room that has an active 'checked_in' guest to 'occupied'.
UPDATE public.rooms r
SET status = 'occupied'
FROM public.bookings b
WHERE b.room_id = r.id AND b.status = 'checked_in';
