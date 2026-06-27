import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

let url = supabaseUrl;
let key = supabaseKey;

if (!url || !key) {
  const envContent = fs.readFileSync('c:/Users/jerry/Desktop/Apartment booking project/frontend/.env', 'utf-8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
  }
}

const supabase = createClient(url, key);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('query_triggers_or_funcs', {}).catch(() => ({ error: 'rpc fail' }));
  console.log(error);
  
  // Actually we can just select from hall_bookings to see if it auto-generates invoice.
  // Wait, I can't directly query information_schema from the standard supabase client.
  // Let me just look at the backend sql scripts!
}

checkTriggers();
