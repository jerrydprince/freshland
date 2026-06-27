-- =========================================================================
-- LUXE APARTMENT PMS - ADD SALARY ALLOWANCES LIST MIGRATION
-- =========================================================================
-- This script adds the allowances_list JSONB columns to profiles and staff_salaries.
-- Copy and run this script inside your Supabase SQL Editor.

-- 1. Add allowances_list to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS allowances_list JSONB DEFAULT '[]'::jsonb;

-- 2. Add allowances_list to staff_salaries table
ALTER TABLE public.staff_salaries 
ADD COLUMN IF NOT EXISTS allowances_list JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.allowances_list IS 'List of named allowances entitled to employee (JSON array of {name, amount})';
COMMENT ON COLUMN public.staff_salaries.allowances_list IS 'Breakdown of named allowances paid in this period (JSON array of {name, amount})';
