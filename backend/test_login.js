import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const accounts = [
    { email: 'newadmin@sparkles.com', password: 'password123' },
    { email: 'jerrydprince@gmail.com', password: 'Jerry08283139' },
    { email: 'testuser@gmail.com', password: 'password' },
    { email: 'admin@gmail.com', password: 'password' }
  ];

  for (const acc of accounts) {
    console.log(`Trying login for ${acc.email} / ${acc.password}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.password
    });
    if (error) {
      console.log(`Failed: ${error.message}`);
    } else {
      console.log(`SUCCESS! Logged in as ${data.user.email}, ID: ${data.user.id}`);
      // check role
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      console.log(`Profile Role: ${prof?.role}`);
    }
  }
}

test();
