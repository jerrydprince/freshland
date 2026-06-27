-- =========================================================================
-- RLS POLICIES PATCH FOR ENTERPRISE TABLES
-- =========================================================================
-- This script adds the missing Row-Level Security policies for the new tables.
-- Note: If you are using Mock Login instead of real Supabase Auth, you may 
-- experience issues with auth.uid() returning null. 
-- For development/testing purposes, these policies allow public access.
-- Once you integrate real Supabase Auth, you can restrict them.

-- 1. PRICING RULES
CREATE POLICY "Pricing rules are viewable by everyone" ON pricing_rules FOR SELECT USING (true);
CREATE POLICY "Admins can insert pricing rules" ON pricing_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update pricing rules" ON pricing_rules FOR UPDATE USING (true);
CREATE POLICY "Admins can delete pricing rules" ON pricing_rules FOR DELETE USING (true);

-- 2. MAINTENANCE TICKETS
CREATE POLICY "Staff can view maintenance tickets" ON maintenance_tickets FOR SELECT USING (true);
CREATE POLICY "Staff can insert maintenance tickets" ON maintenance_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update maintenance tickets" ON maintenance_tickets FOR UPDATE USING (true);
CREATE POLICY "Staff can delete maintenance tickets" ON maintenance_tickets FOR DELETE USING (true);

-- 3. HOUSEKEEPING TASKS (Adding Insert Policy)
CREATE POLICY "Admins can insert housekeeping tasks" ON housekeeping_tasks FOR INSERT WITH CHECK (true);

-- 4. SYSTEM SETTINGS
CREATE POLICY "System settings are viewable by everyone" ON system_settings FOR SELECT USING (true);
CREATE POLICY "System settings can be updated" ON system_settings FOR ALL USING (true);

-- 5. PAYMENTS
CREATE POLICY "Payments are viewable" ON payments FOR SELECT USING (true);
CREATE POLICY "Payments can be inserted" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Payments can be updated" ON payments FOR UPDATE USING (true);
