CREATE OR REPLACE FUNCTION admin_confirm_user_email(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE auth.users SET email_confirmed_at = now() WHERE id = target_user_id;
END;
$$;
