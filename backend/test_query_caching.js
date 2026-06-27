import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);

  // Connection warming
  const startWarm = Date.now();
  await supabase.from('rooms').select('id').limit(1);
  console.log("Connection warming query took (ms):", Date.now() - startWarm);

  // Run Rooms Query 1
  const startRooms1 = Date.now();
  const { data: rooms1 } = await supabase
    .from('rooms')
    .select('id, room_number, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities, min_stay_days, max_stay_days, allowed_check_in_days, allowed_check_out_days');
  console.log("Rooms query 1 took (ms):", Date.now() - startRooms1, "count:", rooms1?.length);

  // Run Rooms Query 2
  const startRooms2 = Date.now();
  const { data: rooms2 } = await supabase
    .from('rooms')
    .select('id, room_number, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities, min_stay_days, max_stay_days, allowed_check_in_days, allowed_check_out_days');
  console.log("Rooms query 2 took (ms):", Date.now() - startRooms2, "count:", rooms2?.length);

  // Run Rooms Query 3
  const startRooms3 = Date.now();
  const { data: rooms3 } = await supabase
    .from('rooms')
    .select('id, room_number, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities, min_stay_days, max_stay_days, allowed_check_in_days, allowed_check_out_days');
  console.log("Rooms query 3 took (ms):", Date.now() - startRooms3, "count:", rooms3?.length);
}

test();
