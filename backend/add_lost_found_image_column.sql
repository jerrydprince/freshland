-- LUXE APARTMENT PMS - ADD LOST & FOUND IMAGE COLUMN
-- Adds image_url column to lost_found_items to attach a photo of the item.

ALTER TABLE lost_found_items ADD COLUMN IF NOT EXISTS image_url TEXT;
