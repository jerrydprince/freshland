-- =========================================================================
-- DATABASE CREDENTIALS UPDATE SCRIPT (SAFE FLOW)
-- =========================================================================
-- Run this script inside your Supabase Dashboard SQL Editor to:
-- 1. Free jerrydprince@gmail.com email by updating Chidi Eboh's email and password.
-- 2. Update Super Admin Jerry Nosike's credentials (email & password).
-- 3. Safely clean up any manual auth table inserts for pawpaw@gmail.com.
-- 4. Update Pawpaw Pawww's email in the CRM to pawpaw@gmail.com so they can be provisioned.
-- =========================================================================

-- 1. Clean up any corrupted manual auth records for pawpaw@gmail.com
DELETE FROM auth.users WHERE email = 'pawpaw@gmail.com';


-- 2. Update Chidi Eboh (Guest) first to free up the email jerrydprince@gmail.com
UPDATE auth.users
SET email = 'chidieboh@gmail.com',
    encrypted_password = crypt('Chidi2026.', gen_salt('bf')),
    email_confirmed_at = now()
WHERE id = 'c3c0698f-d7f1-4293-bb48-a167b65795ec';

UPDATE auth.identities
SET identity_data = jsonb_build_object('sub', 'c3c0698f-d7f1-4293-bb48-a167b65795ec'::text, 'email', 'chidieboh@gmail.com')
WHERE user_id = 'c3c0698f-d7f1-4293-bb48-a167b65795ec';

UPDATE public.profiles
SET email = 'chidieboh@gmail.com'
WHERE id = 'c3c0698f-d7f1-4293-bb48-a167b65795ec';

UPDATE public.crm_guests
SET email = 'chidieboh@gmail.com'
WHERE profile_id = 'c3c0698f-d7f1-4293-bb48-a167b65795ec' OR email = 'jerrydprince@gmail.com';


-- 3. Update Super Admin Jerry Nosike to jerrydprince@gmail.com
UPDATE auth.users
SET email = 'jerrydprince@gmail.com',
    encrypted_password = crypt('Jerry08283139', gen_salt('bf')),
    email_confirmed_at = now()
WHERE id = '0bd40892-38bb-423f-aa99-caa192572522';

UPDATE auth.identities
SET identity_data = jsonb_build_object('sub', '0bd40892-38bb-423f-aa99-caa192572522'::text, 'email', 'jerrydprince@gmail.com')
WHERE user_id = '0bd40892-38bb-423f-aa99-caa192572522';

UPDATE public.profiles
SET email = 'jerrydprince@gmail.com'
WHERE id = '0bd40892-38bb-423f-aa99-caa192572522';


-- 4. Set Pawpaw Pawww's email in CRM Guest directory to pawpaw@gmail.com
-- (This allows the admin to provision their login account cleanly via the CRM Dashboard)
UPDATE public.crm_guests
SET email = 'pawpaw@gmail.com',
    profile_id = NULL
WHERE id = 'b9580788-7698-4f6e-b7fe-4408c6a33197';
