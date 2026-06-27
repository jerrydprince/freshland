-- Migration: Add status column to profiles to support staff suspension and sacking deactivation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active';
