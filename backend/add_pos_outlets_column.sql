-- LUXE APARTMENT PMS - POS OUTLETS STAFF ASSIGNMENTS
-- This migration adds a pos_outlets array column to profiles table 
-- allowing the PMS to assign staff members to Bar, Restaurant, Kitchen or multiple outlets.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pos_outlets TEXT[] DEFAULT '{}';

-- Create an index for array search queries to keep performance snappy
CREATE INDEX IF NOT EXISTS idx_profiles_pos_outlets ON public.profiles USING gin(pos_outlets);

-- Backfill super_admin, managers, and receptionists with default access if desired,
-- though our application code will automatically treat super_admin as having access to all outlets.
UPDATE public.profiles 
SET pos_outlets = '{"bar", "restaurant", "kitchen"}' 
WHERE role IN ('super_admin', 'hotel_owner', 'hotel_manager');
