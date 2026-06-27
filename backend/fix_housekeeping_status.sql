-- Add 'cleaned' to the housekeeping_status ENUM so the database accepts the new status
ALTER TYPE housekeeping_status ADD VALUE IF NOT EXISTS 'cleaned';
