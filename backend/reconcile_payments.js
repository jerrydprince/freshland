import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const secretKey = process.env.PAYSTACK_SECRET_KEY;

async function reconcile() {
  console.log("=== Starting Payment Reconciliation ===");
  
  // 1. Fetch all unpaid/pending bookings
  const { data: bookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, booking_reference, guest_email, guest_name, total_amount_ngn, amount_paid_ngn, status, payment_status, created_at')
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid');
    
  if (bookingsErr) {
    console.error("Error fetching bookings:", bookingsErr);
    return;
  }
  
  console.log(`Found ${bookings.length} unpaid pending bookings in DB.`);

  // 2. Fetch successful transactions from Paystack
  let paystackTxns = [];
  try {
    const response = await fetch(`https://api.paystack.co/transaction?perPage=100&status=success`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    });
    const data = await response.json();
    if (data.status) {
      paystackTxns = data.data;
    } else {
      console.error("Failed to fetch Paystack transactions:", data.message);
      return;
    }
  } catch (e) {
    console.error("Error fetching Paystack transactions:", e.message);
    return;
  }

  console.log(`Retrieved ${paystackTxns.length} successful transactions from Paystack.`);

  const matches = [];
  
  // 3. Match bookings with Paystack transactions
  for (const booking of bookings) {
    // Calculate expected deposit amount
    const totalAmount = Number(booking.total_amount_ngn);
    const subtotal = totalAmount / 1.075;
    const expectedDeposit30 = parseFloat((subtotal * 0.30).toFixed(2));
    const expectedDeposit50 = parseFloat((subtotal * 0.50).toFixed(2));
    
    // Look for a matching transaction
    const bEmail = booking.guest_email?.toLowerCase().trim();
    const bDate = new Date(booking.created_at);
    
    const matchedTx = paystackTxns.find(tx => {
      const txEmail = tx.customer?.email?.toLowerCase().trim();
      const txDate = new Date(tx.paid_at);
      const txAmountNgn = tx.amount / 100;
      
      // Criteria:
      // 1. Email matches
      const emailMatch = txEmail === bEmail;
      
      // 2. Amount matches (either full total, 30% deposit, or 50% deposit - allow small variance)
      const amountMatch = 
        Math.abs(txAmountNgn - totalAmount) < 5 || 
        Math.abs(txAmountNgn - expectedDeposit30) < 5 ||
        Math.abs(txAmountNgn - expectedDeposit50) < 5 ||
        Math.abs(txAmountNgn - (totalAmount * 0.30)) < 5 ||
        Math.abs(txAmountNgn - (totalAmount * 0.50)) < 5;
        
      // 3. Timing matches (transaction paid within 30 minutes of booking creation)
      const timeDiffMins = Math.abs(txDate - bDate) / 60000;
      const timeMatch = timeDiffMins < 45;

      return emailMatch && amountMatch && timeMatch;
    });

    if (matchedTx) {
      matches.push({
        booking,
        transaction: matchedTx,
        expectedDeposit30,
        paidAmount: matchedTx.amount / 100
      });
    }
  }

  console.log(`\n=== Found ${matches.length} matches ===`);
  for (const m of matches) {
    console.log(`\nBooking Ref: ${m.booking.booking_reference}`);
    console.log(`- Guest: ${m.booking.guest_name} (${m.booking.guest_email})`);
    console.log(`- Room: Room ${m.booking.rooms?.room_number || 'N/A'}`);
    console.log(`- Created At: ${m.booking.created_at}`);
    console.log(`- Booking Total: ${m.booking.total_amount_ngn} NGN`);
    console.log(`- Match Paystack Tx Ref: ${m.transaction.reference}`);
    console.log(`  Paid At: ${m.transaction.paid_at}`);
    console.log(`  Paid Amount: ${m.paidAmount} NGN (Expected 30% Deposit: ${m.expectedDeposit30} NGN)`);
  }

  // If argument '--apply' is passed, update the database
  if (process.argv.includes('--apply')) {
    console.log("\n=== Applying updates to database ===");
    for (const m of matches) {
      const refCode = m.booking.booking_reference;
      const txRef = m.transaction.reference;
      const paidAmount = m.paidAmount;
      const totalAmount = Number(m.booking.total_amount_ngn);
      
      // Determine if it is partial or paid
      const statusPayment = paidAmount < (totalAmount - 10) ? 'partial' : 'paid';
      
      console.log(`Updating booking ${refCode}...`);
      
      // A. Update booking details
      const { error: bErr } = await supabase
        .from('bookings')
        .update({
          payment_status: statusPayment,
          amount_paid_ngn: paidAmount,
        })
        .eq('id', m.booking.id);
        
      if (bErr) {
        console.error(`- Booking update error for ${refCode}:`, bErr.message);
        continue;
      }
      
      // B. Insert payment record
      const { error: pErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: m.booking.id,
          amount: paidAmount,
          method: 'paystack',
          transaction_ref: txRef,
          status: 'completed',
          notes: `Reconciled via script from Paystack Tx ${txRef}`
        }]);
        
      if (pErr) {
        console.error(`- Payment insert error for ${refCode}:`, pErr.message);
      }

      // C. Update invoice status
      const { error: iErr } = await supabase
        .from('invoices')
        .update({
          amount_paid: paidAmount,
          status: statusPayment
        })
        .eq('booking_id', m.booking.id);
        
      if (iErr) {
        console.error(`- Invoice sync error for ${refCode}:`, iErr.message);
      }
      
      console.log(`✓ Reconciled successfully!`);
    }
  } else {
    console.log("\nTo apply these updates, run the script with '--apply':");
    console.log("node reconcile_payments.js --apply");
  }
}

reconcile();
