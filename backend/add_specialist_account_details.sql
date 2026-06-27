-- Database Migration: Add Specialist Account Details
-- Run this script in your Supabase SQL Editor to update the database schema.

ALTER TABLE maintenance_professionals ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE maintenance_professionals ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE maintenance_professionals ADD COLUMN IF NOT EXISTS account_name TEXT;
