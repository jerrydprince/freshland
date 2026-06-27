-- =========================================================================
-- PROTOTYPE RLS BYPASS
-- Since the frontend uses a mock authentication system (no supabase auth),
-- all requests are sent as 'anon' with auth.uid() = NULL.
-- This script temporarily allows anon users to perform all operations 
-- so the PMS functions correctly during the prototype/demo phase.
-- =========================================================================

-- Rooms
DROP POLICY IF EXISTS "Prototype full access rooms" ON rooms;
CREATE POLICY "Prototype full access rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);

-- Properties
DROP POLICY IF EXISTS "Prototype full access properties" ON properties;
CREATE POLICY "Prototype full access properties" ON properties FOR ALL USING (true) WITH CHECK (true);

-- Bookings
DROP POLICY IF EXISTS "Prototype full access bookings" ON bookings;
CREATE POLICY "Prototype full access bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);

-- Housekeeping
DROP POLICY IF EXISTS "Prototype full access housekeeping_tasks" ON housekeeping_tasks;
CREATE POLICY "Prototype full access housekeeping_tasks" ON housekeeping_tasks FOR ALL USING (true) WITH CHECK (true);

-- Maintenance
DROP POLICY IF EXISTS "Prototype full access maintenance_tickets" ON maintenance_tickets;
CREATE POLICY "Prototype full access maintenance_tickets" ON maintenance_tickets FOR ALL USING (true) WITH CHECK (true);

-- CMS
DROP POLICY IF EXISTS "Prototype full access cms_pages" ON cms_pages;
CREATE POLICY "Prototype full access cms_pages" ON cms_pages FOR ALL USING (true) WITH CHECK (true);

-- System Settings
DROP POLICY IF EXISTS "Prototype full access system_settings" ON system_settings;
CREATE POLICY "Prototype full access system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- CRM
DROP POLICY IF EXISTS "Prototype full access crm_guests" ON crm_guests;
CREATE POLICY "Prototype full access crm_guests" ON crm_guests FOR ALL USING (true) WITH CHECK (true);

-- Communication Logs
DROP POLICY IF EXISTS "Prototype full access communication_logs" ON communication_logs;
CREATE POLICY "Prototype full access communication_logs" ON communication_logs FOR ALL USING (true) WITH CHECK (true);

-- Invoices & Payments
DROP POLICY IF EXISTS "Prototype full access invoices" ON invoices;
CREATE POLICY "Prototype full access invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Prototype full access payments" ON payments;
CREATE POLICY "Prototype full access payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- Staff Attendance & Activity Logs
DROP POLICY IF EXISTS "Prototype full access staff_attendance" ON staff_attendance;
CREATE POLICY "Prototype full access staff_attendance" ON staff_attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Prototype full access system_logs" ON system_logs;
CREATE POLICY "Prototype full access system_logs" ON system_logs FOR ALL USING (true) WITH CHECK (true);

-- Pricing Rules
DROP POLICY IF EXISTS "Prototype full access pricing_rules" ON pricing_rules;
CREATE POLICY "Prototype full access pricing_rules" ON pricing_rules FOR ALL USING (true) WITH CHECK (true);

-- Role Permissions
DROP POLICY IF EXISTS "Prototype full access role_permissions" ON role_permissions;
CREATE POLICY "Prototype full access role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);
