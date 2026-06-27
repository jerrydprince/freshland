-- LUXE APARTMENT PMS - LAUNDRY DEPARTMENT ROLES & PERMISSIONS MIGRATION
-- 
-- IMPORTANT POSTGRESQL NOTE:
-- Due to PostgreSQL transactional limitations, newly added ENUM values must be committed 
-- to the database catalog BEFORE they can be referenced in any INSERT or UPDATE query.
--
-- INSTRUCTIONS:
-- 1. Copy and run STEP 1 in your Supabase SQL Editor first.
-- 2. Once STEP 1 completes successfully, copy and run STEP 2 in the editor.

-- =========================================================================
-- STEP 1: EXTEND THE 'user_role' ENUM (RUN THIS ALONE FIRST)
-- =========================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'laundry_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'laundry_staff';


-- =========================================================================
-- STEP 2: SEED ROLE PERMISSIONS (RUN THIS AFTER STEP 1 HAS COMPLETED)
-- =========================================================================

-- 1. Seed Default Permissions for Laundry Manager
INSERT INTO role_permissions (role, module, has_access) VALUES
('laundry_manager', 'Dashboard', true),
('laundry_manager', 'Laundry', true),
('laundry_manager', 'Laundry - Process Laundry Orders', true),
('laundry_manager', 'Laundry - Post Folio Charges', true),
('laundry_manager', 'Laundry - Register Walk-in Sales', true),
('laundry_manager', 'CRM & Guests', true),
('laundry_manager', 'Reports & Analytics', true)
ON CONFLICT (role, module) DO UPDATE SET has_access = EXCLUDED.has_access;

-- 2. Seed Default Permissions for Laundry Staff
INSERT INTO role_permissions (role, module, has_access) VALUES
('laundry_staff', 'Dashboard', true),
('laundry_staff', 'Laundry', true),
('laundry_staff', 'Laundry - Process Laundry Orders', true),
('laundry_staff', 'Laundry - Post Folio Charges', true),
('laundry_staff', 'Laundry - Register Walk-in Sales', true)
ON CONFLICT (role, module) DO UPDATE SET has_access = EXCLUDED.has_access;

-- 3. Seed Default Permissions for other core roles accessing the Laundry Department
-- (Only references roles existing in the database enum. Virtual sub-roles fallback to frontend defaults).
INSERT INTO role_permissions (role, module, has_access) VALUES
('receptionist', 'Laundry', true),
('receptionist', 'Laundry - Process Laundry Orders', false),
('receptionist', 'Laundry - Post Folio Charges', false),
('receptionist', 'Laundry - Register Walk-in Sales', true),

('accountant', 'Laundry', true),
('accountant', 'Laundry - Process Laundry Orders', false),
('accountant', 'Laundry - Post Folio Charges', false),
('accountant', 'Laundry - Register Walk-in Sales', true)
ON CONFLICT (role, module) DO UPDATE SET has_access = EXCLUDED.has_access;
