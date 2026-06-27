import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);

  const startAll = Date.now();

  // 1. Fetch rooms
  const startRooms = Date.now();
  const { data: rooms, error: roomsErr } = await supabase
    .from('rooms')
    .select('id, room_number, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities, min_stay_days, max_stay_days, allowed_check_in_days, allowed_check_out_days');
  console.log("Rooms query took (ms):", Date.now() - startRooms, "count:", rooms?.length);

  // 2. Fetch pricing rules
  const startRules = Date.now();
  const { data: rules } = await supabase.from('pricing_rules').select('*').eq('is_active', true);
  console.log("Pricing rules query took (ms):", Date.now() - startRules, "count:", rules?.length);

  // 3. get_booked_room_ids rpc
  const startRpc = Date.now();
  const { data: overlappingBookings } = await supabase.rpc('get_booked_room_ids', {
    req_start_date: '2026-06-01',
    req_end_date: '2026-06-10'
  });
  console.log("get_booked_room_ids rpc took (ms):", Date.now() - startRpc, "count:", overlappingBookings?.length);

  // 4. Fetch housekeeping tasks
  const startHousekeeping = Date.now();
  const { data: housekeepingTasks } = await supabase
    .from('housekeeping_tasks')
    .select('room_id, status, assigned_date')
    .order('assigned_date', { ascending: false });
  console.log("Housekeeping tasks query took (ms):", Date.now() - startHousekeeping, "count:", housekeepingTasks?.length);

  console.log("All queries sequential duration (ms):", Date.now() - startAll);
}

test();
