-- Run this in your Supabase SQL Editor to automatically confirm all staff emails
-- This will allow staff to log in immediately after you register them without needing to click an email link.

UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;
