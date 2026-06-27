-- LUXE APARTMENT PMS - DYNAMIC PERMISSIONS & RBAC MIGRATION

-- 1. Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role user_role NOT NULL,
    module TEXT NOT NULL,
    has_access BOOLEAN DEFAULT false,
    PRIMARY KEY (role, module)
);

-- 2. Setup RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all selects for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow all updates for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow all inserts for role_permissions" ON role_permissions;

CREATE POLICY "Allow all selects for role_permissions" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "Allow all updates for role_permissions" ON role_permissions FOR UPDATE USING (true);
CREATE POLICY "Allow all inserts for role_permissions" ON role_permissions FOR INSERT WITH CHECK (true);

-- 3. Seed Initial Data based on the matrix

-- Super Admin gets everything
INSERT INTO role_permissions (role, module, has_access) VALUES
('super_admin', 'Dashboard', true),
('super_admin', 'Reservations', true),
('super_admin', 'Front Desk', true),
('super_admin', 'Housekeeping', true),
('super_admin', 'CRM & Guests', true),
('super_admin', 'Finance & Billing', true),
('super_admin', 'Channel Manager', true),
('super_admin', 'Reports & Analytics', true),
('super_admin', 'Staff & Roles', true),
('super_admin', 'Website CMS', true),
('super_admin', 'Settings', true)
ON CONFLICT (role, module) DO NOTHING;

-- Hotel Owner
INSERT INTO role_permissions (role, module, has_access) VALUES
('hotel_owner', 'Dashboard', true),
('hotel_owner', 'Reservations', true),
('hotel_owner', 'Front Desk', true),
('hotel_owner', 'Housekeeping', true),
('hotel_owner', 'CRM & Guests', true),
('hotel_owner', 'Finance & Billing', true),
('hotel_owner', 'Channel Manager', true),
('hotel_owner', 'Reports & Analytics', true),
('hotel_owner', 'Staff & Roles', true),
('hotel_owner', 'Website CMS', false),
('hotel_owner', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Manager
INSERT INTO role_permissions (role, module, has_access) VALUES
('hotel_manager', 'Dashboard', true),
('hotel_manager', 'Reservations', true),
('hotel_manager', 'Front Desk', true),
('hotel_manager', 'Housekeeping', true),
('hotel_manager', 'CRM & Guests', true),
('hotel_manager', 'Finance & Billing', true),
('hotel_manager', 'Channel Manager', false),
('hotel_manager', 'Reports & Analytics', true),
('hotel_manager', 'Staff & Roles', false),
('hotel_manager', 'Website CMS', false),
('hotel_manager', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Receptionist
INSERT INTO role_permissions (role, module, has_access) VALUES
('receptionist', 'Dashboard', true),
('receptionist', 'Reservations', true),
('receptionist', 'Front Desk', true),
('receptionist', 'Housekeeping', true),
('receptionist', 'CRM & Guests', true),
('receptionist', 'Finance & Billing', false),
('receptionist', 'Channel Manager', false),
('receptionist', 'Reports & Analytics', false),
('receptionist', 'Staff & Roles', false),
('receptionist', 'Website CMS', false),
('receptionist', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Accountant
INSERT INTO role_permissions (role, module, has_access) VALUES
('accountant', 'Dashboard', true),
('accountant', 'Reservations', false),
('accountant', 'Front Desk', false),
('accountant', 'Housekeeping', false),
('accountant', 'CRM & Guests', false),
('accountant', 'Finance & Billing', true),
('accountant', 'Channel Manager', false),
('accountant', 'Reports & Analytics', true),
('accountant', 'Staff & Roles', false),
('accountant', 'Website CMS', false),
('accountant', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Housekeeping
INSERT INTO role_permissions (role, module, has_access) VALUES
('housekeeping', 'Dashboard', true),
('housekeeping', 'Reservations', false),
('housekeeping', 'Front Desk', false),
('housekeeping', 'Housekeeping', true),
('housekeeping', 'CRM & Guests', false),
('housekeeping', 'Finance & Billing', false),
('housekeeping', 'Channel Manager', false),
('housekeeping', 'Reports & Analytics', false),
('housekeeping', 'Staff & Roles', false),
('housekeeping', 'Website CMS', false),
('housekeeping', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Maintenance
INSERT INTO role_permissions (role, module, has_access) VALUES
('maintenance', 'Dashboard', true),
('maintenance', 'Reservations', false),
('maintenance', 'Front Desk', false),
('maintenance', 'Housekeeping', true),
('maintenance', 'CRM & Guests', false),
('maintenance', 'Finance & Billing', false),
('maintenance', 'Channel Manager', false),
('maintenance', 'Reports & Analytics', false),
('maintenance', 'Staff & Roles', false),
('maintenance', 'Website CMS', false),
('maintenance', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;

-- Customer Support
INSERT INTO role_permissions (role, module, has_access) VALUES
('customer_support', 'Dashboard', true),
('customer_support', 'Reservations', true),
('customer_support', 'Front Desk', false),
('customer_support', 'Housekeeping', false),
('customer_support', 'CRM & Guests', true),
('customer_support', 'Finance & Billing', false),
('customer_support', 'Channel Manager', false),
('customer_support', 'Reports & Analytics', false),
('customer_support', 'Staff & Roles', false),
('customer_support', 'Website CMS', false),
('customer_support', 'Settings', false)
ON CONFLICT (role, module) DO NOTHING;
