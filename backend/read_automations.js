import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== AUTOMATION RULES ===");
  const { data: rules, error: rulesErr } = await supabase.from('automation_rules').select('*, notification_templates(*)');
  if (rulesErr) {
    console.error(rulesErr);
  } else {
    console.log(JSON.stringify(rules, null, 2));
  }

  console.log("\n=== ALL NOTIFICATION TEMPLATES ===");
  const { data: templates, error: templatesErr } = await supabase.from('notification_templates').select('*');
  if (templatesErr) {
    console.error(templatesErr);
  } else {
    console.log(JSON.stringify(templates, null, 2));
  }
}
main();
