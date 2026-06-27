-- Migration: Allow operations for Mock Users
-- Since the frontend is using a mock user context (AuthContext.jsx), requests sent to Supabase are Anonymous.
-- We need to open up the policies so the prototype works without real JWTs.

DROP POLICY IF EXISTS "Admins can insert any bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update any bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;

CREATE POLICY "Allow all inserts for prototype" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for prototype" ON bookings FOR UPDATE USING (true);
CREATE POLICY "Allow all selects for prototype" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow all deletes for prototype" ON bookings FOR DELETE USING (true);
