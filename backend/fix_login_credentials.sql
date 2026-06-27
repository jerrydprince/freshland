-- =========================================================================
-- DATABASE CORRECTION SCRIPT: FIX GUEST AUTO-SIGNUP & ADMIN EDITING CREDENTIALS
-- =========================================================================
-- Run this script inside your Supabase Dashboard SQL Editor to:
-- 1. Automatically confirm all existing guest and staff accounts in the system.
-- 2. Modify the user creation trigger to auto-confirm all future signups.
-- 3. Upgrade the admin credentials editor to fully synchronize email changes.
-- =========================================================================

-- 1. Confirm emails for all existing users to instantly restore login capability
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- 2. Update user registration trigger to automatically confirm email for all future signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile row
  INSERT INTO public.profiles (id, first_name, last_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Guest'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    'guest'::user_role, -- Default everyone to guest
    NEW.email
  );

  -- Safe direct update to confirm auth email on the fly
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- 3. Upgrade the security definer function to synchronize email changes across all three tables
CREATE OR REPLACE FUNCTION admin_update_staff_auth(
  target_user_id UUID,
  new_email TEXT,
  new_password TEXT,
  new_is_active BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Verify the caller is a super_admin
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins can modify auth credentials.';
  END IF;

  -- Update email if provided
  IF new_email IS NOT NULL AND new_email != '' THEN
    -- A. Update auth.users email
    UPDATE auth.users 
    SET email = new_email, 
        email_change = '', 
        email_confirmed_at = COALESCE(email_confirmed_at, now()) 
    WHERE id = target_user_id;

    -- B. Update auth.identities email so Supabase Auth recognizes the login
    UPDATE auth.identities 
    SET identity_data = jsonb_build_object('sub', target_user_id::text, 'email', new_email)
    WHERE user_id = target_user_id AND provider = 'email';

    -- C. Update public.profiles email
    UPDATE public.profiles 
    SET email = new_email 
    WHERE id = target_user_id;
  END IF;

  -- Update password if provided
  IF new_password IS NOT NULL AND new_password != '' THEN
    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf')) 
    WHERE id = target_user_id;
  END IF;

  -- Update active status and ban status
  IF new_is_active = FALSE THEN
    -- Deactivate
    UPDATE auth.users SET banned_until = '2099-12-31'::timestamp WHERE id = target_user_id;
  ELSE
    -- Activate
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;

  -- Also update the profile is_active
  UPDATE public.profiles SET is_active = new_is_active WHERE id = target_user_id;

END;
$$;
