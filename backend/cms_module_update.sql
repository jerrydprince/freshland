-- LUXE APARTMENT PMS - CMS MODULE UPGRADE

DO $$ 
BEGIN
    -- 1. Extend cms_pages table for SEO and Page Types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cms_pages' AND column_name='meta_title') THEN
        ALTER TABLE cms_pages ADD COLUMN meta_title TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cms_pages' AND column_name='meta_description') THEN
        ALTER TABLE cms_pages ADD COLUMN meta_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cms_pages' AND column_name='seo_keywords') THEN
        ALTER TABLE cms_pages ADD COLUMN seo_keywords TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cms_pages' AND column_name='page_type') THEN
        ALTER TABLE cms_pages ADD COLUMN page_type TEXT DEFAULT 'landing_page'; -- landing_page, property_page, room_page
    END IF;

END $$;

-- 2. Ensure content column is JSONB (it usually is if previously defined as JSON, but we cast it if needed)
-- (Assuming it's already JSONB based on previous implementation. If not, this would be complex to alter if data exists.
-- We will just use the existing content column to store our blocks JSON array).

-- 3. Create cms_gallery table
CREATE TABLE IF NOT EXISTS cms_gallery (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    alt_text TEXT,
    category TEXT DEFAULT 'uncategorized', -- Exterior, Interior, Amenities
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for cms_gallery
ALTER TABLE cms_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to cms_gallery" ON cms_gallery;
CREATE POLICY "Allow all access to cms_gallery" ON cms_gallery FOR ALL USING (true) WITH CHECK (true);

-- 4. Setup Supabase Storage Bucket for Gallery (Requires Superuser, but we use IF NOT EXISTS to try)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gallery_images', 'gallery_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies (Allow public read, allow authenticated upload)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'gallery_images');
CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery_images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Deletes" ON storage.objects FOR DELETE USING (bucket_id = 'gallery_images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Updates" ON storage.objects FOR UPDATE USING (bucket_id = 'gallery_images' AND auth.role() = 'authenticated');
