-- =========================================================================
-- LUXE APARTMENT PMS - UNWANTED TEST RECORDS CLEANUP MIGRATION
-- This script purges temporary, dynamic admin records and dummy test guest
-- profiles from Supabase Auth (`auth.users`), which automatically cascade
-- and clean up their corresponding references in the `public.profiles` table.
-- =========================================================================

-- 1. Delete unwanted test/temp admin profiles from auth.users (cascades to public.profiles)
DELETE FROM auth.users 
WHERE email IN (
    'testguest_updated@luxe.com', 
    'reset_admin_1779632355019@luxe.com', 
    'temp_admin_1779631475077@luxe.com'
);

-- 2. Optional: Clean up any test communication logs or orphaned active sessions
DELETE FROM public.user_active_sessions 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 3. Confirm clean output
SELECT '✓ Unwanted test database records cleaned up successfully!' as status;
