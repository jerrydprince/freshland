-- 1. Add 'is_active' column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Create the SECURITY DEFINER function to update auth credentials
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
    -- 1. Update auth.users
    UPDATE auth.users 
    SET email = new_email, 
        email_change = '', 
        email_confirmed_at = COALESCE(email_confirmed_at, now()) 
    WHERE id = target_user_id;

    -- 2. Update auth.identities
    UPDATE auth.identities 
    SET identity_data = jsonb_build_object('sub', target_user_id::text, 'email', new_email)
    WHERE user_id = target_user_id AND provider = 'email';

    -- 3. Update public.profiles
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
