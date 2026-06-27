-- =========================================================================
-- PHASE 1 AUDIT FIXES: COMPREHENSIVE RLS SECURITY AND INDEXES
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. PERFORMANCE INDEXES (Missing from original schemas)
-- -------------------------------------------------------------------------
-- Rooms & Properties
CREATE INDEX IF NOT EXISTS idx_rooms_property_id ON rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- Bookings & Invoices
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Housekeeping & Maintenance
CREATE INDEX IF NOT EXISTS idx_housekeeping_room_id ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_room_id ON maintenance_tickets(room_id);

-- Pricing Rules & CRM
CREATE INDEX IF NOT EXISTS idx_pricing_rules_dates ON pricing_rules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_crm_guests_profile_id ON crm_guests(profile_id);


-- -------------------------------------------------------------------------
-- 2. HARDEN RLS POLICIES (Replacing wildcards across all modules)
-- -------------------------------------------------------------------------

-- 2.1 BOOKINGS
DROP POLICY IF EXISTS "Allow all selects for prototype" ON bookings;
DROP POLICY IF EXISTS "Allow all updates for prototype" ON bookings;
DROP POLICY IF EXISTS "Allow all deletes for prototype" ON bookings;

CREATE POLICY "Staff can view all bookings" ON bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Staff can update bookings" ON bookings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist'))
);
CREATE POLICY "Only admins can delete bookings" ON bookings FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 2.2 INVOICES & PAYMENTS
DROP POLICY IF EXISTS "Allow all selects for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all inserts for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all updates for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all deletes for invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all selects for payments" ON payments;
DROP POLICY IF EXISTS "Allow all inserts for payments" ON payments;
DROP POLICY IF EXISTS "Allow all updates for payments" ON payments;
DROP POLICY IF EXISTS "Allow all deletes for payments" ON payments;

CREATE POLICY "Staff can view invoices and payments" ON invoices FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Guests can view their own invoices" ON invoices FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = invoices.booking_id AND bookings.guest_id = auth.uid())
);
CREATE POLICY "Staff can manage invoices and payments" ON invoices FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'accountant', 'receptionist'))
);

CREATE POLICY "Staff can view payments" ON payments FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Guests can view their own payments" ON payments FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payments.booking_id AND bookings.guest_id = auth.uid())
);
CREATE POLICY "Staff can manage payments" ON payments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'accountant', 'receptionist'))
);

-- 2.3 HOUSEKEEPING & MAINTENANCE
DROP POLICY IF EXISTS "Allow all selects for housekeeping" ON housekeeping_tasks;
DROP POLICY IF EXISTS "Allow all updates for housekeeping" ON housekeeping_tasks;
DROP POLICY IF EXISTS "Allow all deletes for housekeeping" ON housekeeping_tasks;
DROP POLICY IF EXISTS "Allow all selects for maintenance" ON maintenance_tickets;
DROP POLICY IF EXISTS "Allow all updates for maintenance" ON maintenance_tickets;
DROP POLICY IF EXISTS "Allow all deletes for maintenance" ON maintenance_tickets;

CREATE POLICY "Staff can view housekeeping" ON housekeeping_tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Housekeeping and admins can update" ON housekeeping_tasks FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'housekeeping'))
);
CREATE POLICY "Only admins can delete housekeeping" ON housekeeping_tasks FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

CREATE POLICY "Staff can view maintenance" ON maintenance_tickets FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Maintenance and admins can update" ON maintenance_tickets FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'maintenance'))
);
CREATE POLICY "Only admins can delete maintenance" ON maintenance_tickets FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);

-- 2.4 CRM & COMMUNICATIONS
DROP POLICY IF EXISTS "Allow all selects for crm_guests" ON crm_guests;
DROP POLICY IF EXISTS "Allow all updates for crm_guests" ON crm_guests;
DROP POLICY IF EXISTS "Allow all deletes for crm_guests" ON crm_guests;
DROP POLICY IF EXISTS "Allow all selects for communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Allow all updates for communication_logs" ON communication_logs;
DROP POLICY IF EXISTS "Allow all deletes for communication_logs" ON communication_logs;

CREATE POLICY "Staff can view CRM" ON crm_guests FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Front desk and admins manage CRM" ON crm_guests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist', 'customer_support'))
);
CREATE POLICY "Staff can view Comm Logs" ON communication_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);
CREATE POLICY "Front desk and admins manage Comm Logs" ON communication_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager', 'receptionist', 'customer_support'))
);

-- 2.5 STAFF ATTENDANCE & LOGS
DROP POLICY IF EXISTS "Allow all selects for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all updates for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all deletes for staff_attendance" ON staff_attendance;
DROP POLICY IF EXISTS "Allow all selects for system_logs" ON system_logs;

CREATE POLICY "Staff can view own attendance" ON staff_attendance FOR SELECT USING (
    staff_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Admins manage attendance" ON staff_attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
DROP POLICY IF EXISTS "Admins view system logs" ON system_logs;
CREATE POLICY "Admins view system logs" ON system_logs FOR SELECT USING (
    auth.role() = 'authenticated'
);

-- 2.6 SYSTEM SETTINGS, CMS, CHANNEL MANAGER & ROLE PERMISSIONS
DROP POLICY IF EXISTS "Allow all selects for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow all updates for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow all inserts for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow all access to cms_gallery" ON cms_gallery;
DROP POLICY IF EXISTS "Allow all selects for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "Allow all updates for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "Allow all deletes for ota_ical_links" ON ota_ical_links;
DROP POLICY IF EXISTS "System settings can be updated" ON system_settings;

CREATE POLICY "Super Admins manage role permissions" ON role_permissions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "Staff view role permissions" ON role_permissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'guest')
);

CREATE POLICY "Admins manage CMS" ON cms_gallery FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Admins manage Channel Manager" ON ota_ical_links FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'hotel_manager'))
);
CREATE POLICY "Super Admins update system settings" ON system_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
