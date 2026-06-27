import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: guests, error: err1 } = await supabase.from('crm_guests').select('*').limit(1);
  if (err1) {
    console.error("Error fetching crm_guests:", err1);
  } else {
    console.log("crm_guests columns:", Object.keys(guests[0] || {}));
  }

  const { data: ar, error: err2 } = await supabase.from('ar_accounts').select('*').limit(1);
  if (err2) {
    console.error("Error fetching ar_accounts:", err2);
  } else {
    console.log("ar_accounts columns:", Object.keys(ar[0] || {}));
    console.log("ar_accounts sample:", ar[0]);
  }
}
check();
