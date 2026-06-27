const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';

const passwords = ['password', 'password123', 'admin123', 'admin', 'testing123', 'sparkles2026', 'sparkles123'];

async function main() {
  for (const pw of passwords) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'testuser@gmail.com',
          password: pw
        })
      });
      const data = await res.json();
      if (data.error) {
        console.log(`Failed for password: ${pw} - ${data.error_description || data.error}`);
      } else {
        console.log(`SUCCESS! Password is: ${pw}`);
        break;
      }
    } catch (err) {
      console.log(`Error testing ${pw}:`, err.message);
    }
  }
}
main();
