import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data: roomIds, error: idErr } = await supabase.from('rooms').select('id, room_number');
  if (idErr) {
    console.error("Error fetching IDs:", idErr);
    return;
  }

  for (const r of roomIds) {
    console.log(`Fetching room ${r.room_number}...`);
    const { data: room, error } = await supabase
      .from('rooms')
      .select('id, room_number, name, image_url, description')
      .eq('id', r.id)
      .single();
      
    if (error) {
      console.error(`Error fetching room ${r.room_number}:`, error);
      continue;
    }

    let descObj = {};
    try {
      descObj = JSON.parse(room.description || '{}');
    } catch(e) {}
    console.log(`Room: ${room.room_number} - ${room.name}`);
    console.log(`- Image URL Length: ${room.image_url ? room.image_url.length : 0}`);
    console.log(`- Description JSON keys:`, Object.keys(descObj));
    if (descObj.images) {
      console.log(`- Description images count:`, descObj.images.length);
      descObj.images.forEach((img, idx) => {
        console.log(`  - Image[${idx}] Length:`, img ? img.length : 0);
      });
    }
  }
}

run();
