import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const email = `temp_admin_${Date.now()}@example.com`;
  const password = 'TempPassword123!';

  console.log(`Signing up temp user: ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError.message);
    return;
  }

  const userId = signUpData.user.id;
  console.log(`Sign up success! User ID: ${userId}.`);

  // Set the session
  supabase.auth.setSession(signUpData.session);

  console.log("Attempting to update profile role to super_admin...");
  const { data: updateData, error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', userId)
    .select();

  if (updateError) {
    console.error("Update role failed:", updateError.message);
  } else {
    console.log("Update role success! Response:", updateData);
  }

  // Cleanup: delete user profile if possible, or just print status
  const { data: finalProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  console.log("Final profile in DB:", finalProfile);
}

test();
