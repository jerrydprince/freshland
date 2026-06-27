import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('staff_salaries').select('*').limit(1);
  if (error) {
    console.error("Error fetching staff_salaries:", error);
  } else {
    console.log("staff_salaries sample record columns:", Object.keys(data[0] || {}));
  }
}
check();
