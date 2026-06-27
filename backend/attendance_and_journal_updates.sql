-- LUXE APARTMENT PMS - BIOMETRIC SHIFT & ATTENDANCE MIGRATION
-- Safely adds is_on_shift and biometric_key columns to the profiles table.

DO $$
BEGIN
    -- 1. Add is_on_shift column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_on_shift'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_on_shift BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. Add biometric_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'biometric_key'
    ) THEN
        ALTER TABLE profiles ADD COLUMN biometric_key TEXT UNIQUE;
    END IF;
END $$;
