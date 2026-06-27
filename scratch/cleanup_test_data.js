import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const testEmails = [
  'temp_admin_1780787789880@example.com',
  'test@example.com',
  'testuser@gmail.com',
  'testuser@example.com',
  'sparklestestnotify@yopmail.com',
  'newadmin@sparkles.com',
  'jerry@example.com',
  'john.doe@example.com',
  'testguest_updated@luxe.com',
  'reset_admin_1779632355019@luxe.com',
  'temp_admin_1779631475077@luxe.com'
];

async function main() {
  console.log("Signing in as Jerry Nosike (Super Admin) to gain delete privileges...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jerrydprince@gmail.com',
    password: 'Jerry08283139'
  });

  if (authErr) {
    console.error("Authentication failed:", authErr.message);
    return;
  }

  console.log("Logged in successfully! User ID:", authData.user.id);
  supabase.auth.setSession(authData.session);

  // 1. Fetch profiles matching test emails
  console.log("Fetching profiles matching test emails...");
  const { data: profiles, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', testEmails);

  if (fetchErr) {
    console.error("Failed to fetch profiles:", fetchErr.message);
    return;
  }

  const profileIds = profiles.map(p => p.id);
  console.log(`Found ${profiles.length} test profiles in public.profiles:`, profiles.map(p => p.email));

  if (profileIds.length > 0) {
    // 2. Fetch test bookings
    console.log("Fetching bookings for test profiles...");
    const { data: bookings, error: bookingsFetchErr } = await supabase
      .from('bookings')
      .select('id')
      .in('guest_id', profileIds);

    if (bookingsFetchErr) {
      console.warn("Failed to fetch test bookings:", bookingsFetchErr.message);
    } else {
      const bookingIds = bookings.map(b => b.id);
      console.log(`Found ${bookingIds.length} bookings to purge.`);

      if (bookingIds.length > 0) {
        // Delete payments
        console.log("Deleting payments...");
        const { error: payErr } = await supabase.from('payments').delete().in('booking_id', bookingIds);
        if (payErr) console.warn("Error deleting payments:", payErr.message);

        // Delete booking extras
        console.log("Deleting booking extras...");
        const { error: extraErr } = await supabase.from('booking_extras').delete().in('booking_id', bookingIds);
        if (extraErr) console.warn("Error deleting booking extras:", extraErr.message);

        // Delete bookings
        console.log("Deleting bookings...");
        const { error: bookErr } = await supabase.from('bookings').delete().in('id', bookingIds);
        if (bookErr) console.warn("Error deleting bookings:", bookErr.message);
      }
    }
  }

  // 3. Purge crm_guests communication logs
  console.log("Deleting communication logs for test CRM guests...");
  const { data: crmGuests, error: crmFetchErr } = await supabase
    .from('crm_guests')
    .select('id')
    .in('email', testEmails);

  if (!crmFetchErr && crmGuests && crmGuests.length > 0) {
    const crmIds = crmGuests.map(cg => cg.id);
    const { error: commErr } = await supabase.from('communication_logs').delete().in('crm_guest_id', crmIds);
    if (commErr) console.warn("Error deleting communication logs:", commErr.message);

    // Delete CRM Guest cards
    console.log("Deleting crm_guests cards...");
    const { error: cgDelErr } = await supabase.from('crm_guests').delete().in('id', crmIds);
    if (cgDelErr) console.warn("Error deleting crm_guests:", cgDelErr.message);
  }

  // 4. Delete profiles
  if (profileIds.length > 0) {
    console.log("Deleting profiles...");
    const { error: profDelErr } = await supabase.from('profiles').delete().in('id', profileIds);
    if (profDelErr) {
      console.error("Error deleting profiles:", profDelErr.message);
    } else {
      console.log("Profiles deleted successfully.");
    }
  }

  console.log("\nCleanup script completed. Please run purge_test_auth_users.sql in Supabase Dashboard SQL Editor to delete the auth credentials.");
}

main();
