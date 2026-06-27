import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSchema() {
  const { data, error } = await supabase
    .from('hall_bookings')
    .select('status')
    .limit(1);

  if (error) {
    console.error("Fetch Error:", error);
  } else {
    console.log("Fetch Success:", data);
  }
}

testSchema();
