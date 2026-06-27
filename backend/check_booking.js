import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== Querying booking MAN-1NGLF8 ===");
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, invoices(*), payments(*), booking_services(*, services(*))')
    .eq('booking_reference', 'MAN-1NGLF8')
    .maybeSingle();

  if (error) {
    console.error("Error fetching booking:", error);
  } else {
    console.log("Booking details:", JSON.stringify(booking, null, 2));
  }
}

run();
