-- LUXE APARTMENT PMS - MULTI-BRANCH MANAGER MIGRATION
-- Adds a dedicated manager_id reference to the branches table linked directly to the profiles table.

ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Seed an existing profile as the manager for the main branch if available
DO $$
DECLARE
    v_manager_id UUID;
BEGIN
    SELECT id INTO v_manager_id 
    FROM public.profiles 
    WHERE role IN ('super_admin', 'hotel_manager', 'admin') 
    LIMIT 1;

    IF v_manager_id IS NULL THEN
        SELECT id INTO v_manager_id 
        FROM public.profiles 
        LIMIT 1;
    END IF;

    IF v_manager_id IS NOT NULL THEN
        UPDATE branches 
        SET manager_id = v_manager_id;
    END IF;
END $$;
