const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';

async function main() {
  const email = 'newadmin@sparkles.com';
  const password = 'password123';

  console.log(`Signing in ${email}...`);
  const signInRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const signInData = await signInRes.json();
  if (signInData.error) {
    console.error('Sign in error:', signInData.error.message || signInData.error);
    return;
  }

  const userId = signInData.user.id;
  const accessToken = signInData.access_token;
  console.log(`User authenticated successfully. ID: ${userId}`);

  console.log(`Updating user ${userId} to super_admin...`);
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ role: 'super_admin' })
  });

  const data = await res.json();
  console.log('Successfully updated profiles role:', JSON.stringify(data, null, 2));
}

main();
