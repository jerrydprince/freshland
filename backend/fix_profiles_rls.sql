-- LUXE APARTMENT PMS - ADMIN PROFILES RLS POLICY UPGRADE
-- Allows admins (super_admin & hotel_manager) to register, promote, update, and manage staff profiles.

-- 1. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- 2. Add INSERT policy (Allows authenticated signup triggers or admins to create profiles)
CREATE POLICY "Allow authenticated users to insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 3. Add UPDATE policy (Allows super_admin and hotel_manager to promote guests or edit staff details)
CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'hotel_manager')
);

-- 4. Add DELETE policy (Allows admins to prune profiles if necessary)
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'hotel_manager')
);


-- =========================================================================
-- OPTIONAL: MANUAL PROMOTION BACKFILL SNIPPET
-- =========================================================================
-- If you have an existing staff user (e.g. hildabrown@gmail.com) stuck as a 'guest'
-- and want to promote them manually right now in the Supabase SQL editor:
--
-- UPDATE public.profiles 
-- SET role = 'receptionist' -- or 'housekeeping', 'accountant', etc.
-- WHERE email = 'hildabrown@gmail.com';
-- =========================================================================
