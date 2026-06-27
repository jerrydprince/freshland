import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = ['maintenance_tickets', 'maintenance_professionals', 'maintenance_purchases', 'maintenance_payments', 'expenses'];
  for (const table of tables) {
    console.log(`Checking table: ${table}...`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`- Error for ${table}:`, error.message);
    } else {
      console.log(`- Success for ${table}, record count/sample:`, data.length);
    }
  }
}
check();
