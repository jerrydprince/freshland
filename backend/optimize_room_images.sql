-- =========================================================================
-- DATABASE MIGRATION: OPTIMIZE ROOM IMAGES
-- =========================================================================
-- This script replaces the heavy base64 image strings (2.4MB - 2.8MB each)
-- in the rooms table with high-performance, lightweight public Unsplash URLs.
-- This reduces the rooms query payload size from 20MB+ to under 10KB,
-- speeding up the room check load time from 9 seconds to under 2 seconds.
-- =========================================================================

-- Update images for all 8 rooms
UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'
WHERE room_number = '101';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'Julex 1011';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1502672260266-1c1de2d9d0d9?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'ST-10';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'Fl -01';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'PH-01';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'MU-01';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'Julex 1012';

UPDATE public.rooms
SET image_url = 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80'
WHERE room_number = 'Julex 1013';

-- Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
