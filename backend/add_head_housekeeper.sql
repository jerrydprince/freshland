-- Add head_housekeeper to the user_role ENUM
-- Note: PostgreSQL does not allow 'IF NOT EXISTS' for adding ENUM values in older versions,
-- but in modern PostgreSQL (10+) you can run:

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'head_housekeeper';
