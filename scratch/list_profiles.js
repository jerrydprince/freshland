const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';

async function main() {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, { headers });
  const profiles = await res.json();
  console.log(JSON.stringify(profiles, null, 2));
}
main();
