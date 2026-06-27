-- =========================================================================
-- SECURE AUTHENTICATION & PROFILE AUTOMATION
-- =========================================================================

-- 1. Create a function to automatically handle new user signups
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
    'guest'::user_role, -- Default everyone to guest
    NEW.email
  );
  RETURN NEW;
END;
$$;


-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- ADMIN PROMOTION HELPER
-- =========================================================================
-- Use this query to manually promote your account after you register:
-- UPDATE profiles SET role = 'super_admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com');

-- =========================================================================
-- REMOVE PROTOTYPE RLS BYPASS
-- =========================================================================
-- Now that real auth is active, drop the open policies to restore enterprise security
DROP POLICY IF EXISTS "Prototype full access rooms" ON rooms;
DROP POLICY IF EXISTS "Prototype full access properties" ON properties;
DROP POLICY IF EXISTS "Prototype full access bookings" ON bookings;
DROP POLICY IF EXISTS "Prototype full access housekeeping_tasks" ON housekeeping_tasks;
DROP POLICY IF EXISTS "Prototype full access maintenance_tickets" ON maintenance_tickets;
DROP POLICY IF EXISTS "Prototype full access cms_pages" ON cms_pages;
DROP POLICY IF EXISTS "Prototype full access system_settings" ON system_settings;
DROP POLICY IF EXISTS "Prototype full access crm_guests" ON crm_guests;
DROP POLICY IF EXISTS "Prototype full access communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Prototype full access invoices" ON invoices;
DROP POLICY IF EXISTS "Prototype full access payments" ON payments;
DROP POLICY IF EXISTS "Prototype full access staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Prototype full access system_logs" ON system_logs;
DROP POLICY IF EXISTS "Prototype full access pricing_rules" ON pricing_rules;
DROP POLICY IF EXISTS "Prototype full access role_permissions" ON role_permissions;
