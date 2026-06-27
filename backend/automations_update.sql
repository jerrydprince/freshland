-- LUXE APARTMENT PMS - AUTOMATIONS MODULE MIGRATION

DO $$ 
BEGIN
    -- 1. Add "Automations & Alerts" to the ENUM if possible.
    -- (ENUM modification in Postgres is tricky inside blocks, but we don't strict-type the module name in role_permissions)
    
    -- 2. Create Notification Templates table
    CREATE TABLE IF NOT EXISTS notification_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'email', -- email, sms, whatsapp, push
        subject TEXT, -- For emails
        body TEXT NOT NULL, -- The message itself, containing variables like {{guest_name}}
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 3. Create Automation Rules table
    CREATE TABLE IF NOT EXISTS automation_rules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        trigger_event TEXT NOT NULL, -- e.g. booking_created, check_in_1day, checkout
        template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        delay_minutes INTEGER DEFAULT 0, -- Time offset if needed
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 4. Create Notification Logs table
    CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        recipient TEXT NOT NULL, -- email address or phone number
        channel TEXT NOT NULL,
        template_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending', -- sent, failed, pending
        error_message TEXT,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

END $$;

-- 5. Seed some initial data
INSERT INTO notification_templates (name, channel, subject, body) VALUES
('Welcome Email', 'email', 'Welcome to Luxe Apartments, {{guest_name}}!', 'Dear {{guest_name}}, we are thrilled to confirm your booking ({{booking_ref}}) from {{check_in}} to {{check_out}}.'),
('Check-in Reminder (SMS)', 'sms', NULL, 'Hi {{guest_name}}, your stay at Luxe Apartments begins tomorrow! Check-in is at 2:00 PM. See you soon!'),
('Checkout Instructions', 'email', 'Checkout Information - Luxe Apartments', 'Dear {{guest_name}}, we hope you enjoyed your stay. Please remember that checkout is at 11:00 AM. Safe travels!'),
('Payment Overdue', 'email', 'Action Required: Outstanding Payment', 'Dear {{guest_name}}, you have an outstanding balance for booking {{booking_ref}}. Please clear it to secure your reservation.')
ON CONFLICT DO NOTHING;

INSERT INTO automation_rules (name, trigger_event, template_id, is_active)
SELECT 'Send Welcome Email on Booking', 'booking_created', id, true 
FROM notification_templates WHERE name = 'Welcome Email' LIMIT 1;

INSERT INTO automation_rules (name, trigger_event, template_id, is_active)
SELECT 'Send Check-in SMS 24hr Before', 'check_in_1day', id, true 
FROM notification_templates WHERE name = 'Check-in Reminder (SMS)' LIMIT 1;

-- 6. Add permissions for Super Admin
INSERT INTO role_permissions (role, module, has_access) 
VALUES ('super_admin', 'Automations & Alerts', true)
ON CONFLICT (role, module) DO NOTHING;
