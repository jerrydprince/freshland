-- Database Migration: Add items column to maintenance_purchases
-- Run this script in your Supabase SQL Editor to update the database schema.

ALTER TABLE maintenance_purchases ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
