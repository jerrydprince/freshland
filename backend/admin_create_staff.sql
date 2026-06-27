CREATE OR REPLACE FUNCTION admin_create_staff(
  new_email TEXT,
  new_password TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_role user_role,
  p_username TEXT,
  p_address TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  caller_role TEXT;
BEGIN
  -- Verify the caller is a super_admin
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins can add staff.';
  END IF;

  new_user_id := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id::text, new_email)::jsonb,
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Update public.profiles (since the auth trigger automatically created it)
  UPDATE profiles SET
    first_name = p_first_name,
    last_name = p_last_name,
    phone = p_phone,
    role = p_role,
    email = new_email,
    username = p_username,
    residential_address = p_address,
    is_active = true
  WHERE id = new_user_id;

  RETURN new_user_id;
END;
$$;
