-- LUXE APARTMENT PMS - CUSTOM PASSWORD RESET & REALTIME PUBLICATION MIGRATION

-- 1. Extend service_status enum to support 'confirmed' state (Post-Checkin Routing)
ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'confirmed';

-- 2. Create password reset tokens table for custom secure SMTP routing
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and grant access
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.password_resets;
CREATE POLICY "Allow all for authenticated users" ON public.password_resets FOR ALL USING (true);

-- 3. Security Definer password reset helper function
-- This updates auth.users password by hashing with bcrypt using pgcrypto extension.
CREATE OR REPLACE FUNCTION public.reset_auth_user_password(
    p_email TEXT,
    p_token TEXT,
    p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reset_id UUID;
BEGIN
    -- Verify token is valid, unused, and not expired
    SELECT id INTO v_reset_id
    FROM public.password_resets
    WHERE email = LOWER(TRIM(p_email))
      AND token = p_token
      AND used = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_reset_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Mark token as used
    UPDATE public.password_resets
    SET used = true
    WHERE id = v_reset_id;

    -- Update user password in auth.users table
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE email = LOWER(TRIM(p_email));

    RETURN TRUE;
END;
$$;

-- 4. Seed Swimming Pool Access Service if not present
INSERT INTO public.services (name, description, category, base_price_ngn, pricing_type, icon_name, scheduling_required, quantity_selector, is_active)
VALUES (
    'Swimming Pool Access',
    'Full day access pass to the swimming pool with poolside lounge service.',
    'Wellness',
    5000.00,
    'per_person'::service_pricing_type,
    'Droplets',
    false,
    true,
    true
)
ON CONFLICT (code) DO NOTHING;

-- 5. Create refund_settlements table if not present
CREATE TABLE IF NOT EXISTS public.refund_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  refund_amount DECIMAL(12,2) NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.refund_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all selects for refund_settlements" ON public.refund_settlements;
DROP POLICY IF EXISTS "Allow all inserts for refund_settlements" ON public.refund_settlements;
DROP POLICY IF EXISTS "Allow all updates for refund_settlements" ON public.refund_settlements;
DROP POLICY IF EXISTS "Allow all deletes for refund_settlements" ON public.refund_settlements;

CREATE POLICY "Allow all selects for refund_settlements" ON public.refund_settlements FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for refund_settlements" ON public.refund_settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for refund_settlements" ON public.refund_settlements FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for refund_settlements" ON public.refund_settlements FOR DELETE USING (true);

-- 6. Create user_active_sessions table if not present
CREATE TABLE IF NOT EXISTS public.user_active_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_info TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.user_active_sessions;
CREATE POLICY "Allow all for authenticated users" ON public.user_active_sessions FOR ALL USING (true);

-- 7. Safe, Idempotent Realtime publication updates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Add refund_settlements if table exists
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'refund_settlements') AND NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'refund_settlements'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_settlements;
        END IF;

        -- Add user_active_sessions if table exists
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_active_sessions') AND NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'user_active_sessions'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_sessions;
        END IF;
    END IF;
END $$;
