import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .in('role', ['super_admin', 'admin', 'hotel_manager', 'manager'])
    .limit(5);

  if (error) {
    console.error("Error fetching admin profiles:", error);
    return;
  }
  
  console.log("Admin Profiles found:");
  profiles.forEach(p => {
    console.log(`- ${p.first_name} ${p.last_name} (${p.email}) - Role: ${p.role}`);
  });
}

run();
