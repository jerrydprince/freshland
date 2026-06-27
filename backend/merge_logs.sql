-- LUXE APARTMENT PMS - SYSTEM LOGS CONSOLIDATION MIGRATION

-- 1. Create the unified system_logs table if it does not exist
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email TEXT,
    log_type TEXT NOT NULL CHECK (log_type IN ('activity', 'login', 'audit')),
    action TEXT NOT NULL,
    module TEXT,
    entity_table TEXT,
    entity_id UUID,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Secure and index system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated selects for system_logs" ON system_logs;
CREATE POLICY "Allow authenticated selects for system_logs" ON system_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow anonymous inserts for system_logs" ON system_logs;
CREATE POLICY "Allow anonymous inserts for system_logs" ON system_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_system_logs_type_created ON system_logs (log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs (user_id);

-- 3. Perform a safe PL/pgSQL migration block to copy existing log entries without data loss
DO $$
BEGIN
    -- Migrate from activity_logs if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
        INSERT INTO system_logs (id, user_id, log_type, action, module, metadata, created_at)
        SELECT 
            id, 
            user_id, 
            'activity', 
            action, 
            module, 
            jsonb_build_object('details', details), 
            created_at
        FROM activity_logs
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Migrate from login_activity if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_activity') THEN
        INSERT INTO system_logs (id, user_id, email, log_type, action, ip_address, metadata, created_at)
        SELECT 
            id, 
            user_id, 
            email, 
            'login', 
            'Login Attempt', 
            ip_address, 
            jsonb_build_object(
                'device_info', device_info, 
                'browser_info', browser_info, 
                'location', location, 
                'status', status
            ), 
            created_at
        FROM login_activity
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Migrate from audit_logs if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO system_logs (id, user_id, log_type, action, entity_table, entity_id, ip_address, metadata, created_at)
        SELECT 
            id, 
            user_id, 
            'audit', 
            action, 
            entity_table, 
            entity_id, 
            ip_address, 
            metadata, 
            created_at
        FROM audit_logs
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 4. Clean up legacy tables
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS login_activity CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
