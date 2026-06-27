-- =========================================================================
-- LUXE APARTMENT PMS - ADD STAFF BANK SETTLEMENT DETAILS MIGRATION
-- =========================================================================
-- This script adds bank details fields to the staff profiles table.
-- Copy and run this script inside your Supabase SQL Editor.

-- Add bank name column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Add account number column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Add account name column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Ensure RLS allows selecting these columns (already enabled by default for SELECT * on profiles)
COMMENT ON COLUMN public.profiles.bank_name IS 'Staff settlement bank name';
COMMENT ON COLUMN public.profiles.account_number IS 'Staff settlement 10-digit NUBAN account number';
COMMENT ON COLUMN public.profiles.account_name IS 'Staff settlement bank account name matching bank records';
