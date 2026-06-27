import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data: rooms } = await supabase.from('rooms').select('id, room_number, name, image_url');
  rooms.forEach(r => {
    const len = r.image_url ? r.image_url.length : 0;
    const isBase64 = r.image_url?.startsWith('data:image');
    console.log(`Room: ${r.room_number} - ${r.name}`);
    console.log(`- Image URL Length: ${len}`);
    console.log(`- Is Base64: ${isBase64}`);
    if (len > 0) {
      console.log(`- Preview: ${r.image_url.substring(0, 100)}...`);
    }
  });
}

run();
