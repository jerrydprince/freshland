import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data: rooms1 } = await supabase.from('rooms').select('id, room_number, name').eq('room_number', 'Julex 1011');
  console.log("Original name:", rooms1[0].name);

  const { error: err1 } = await supabase.from('rooms').update({ name: 'Julex 1011 Mod' }).eq('room_number', 'Julex 1011');
  if (err1) {
    console.error("Update error:", err1);
  }

  const { data: rooms2 } = await supabase.from('rooms').select('id, room_number, name').eq('room_number', 'Julex 1011');
  console.log("Name after update attempt:", rooms2[0].name);

  // Revert it
  await supabase.from('rooms').update({ name: 'Julex 1011' }).eq('room_number', 'Julex 1011');
}

test();
