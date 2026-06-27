-- LUXE APARTMENT PMS - FULL STAFF PROFILES MIGRATION

DO $$ 
BEGIN
    -- Add residential_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='residential_address') THEN
        ALTER TABLE profiles ADD COLUMN residential_address TEXT;
    END IF;

    -- Add username (must be unique)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;
    END IF;

    -- Add email (for easy display reference, since auth.users holds the real login email)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;
END $$;
