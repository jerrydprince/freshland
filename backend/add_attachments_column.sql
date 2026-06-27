-- LUXE APARTMENT PMS - INTERNAL MESSAGES ATTACHMENTS MIGRATION
-- Idempotently adds columns to internal_messages table to support file uploads

ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
