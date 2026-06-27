-- =========================================================================
-- DATABASE CORRECTION SCRIPT: AUTOMATICALLY BACKFILL & SYNC CRM GUEST PROFILES
-- =========================================================================
-- Run this script inside your Supabase Dashboard SQL Editor to:
-- 1. Backfill and create CRM guest profiles for all historic bookings.
-- 2. Link all existing booking records back to their CRM guest profiles.
-- 3. Create a permanent trigger to auto-create CRM profiles for future bookings.
-- =========================================================================

-- 1. Create a permanent BEFORE INSERT trigger function on bookings
CREATE OR REPLACE FUNCTION public.sync_booking_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crm_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_space_idx INTEGER;
BEGIN
  -- Split guest_name into first_name and last_name
  IF NEW.guest_name IS NOT NULL AND NEW.guest_name != '' THEN
    v_space_idx := position(' ' in NEW.guest_name);
    IF v_space_idx > 0 THEN
      v_first_name := substring(NEW.guest_name from 1 for v_space_idx - 1);
      v_last_name := substring(NEW.guest_name from v_space_idx + 1);
    ELSE
      v_first_name := NEW.guest_name;
      v_last_name := 'Guest';
    END IF;
  ELSE
    v_first_name := 'Guest';
    v_last_name := 'User';
  END IF;

  -- Only perform sync if guest_email is provided
  IF NEW.guest_email IS NOT NULL AND NEW.guest_email != '' THEN
    -- Check if a CRM guest already exists with this email
    SELECT id INTO v_crm_id 
    FROM public.crm_guests 
    WHERE LOWER(email) = LOWER(NEW.guest_email) 
    LIMIT 1;

    -- If it exists, update the profile_id link and use it
    IF v_crm_id IS NOT NULL THEN
      UPDATE public.crm_guests 
      SET profile_id = COALESCE(profile_id, NEW.guest_id),
          phone = COALESCE(phone, NEW.guest_phone)
      WHERE id = v_crm_id;
      
      NEW.crm_guest_id := v_crm_id;
    ELSE
      -- If it does not exist, insert a new CRM guest profile
      INSERT INTO public.crm_guests (
        first_name,
        last_name,
        email,
        phone,
        profile_id,
        nationality,
        segment,
        vip_status,
        loyalty_points,
        wallet_balance
      ) VALUES (
        v_first_name,
        v_last_name,
        LOWER(NEW.guest_email),
        COALESCE(NEW.guest_phone, ''),
        NEW.guest_id,
        'Nigeria',
        'standard',
        false,
        10,
        0
      )
      RETURNING id INTO v_crm_id;
      
      NEW.crm_guest_id := v_crm_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on bookings
DROP TRIGGER IF EXISTS trg_sync_booking_to_crm ON public.bookings;
CREATE TRIGGER trg_sync_booking_to_crm
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.sync_booking_to_crm();


-- 2. Backfill CRM guest profiles for all historic bookings currently in the system
DO $$
DECLARE
  r RECORD;
  v_crm_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_space_idx INTEGER;
BEGIN
  FOR r IN 
    SELECT DISTINCT ON (LOWER(guest_email)) id, guest_name, guest_email, guest_phone, guest_id
    FROM public.bookings
    WHERE guest_email IS NOT NULL AND guest_email != ''
  LOOP
    -- Check if already exists in crm_guests
    SELECT id INTO v_crm_id FROM public.crm_guests WHERE LOWER(email) = LOWER(r.guest_email) LIMIT 1;
    
    IF v_crm_id IS NULL THEN
      -- Parse names
      v_space_idx := position(' ' in r.guest_name);
      IF v_space_idx > 0 THEN
        v_first_name := substring(r.guest_name from 1 for v_space_idx - 1);
        v_last_name := substring(r.guest_name from v_space_idx + 1);
      ELSE
        v_first_name := r.guest_name;
        v_last_name := 'Guest';
      END IF;

      -- Insert missing profile
      INSERT INTO public.crm_guests (
        first_name,
        last_name,
        email,
        phone,
        profile_id,
        nationality,
        segment,
        vip_status,
        loyalty_points,
        wallet_balance
      ) VALUES (
        v_first_name,
        v_last_name,
        LOWER(r.guest_email),
        COALESCE(r.guest_phone, ''),
        r.guest_id,
        'Nigeria',
        'standard',
        false,
        10,
        0
      )
      RETURNING id INTO v_crm_id;
    END IF;

    -- Link crm_guest_id for all existing bookings matching this email
    UPDATE public.bookings 
    SET crm_guest_id = v_crm_id 
    WHERE LOWER(guest_email) = LOWER(r.guest_email) AND crm_guest_id IS NULL;

  END LOOP;
END $$;
