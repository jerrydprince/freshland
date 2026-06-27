-- SQL Migration for System Data Reset
-- These functions are created as SECURITY DEFINER to bypass RLS and allow deletion of auth.users
-- ONLY super_admin should ever be able to trigger this from the frontend (frontend will verify).
-- We also verify the role inside the function just to be extremely secure.

-- 1. Reset Accounting Data
CREATE OR REPLACE FUNCTION reset_accounting_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  DELETE FROM public.deleted_payments_audit WHERE true;
  DELETE FROM public.daily_closures WHERE true;
  DELETE FROM public.refund_settlements WHERE true;
  DELETE FROM public.payments WHERE true;
  DELETE FROM public.staff_salaries WHERE true;
  DELETE FROM public.expenses WHERE true;
END;
$$;

-- 2. Reset Booking Data
CREATE OR REPLACE FUNCTION reset_booking_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  DELETE FROM public.booking_services WHERE true;
  DELETE FROM public.invoices WHERE true;
  DELETE FROM public.bookings WHERE true;
  
  DELETE FROM public.hall_booking_meals WHERE true;
  DELETE FROM public.hall_bookings WHERE true;
  
  DELETE FROM public.group_accounts WHERE true;
END;
$$;

-- 3. Reset Maintenance Data
CREATE OR REPLACE FUNCTION reset_maintenance_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  DELETE FROM public.maintenance_payments WHERE true;
  DELETE FROM public.maintenance_purchases WHERE true;
  DELETE FROM public.maintenance_tickets WHERE true;
END;
$$;

-- 4. Reset Staff Data (Keeps super_admin)
CREATE OR REPLACE FUNCTION reset_staff_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  -- Delete staff attendances and leave applications to avoid FK issues
  DELETE FROM public.staff_attendance WHERE true;
  DELETE FROM public.leave_applications WHERE true;

  -- Delete all profiles that are NOT super_admin AND NOT guest
  -- This includes managers, receptionists, accountants, etc.
  -- Guests are kept in this function (reset_guest_directory_data handles them)
  
  -- We delete from auth.users which should cascade to profiles
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT id FROM public.profiles WHERE role != 'super_admin' AND role != 'guest' AND role IS NOT NULL
  );
  
  -- Fallback manual deletion just in case no cascade exists
  DELETE FROM public.profiles WHERE role != 'super_admin' AND role != 'guest' AND role IS NOT NULL;
END;
$$;

-- 5. Reset Logs Data
CREATE OR REPLACE FUNCTION reset_logs_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  DELETE FROM public.store_logs WHERE true;
  DELETE FROM public.departmental_reports WHERE true;
  DELETE FROM public.duty_reports WHERE true;
  DELETE FROM public.notification_logs WHERE true;
  DELETE FROM public.system_logs WHERE true;
  DELETE FROM public.lost_found_items WHERE true;
  -- DELETE FROM public.audit_logs WHERE true; -- Table may not exist yet
END;
$$;

-- 6. Reset Guest Directory Data
CREATE OR REPLACE FUNCTION reset_guest_directory_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  DELETE FROM public.communication_logs WHERE true;
  DELETE FROM public.ar_accounts WHERE true;
  DELETE FROM public.crm_guests WHERE true;
  
  -- Delete guest profiles from auth.users (cascades to profiles)
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT id FROM public.profiles WHERE role = 'guest'
  );
  
  -- Fallback
  DELETE FROM public.profiles WHERE role = 'guest';
END;
$$;

-- 7. Master Reset (All Operational Data)
CREATE OR REPLACE FUNCTION reset_all_operational_data(caller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only super_admin can perform data wipes.';
  END IF;

  -- We call all the functions sequentially
  PERFORM public.reset_accounting_data(caller_id);
  PERFORM public.reset_booking_data(caller_id);
  PERFORM public.reset_maintenance_data(caller_id);
  PERFORM public.reset_staff_data(caller_id);
  PERFORM public.reset_logs_data(caller_id);
  PERFORM public.reset_guest_directory_data(caller_id);
  
  -- Reset room statuses back to clean & available
  UPDATE public.rooms SET status = 'available' WHERE true;
END;
$$;
