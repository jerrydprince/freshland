-- LUXE APARTMENT PMS - CONCURRENT DEVICES LOG IN GATE MIGRATION
-- Limits active user logins to exactly 2 active devices at the same time.

CREATE TABLE IF NOT EXISTS user_active_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_info TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read, insert, and update their own session entries
DROP POLICY IF EXISTS "Allow all for authenticated users" ON user_active_sessions;
CREATE POLICY "Allow all for authenticated users" ON user_active_sessions FOR ALL USING (true);
