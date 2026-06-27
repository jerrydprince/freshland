-- LUXE APARTMENT PMS - HOUSEKEEPING MODULE MIGRATION

-- Add Inspection Checklist Data
ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS inspection_checklist JSONB DEFAULT '{}'::jsonb;

-- Prototype Fix: Allow unrestricted access to housekeeping and maintenance tables
-- Note: Enterprise Schema V2 added row-level security. We need to loosen it for the prototype context
-- where the current mock user system doesn't align with Supabase JWT claims.

DROP POLICY IF EXISTS "Housekeepers view own tasks" ON housekeeping_tasks;
DROP POLICY IF EXISTS "Housekeepers update own tasks" ON housekeeping_tasks;

CREATE POLICY "Allow all selects for housekeeping" ON housekeeping_tasks FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for housekeeping" ON housekeeping_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for housekeeping" ON housekeeping_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for housekeeping" ON housekeeping_tasks FOR DELETE USING (true);

CREATE POLICY "Allow all selects for maintenance" ON maintenance_tickets FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for maintenance" ON maintenance_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for maintenance" ON maintenance_tickets FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for maintenance" ON maintenance_tickets FOR DELETE USING (true);
