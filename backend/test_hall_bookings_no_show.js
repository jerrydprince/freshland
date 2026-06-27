import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSchema() {
  const { data, error } = await supabase
    .from('hall_bookings')
    .update({ status: 'no_show' })
    .eq('id', 'some-fake-id')
    .select();

  if (error) {
    console.error("Update Error:", error);
  } else {
    console.log("Update Success (fake id):", data);
  }
}

testSchema();
