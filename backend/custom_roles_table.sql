-- Sparkles Apartments PMS - Dynamic Custom Roles Database Schema Extension
-- 
-- PostgreSQL Migration Guide:
-- Due to dependency tracking, row-level security (RLS) policies referencing columns 
-- must be temporarily dropped before those columns can undergo a TYPE alteration.
-- Once the type is changed, the policies are recreated cleanly using the new TEXT role type.

BEGIN;

-- ----------------------------------------------------
-- STEP 1: DROP ALL POLICIES THAT REFERENCE 'profiles.role'
-- ----------------------------------------------------

-- 1. Policies on 'pricing_rules'
DROP POLICY IF EXISTS "Only admins can modify pricing rules" ON public.pricing_rules;

-- 2. Policies on 'rooms'
DROP POLICY IF EXISTS "Only admins can modify rooms" ON public.rooms;

-- 3. Policies on 'rate_plans'
DROP POLICY IF EXISTS "Only admins can modify rate plans" ON public.rate_plans;

-- 4. Policies on 'coupons'
DROP POLICY IF EXISTS "Only admins can modify coupons" ON public.coupons;

-- 5. Policies on 'properties'
DROP POLICY IF EXISTS "Admins manage properties" ON public.properties;

-- 6. Policies on 'bookings'
DROP POLICY IF EXISTS "Guests can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Only admins can delete bookings" ON public.bookings;

-- 7. Policies on 'invoices'
DROP POLICY IF EXISTS "Staff can view invoices and payments" ON public.invoices;
DROP POLICY IF EXISTS "Staff can manage invoices and payments" ON public.invoices;

-- 8. Policies on 'payments'
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payments;

-- 9. Policies on 'housekeeping_tasks'
DROP POLICY IF EXISTS "Staff can view housekeeping" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Housekeeping and admins can update" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Only admins can delete housekeeping" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Housekeepers view own tasks" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Housekeepers update own tasks" ON public.housekeeping_tasks;

-- 10. Policies on 'maintenance_tickets'
DROP POLICY IF EXISTS "Staff can view maintenance" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Maintenance and admins can update" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Only admins can delete maintenance" ON public.maintenance_tickets;

-- 11. Policies on 'crm_guests'
DROP POLICY IF EXISTS "Staff can view CRM" ON public.crm_guests;
DROP POLICY IF EXISTS "Front desk and admins manage CRM" ON public.crm_guests;

-- 12. Policies on 'communication_logs'
DROP POLICY IF EXISTS "Staff can view Comm Logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Front desk and admins manage Comm Logs" ON public.communication_logs;

-- 13. Policies on 'staff_attendance'
DROP POLICY IF EXISTS "Staff can view own attendance" ON public.staff_attendance;
DROP POLICY IF EXISTS "Admins manage attendance" ON public.staff_attendance;

-- 14. Policies on 'role_permissions'
DROP POLICY IF EXISTS "Super Admins manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Staff view role permissions" ON public.role_permissions;

-- 15. Policies on 'cms_gallery'
DROP POLICY IF EXISTS "Admins manage CMS" ON public.cms_gallery;

-- 16. Policies on 'ota_ical_links'
DROP POLICY IF EXISTS "Admins manage Channel Manager" ON public.ota_ical_links;

-- 17. Policies on 'system_settings'
DROP POLICY IF EXISTS "Super Admins update system settings" ON public.system_settings;

-- 18. Policies on 'profiles'
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;


-- ----------------------------------------------------
-- STEP 2: PERFORM DATA TYPE ALTERATIONS (user_role enum -> TEXT)
-- ----------------------------------------------------

-- 1. Alter 'profiles.role' type to TEXT
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT USING role::text;

-- 2. Alter 'role_permissions.role' type to TEXT
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE TEXT USING role::text;


-- ----------------------------------------------------
-- STEP 3: RECREATE ALL POLICIES WITH THE NEW TEXT TYPE
-- ----------------------------------------------------

