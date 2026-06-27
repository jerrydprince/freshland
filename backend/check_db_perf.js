import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const start = Date.now();
  console.log("Supabase URL:", process.env.SUPABASE_URL);

  // 1. Get total bookings count
  const { count, error: countErr } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });
    
  if (countErr) {
    console.error("Error fetching count:", countErr);
    return;
  }
  console.log("Total Bookings Count:", count);

  // 2. Call the RPC to measure timing
  const rpcStart = Date.now();
  const { data, error: rpcErr } = await supabase.rpc('get_booked_room_ids', {
    req_start_date: '2026-06-01',
    req_end_date: '2026-06-10'
  });
  const rpcEnd = Date.now();
  
  if (rpcErr) {
    console.error("RPC Error:", rpcErr);
  } else {
    console.log("RPC Data returned count:", data.length);
    console.log("RPC Call Duration (ms):", rpcEnd - rpcStart);
  }
  
  // 3. Let's do a direct select on bookings table to measure simple query time
  const directStart = Date.now();
  const { data: directData, error: directErr } = await supabase
    .from('bookings')
    .select('room_id')
    .neq('status', 'cancelled')
    .lt('check_in_date', '2026-06-10')
    .gt('check_out_date', '2026-06-01');
  const directEnd = Date.now();

  if (directErr) {
    console.error("Direct Query Error:", directErr);
  } else {
    console.log("Direct Query Data returned count:", directData.length);
    console.log("Direct Query Duration (ms):", directEnd - directStart);
  }
}

check();
