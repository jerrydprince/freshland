import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking daily_closures table...");
  const { data: closuresData, error: closuresError } = await supabase.from('daily_closures').select('*');
  if (closuresError) {
    console.error("Error fetching daily_closures:", closuresError);
  } else {
    console.log(`Successfully fetched ${closuresData.length} records from daily_closures table:`, closuresData);
  }

  console.log("\nChecking system_settings table for daily_closure_reports...");
  const { data: settingsData, error: settingsError } = await supabase.from('system_settings').select('*').eq('setting_key', 'daily_closure_reports').maybeSingle();
  if (settingsError) {
    console.error("Error fetching daily_closure_reports from system_settings:", settingsError);
  } else {
    console.log("system_settings daily_closure_reports data:", settingsData);
  }
}
check();
