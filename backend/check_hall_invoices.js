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

async function checkInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .not('hall_booking_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error(error);
  } else {
    console.log("Recent hall invoices:", JSON.stringify(data, null, 2));
  }
}

checkInvoices();