-- 1. Recreate 'profiles' admin management policies
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'hotel_manager')
);

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'hotel_manager')
);

-- 2. Recreate 'rooms' modify policy
CREATE POLICY "Only admins can modify rooms" ON public.rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 3. Recreate 'pricing_rules' modify policy
CREATE POLICY "Only admins can modify pricing rules" ON public.pricing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 4. Recreate 'rate_plans' modify policy
CREATE POLICY "Only admins can modify rate plans" ON public.rate_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 5. Recreate 'coupons' modify policy
CREATE POLICY "Only admins can modify coupons" ON public.coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 6. Recreate 'properties' modify policy
CREATE POLICY "Admins manage properties" ON public.properties FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 7. Recreate 'bookings' view and manage policies
CREATE POLICY "Guests can view their own bookings" ON public.bookings FOR SELECT USING (
  auth.uid() = guest_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Staff can view all bookings" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist'))
);
CREATE POLICY "Only admins can delete bookings" ON public.bookings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 8. Recreate 'invoices' policies
CREATE POLICY "Staff can view invoices and payments" ON public.invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Staff can manage invoices and payments" ON public.invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'accountant', 'receptionist'))
);

-- 9. Recreate 'payments' policies
CREATE POLICY "Staff can view payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Staff can manage payments" ON public.payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'accountant', 'receptionist'))
);

-- 10. Recreate 'housekeeping_tasks' policies
CREATE POLICY "Staff can view housekeeping" ON public.housekeeping_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Housekeeping and admins can update" ON public.housekeeping_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'housekeeping'))
);
CREATE POLICY "Only admins can delete housekeeping" ON public.housekeeping_tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Housekeepers view own tasks" ON public.housekeeping_tasks FOR SELECT USING (
  auth.uid() = housekeeper_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Housekeepers update own tasks" ON public.housekeeping_tasks FOR UPDATE USING (
  auth.uid() = housekeeper_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 11. Recreate 'maintenance_tickets' policies
CREATE POLICY "Staff can view maintenance" ON public.maintenance_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Maintenance and admins can update" ON public.maintenance_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'maintenance'))
);
CREATE POLICY "Only admins can delete maintenance" ON public.maintenance_tickets FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 12. Recreate 'crm_guests' policies
CREATE POLICY "Staff can view CRM" ON public.crm_guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Front desk and admins manage CRM" ON public.crm_guests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist', 'customer_support'))
);

-- 13. Recreate 'communication_logs' policies
CREATE POLICY "Staff can view Comm Logs" ON public.communication_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Front desk and admins manage Comm Logs" ON public.communication_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist', 'customer_support'))
);

-- 14. Recreate 'staff_attendance' policies
CREATE POLICY "Staff can view own attendance" ON public.staff_attendance FOR SELECT USING (
  staff_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Admins manage attendance" ON public.staff_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 15. Recreate 'role_permissions' policies
CREATE POLICY "Super Admins manage role permissions" ON public.role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "Staff view role permissions" ON public.role_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'guest')
);

-- 16. Recreate 'cms_gallery' policies
CREATE POLICY "Admins manage CMS" ON public.cms_gallery FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 17. Recreate 'ota_ical_links' policies
CREATE POLICY "Admins manage Channel Manager" ON public.ota_ical_links FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 18. Recreate 'system_settings' policies
CREATE POLICY "Super Admins update system settings" ON public.system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);


-- ----------------------------------------------------
-- STEP 4: CREATE DYNAMIC CUSTOM ROLES TABLE & ACCESS
-- ----------------------------------------------------

-- Create 'custom_roles' table
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT DEFAULT 'bg-blue-500/10 text-blue-400' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on 'custom_roles'
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Seed dynamic bypass policy for prototype connection
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.custom_roles;
CREATE POLICY "Allow all for authenticated users" ON public.custom_roles FOR ALL USING (true);

COMMIT;
