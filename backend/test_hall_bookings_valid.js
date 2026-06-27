import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSchema() {
  const { data: bookings } = await supabase.from('hall_bookings').select('id').limit(1);
  if (bookings && bookings.length > 0) {
    const { error } = await supabase
      .from('hall_bookings')
      .update({ status: 'no_show' })
      .eq('id', bookings[0].id);

    if (error) {
      console.error("Update Error:", error);
    } else {
      console.log("Update Success!");
    }
  } else {
    console.log("No bookings found.");
  }
}

testSchema();
