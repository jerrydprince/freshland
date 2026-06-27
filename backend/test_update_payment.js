import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testUpdate() {
  console.log("Fetching a pending payment...");
  const { data: payments, error: fetchErr } = await supabase
    .from('maintenance_payments')
    .select('*')
    .eq('payment_status', 'pending')
    .limit(1);

  if (fetchErr) {
    console.error("Fetch Error:", fetchErr);
    return;
  }

  if (!payments || payments.length === 0) {
    console.log("No pending payments found.");
    return;
  }

  const payment = payments[0];
  console.log(`Found payment ${payment.id}. Attempting to update to 'approved'...`);

  const { data, error: updateErr } = await supabase
    .from('maintenance_payments')
    .update({ payment_status: 'approved' })
    .eq('id', payment.id)
    .select();

  if (updateErr) {
    console.error("Update Error:", updateErr);
  } else {
    console.log("Update Success:", data);
  }
}

testUpdate();
