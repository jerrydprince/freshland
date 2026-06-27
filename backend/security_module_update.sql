-- LUXE APARTMENT PMS - SECURITY MODULE MIGRATION

DO $$ 
BEGIN
    -- 1. Legacy login_activity table creation removed in favor of unified system_logs


    -- 2. Expand system_settings for GDPR and Backups (Insert if not exists)
    INSERT INTO system_settings (setting_key, setting_value) VALUES 
        ('gdpr_data_retention_days', '730'), -- 2 years default
        ('gdpr_allow_user_deletion', 'true'),
        ('encryption_at_rest_enabled', 'true'), -- Conceptual UI flag
        ('auto_backup_frequency', '"daily"')
    ON CONFLICT (setting_key) DO NOTHING;

    -- 3. Add permissions for Super Admin to access the new module
    INSERT INTO role_permissions (role, module, has_access) 
    VALUES ('super_admin', 'Security & Privacy', true)
    ON CONFLICT (role, module) DO NOTHING;

END $$;
