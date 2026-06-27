import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);
  
  const { data: profs, error: profErr } = await supabase.from('maintenance_professionals').select('*').limit(1);
  if (profErr) {
    console.error("Error fetching maintenance_professionals:", profErr);
  } else {
    console.log("maintenance_professionals columns:", Object.keys(profs[0] || {}));
  }

  const { data: payments, error: payErr } = await supabase.from('maintenance_payments').select('*').limit(1);
  if (payErr) {
    console.error("Error fetching maintenance_payments:", payErr);
  } else {
    console.log("maintenance_payments columns:", Object.keys(payments[0] || {}));
  }
}

check();
