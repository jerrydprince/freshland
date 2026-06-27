import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const roomImageMappings = {
  'Julex 1011': 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80',
  '101': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
  'ST-10': 'https://images.unsplash.com/photo-1502672260266-1c1de2d9d0d9?auto=format&fit=crop&w=600&q=80',
  'Fl -01': 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80',
  'PH-01': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80',
  'MU-01': 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
  'Julex 1012': 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
  'Julex 1013': 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80'
};

async function run() {
  console.log("Starting database rooms image optimization migration...");
  
  for (const [roomNumber, imageUrl] of Object.entries(roomImageMappings)) {
    console.log(`Updating Room: "${roomNumber}" with URL: ${imageUrl.substring(0, 50)}...`);
    const { data, error } = await supabase
      .from('rooms')
      .update({ image_url: imageUrl })
      .eq('room_number', roomNumber)
      .select('room_number, image_url');
      
    if (error) {
      console.error(`Error updating room "${roomNumber}":`, error);
    } else {
      console.log(`Successfully updated Room "${roomNumber}". New URL Length:`, data[0]?.image_url?.length);
    }
  }
  
  console.log("Migration completed.");
}

run();
