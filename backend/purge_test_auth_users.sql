-- =========================================================================
-- LUXE APARTMENT PMS - MOCK & TEST ACCOUNTS PURGE MIGRATION
-- Run this script inside your Supabase Dashboard SQL Editor.
-- This script completely purges all testing-related database entries,
-- including test bookings, ledger entries, communication logs, CRM profiles,
-- and authentication accounts, to keep the system clean and performant.
-- =========================================================================

-- 1. Identify test emails list
-- 'temp_admin_1780787789880@example.com', 'test@example.com', 'testuser@gmail.com',
-- 'testuser@example.com', 'sparklestestnotify@yopmail.com', 'newadmin@sparkles.com',
-- 'jerry@example.com', 'john.doe@example.com', 'testguest_updated@luxe.com',
-- 'reset_admin_1779632355019@luxe.com', 'temp_admin_1779631475077@luxe.com'

-- Create a temporary table of target test IDs to simplify lookups
CREATE TEMP TABLE target_test_users AS
SELECT id, email 
FROM auth.users 
WHERE email IN (
    'temp_admin_1780787789880@example.com',
    'test@example.com',
    'testuser@gmail.com',
    'testuser@example.com',
    'sparklestestnotify@yopmail.com',
    'newadmin@sparkles.com',
    'jerry@example.com',
    'john.doe@example.com',
    'testguest_updated@luxe.com',
    'reset_admin_1779632355019@luxe.com',
    'temp_admin_1779631475077@luxe.com'
);

-- Also add profiles that might match test emails directly
CREATE TEMP TABLE target_test_profiles AS
SELECT id, email 
FROM public.profiles 
WHERE email IN (
    'temp_admin_1780787789880@example.com',
    'test@example.com',
    'testuser@gmail.com',
    'testuser@example.com',
    'sparklestestnotify@yopmail.com',
    'newadmin@sparkles.com',
    'jerry@example.com',
    'john.doe@example.com',
    'testguest_updated@luxe.com',
    'reset_admin_1779632355019@luxe.com',
    'temp_admin_1779631475077@luxe.com'
) OR id IN (SELECT id FROM target_test_users);

-- 2. Delete test CRM communication logs
DELETE FROM public.communication_logs
WHERE crm_guest_id IN (
    SELECT id FROM public.crm_guests 
    WHERE email IN (
        'temp_admin_1780787789880@example.com',
        'test@example.com',
        'testuser@gmail.com',
        'testuser@example.com',
        'sparklestestnotify@yopmail.com',
        'newadmin@sparkles.com',
        'jerry@example.com',
        'john.doe@example.com',
        'testguest_updated@luxe.com',
        'reset_admin_1779632355019@luxe.com',
        'temp_admin_1779631475077@luxe.com'
    ) OR profile_id IN (SELECT id FROM target_test_profiles)
);

-- 3. Delete payments linked to test bookings
DELETE FROM public.payments
WHERE booking_id IN (
    SELECT id FROM public.bookings 
    WHERE guest_id IN (SELECT id FROM target_test_profiles)
);

-- 4. Delete booking extras linked to test bookings
DELETE FROM public.booking_extras
WHERE booking_id IN (
    SELECT id FROM public.bookings 
    WHERE guest_id IN (SELECT id FROM target_test_profiles)
);

-- 5. Delete bookings linked to test profiles
DELETE FROM public.bookings
WHERE guest_id IN (SELECT id FROM target_test_profiles);

-- 6. Delete test CRM guest cards
DELETE FROM public.crm_guests
WHERE email IN (
    'temp_admin_1780787789880@example.com',
    'test@example.com',
    'testuser@gmail.com',
    'testuser@example.com',
    'sparklestestnotify@yopmail.com',
    'newadmin@sparkles.com',
    'jerry@example.com',
    'john.doe@example.com',
    'testguest_updated@luxe.com',
    'reset_admin_1779632355019@luxe.com',
    'temp_admin_1779631475077@luxe.com'
) OR profile_id IN (SELECT id FROM target_test_profiles);

-- 7. Delete test accounts from public.profiles
DELETE FROM public.profiles 
WHERE id IN (SELECT id FROM target_test_profiles);

-- 8. Delete test accounts from auth.users (this cascades to auth.identities)
DELETE FROM auth.users 
WHERE id IN (SELECT id FROM target_test_users);

-- 9. Purge orphaned active user sessions
DELETE FROM public.user_active_sessions 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 10. Clean up temp tables
DROP TABLE target_test_users;
DROP TABLE target_test_profiles;

SELECT '✓ All test accounts and related test bookings successfully cleaned up!' as status;
