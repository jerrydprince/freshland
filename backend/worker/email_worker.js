import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY) {
  console.error("Missing required environment variables. Please check your .env file.");
  console.error(`URL: ${!!SUPABASE_URL}, ServiceKey: ${!!SUPABASE_SERVICE_KEY}, ResendKey: ${!!RESEND_API_KEY}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const resend = new Resend(RESEND_API_KEY);

console.log("🚀 Starting Luxe PMS Background Worker...");
console.log("✉️ Listening for new confirmed bookings to send confirmation emails...");

// Listen to Postgres Changes on the bookings table
supabase
  .channel('custom-all-channel')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'bookings' },
    async (payload) => {
      const { new: newRecord, old: oldRecord } = payload;
      
      // Trigger only when a booking goes from pending -> confirmed
      if (oldRecord.status !== 'confirmed' && newRecord.status === 'confirmed') {
        console.log(`[EVENT] Booking ${newRecord.booking_reference} confirmed! Preparing notifications...`);
        await Promise.all([
          sendBookingConfirmation(newRecord),
          sendBookingSMS(newRecord)
        ]);
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Successfully connected to Supabase Realtime');
    }
  });

async function sendBookingConfirmation(booking) {
  try {
    // Fetch room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('name')
      .eq('id', booking.room_id)
      .single();

    if (roomError) throw roomError;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #1a1a1a; padding: 30px; text-align: center; border-bottom: 3px solid #d4af37;">
          <h1 style="color: #fff; margin: 0;">Luxe Apartments</h1>
          <p style="color: #d4af37; letter-spacing: 2px; font-size: 12px; text-transform: uppercase;">Premium Hospitality</p>
        </div>
        
        <div style="padding: 40px 30px; background-color: #f9f9f9;">
          <h2 style="color: #1a1a1a; margin-top: 0;">Booking Confirmed!</h2>
          <p>Dear ${booking.guest_name},</p>
          <p>Thank you for choosing Luxe Apartments. Your reservation is confirmed and we are looking forward to hosting you.</p>
          
          <div style="background-color: #fff; padding: 25px; border-radius: 8px; border: 1px solid #eaeaea; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #d4af37; border-bottom: 1px solid #eaeaea; padding-bottom: 10px;">Reservation Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Reference:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${booking.booking_reference}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Room:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${room.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Check-in:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${booking.check_in_date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Check-out:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${booking.check_out_date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; border-top: 1px solid #eaeaea;">Total Paid:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; border-top: 1px solid #eaeaea; color: #1a1a1a;">₦${booking.amount_paid_ngn.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <p>If you have any special requests or need to modify your booking, please reply to this email or call our front desk.</p>
          <p>Safe travels!</p>
          
          <p style="margin-top: 30px; font-weight: bold;">
            Warm regards,<br>
            The Luxe Team
          </p>
        </div>
        
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center; color: #888; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Luxe Apartments. All rights reserved.</p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Luxe Reservations <onboarding@resend.dev>', // Use verified domain in production
      to: [booking.guest_email],
      subject: `Booking Confirmed: ${booking.booking_reference} at Luxe Apartments`,
      html: htmlContent
    });

    if (error) {
      console.error(`[ERROR] Failed to send email to ${booking.guest_email}:`, error);
    } else {
      console.log(`[SUCCESS] Email sent successfully to ${booking.guest_email}! ID: ${data.id}`);
    }

  } catch (error) {
    console.error(`[ERROR] Processing booking ${booking.id} failed:`, error);
  }
}

async function sendBookingSMS(booking) {
  try {
    const recipient = booking.guest_phone || booking.phone;
    if (!recipient || recipient === 'N/A') {
      console.log(`[SMS Worker] Skipping SMS for ${booking.booking_reference}: No recipient phone number.`);
      return;
    }

    // Load SMS settings from system_settings
    const { data: sysSettings, error: dbErr } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'sms_gateway',
        'sms_termii_api_key',
        'sms_termii_sender_id',
        'sms_twilio_account_sid',
        'sms_twilio_auth_token',
        'sms_twilio_from_number',
        'sms_confirmation_template'
      ]);

    if (dbErr) throw dbErr;

    const sMap = sysSettings?.reduce((acc, curr) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, {}) || {};

    const gateway = sMap.sms_gateway || 'mock';
    const termiiKey = sMap.sms_termii_api_key || '';
    const termiiSender = sMap.sms_termii_sender_id || 'Sparkles';
    const twilioSid = sMap.sms_twilio_account_sid || '';
    const twilioToken = sMap.sms_twilio_auth_token || '';
    const twilioFrom = sMap.sms_twilio_from_number || '';
    const template = sMap.sms_confirmation_template || 'Hi {{guest_name}}, your booking {{booking_ref}} is confirmed!';

    // Fetch room details
    const { data: room } = await supabase
      .from('rooms')
      .select('name')
      .eq('id', booking.room_id)
      .single();
    const roomName = room ? room.name : 'Premium Suite';

    // Interpolate message template
    const message = template
      .replace(/{{guest_name}}/g, booking.guest_name || 'Guest')
      .replace(/{{booking_ref}}/g, booking.booking_reference || 'BKG-MOCK')
      .replace(/{{check_in}}/g, booking.check_in_date || '')
      .replace(/{{check_out}}/g, booking.check_out_date || '')
      .replace(/{{room_number}}/g, roomName);

    // Normalize phone number to include international code, stripping optional lead symbols
    let normalizedPhone = recipient.trim();
    if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
      normalizedPhone = '234' + normalizedPhone.slice(1);
    } else if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.slice(1);
    }

    console.log(`[SMS Worker] Dispatching confirmed booking SMS via "${gateway}" to: ${normalizedPhone}`);

    let sentStatus = 'failed';
    let errorMsg = null;

    if (gateway === 'termii') {
      if (!termiiKey) throw new Error('Termii API Key is not configured in settings.');
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: normalizedPhone,
          from: termiiSender,
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: termiiKey
        })
      });
      const data = await response.json();
      if (response.ok && (data.message === 'Successfully Sent' || data.code === 'ok')) {
        sentStatus = 'sent';
      } else {
        errorMsg = data.message || 'Termii SMS API failed to accept message';
      }
    } else if (gateway === 'twilio') {
      if (!twilioSid || !twilioToken || !twilioFrom) throw new Error('Twilio credentials not configured in settings.');
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const bodyParams = new URLSearchParams();
      const formattedTo = normalizedPhone.startsWith('+') ? normalizedPhone : '+' + normalizedPhone;
      bodyParams.append('To', formattedTo);
      bodyParams.append('From', twilioFrom);
      bodyParams.append('Body', message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString()
      });
      const data = await response.json();
      if (response.ok) {
        sentStatus = 'sent';
      } else {
        errorMsg = data.message || 'Twilio SMS API failed';
      }
    } else {
      // Mock Sandbox Mode
      console.log(`[SMS Worker - Sandbox] Message: "${message}"`);
      sentStatus = 'sent';
    }

    // Commit notification log entry
    await supabase.from('notification_logs').insert([{
      recipient: normalizedPhone,
      channel: 'sms',
      template_name: 'Confirmed Booking SMS Alert',
      status: sentStatus,
      error_message: errorMsg,
      sent_at: new Date().toISOString()
    }]);

    console.log(`[SMS Worker] SMS dispatch finished. Status: ${sentStatus}`);
  } catch (err) {
    console.error(`[SMS Worker Error] Booking notification failed:`, err.message);
  }
}

