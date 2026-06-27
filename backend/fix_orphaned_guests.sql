-- LUXE APARTMENT PMS - ORPHANED STAFF & GUEST PROFILE SYNC MIGRATION

-- 1. Update the handle_new_user function to automatically sync email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Guest'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    'guest'::user_role,
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 2. Backfill email addresses from auth.users for existing profiles where it's currently NULL
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
