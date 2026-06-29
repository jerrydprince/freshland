import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
const supabaseKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
const supabase = createClient(supabaseUrl, supabaseKey);

const templates = [
  {
    name: 'Welcome Email',
    channel: 'email',
    subject: 'Your Booking Details - Freshland',
    body: `Dear {{guest_name}},

Thank you for choosing Freshland! We are delighted to confirm your booking.

Booking Details:
- Booking Reference: {{booking_ref}}
- Check-in Date: {{check_in}}
- Check-out Date: {{check_out}}
- Room Details: {{room_details}}
- Total Amount: NGN {{total_amount}}
- Payment Status: {{payment_status}}

If you have any questions or need to make changes to your booking, please don't hesitate to contact us.

We look forward to welcoming you!

Warm regards,
The Freshland Team`
  },
  {
    name: 'Booking Confirmed Email',
    channel: 'email',
    subject: 'Booking Confirmed - {{booking_ref}} - Freshland',
    body: `Dear {{guest_name}},

Your booking {{booking_ref}} has been successfully confirmed.

Stay Details:
- Check-in: {{check_in}} (from 2:00 PM)
- Check-out: {{check_out}} (by 11:00 AM)
- Room Details: {{room_details}}

We are preparing everything for your arrival. Please let us know if you have any special requests.

Best regards,
Freshland Desk`
  },
  {
    name: 'Booking Cancelled Email',
    channel: 'email',
    subject: 'Booking Cancelled - {{booking_ref}} - Freshland',
    body: `Dear {{guest_name}},

This email confirms that your booking {{booking_ref}} has been cancelled.

Cancellation Details:
- Booking Reference: {{booking_ref}}
- Check-in Date: {{check_in}}
- Check-out Date: {{check_out}}

If this cancellation was made in error or you would like to reschedule, please reach out to our team immediately.

Sincerely,
Freshland Team`
  },
  {
    name: 'Check-in Confirmation Email',
    channel: 'email',
    subject: 'Welcome to Freshland! Checked-in successfully - {{booking_ref}}',
    body: `Dear {{guest_name}},

Welcome to Freshland! You have been checked in successfully.

Your Room: Room {{room_number}} ({{room_details}})
Check-out Date: {{check_out}} (by 11:00 AM)

WiFi & General Info:
- WiFi Network: Sparkles_Guest
- WiFi Password: sparklesluxury
- For any service request, dial 0 or contact front office.

We hope you have an exceptional stay!

Warm regards,
Front Desk Operations`
  },
  {
    name: 'Checkout Summary Email',
    channel: 'email',
    subject: 'Thank you for staying at Freshland - {{booking_ref}}',
    body: `Dear {{guest_name}},

Thank you for choosing Freshland. We hope you enjoyed your stay!

Your booking has been checked out, and your stay ledger is now settled.

Checkout Details:
- Booking Reference: {{booking_ref}}
- Check-in Date: {{check_in}}
- Check-out Date: {{check_out}}
- Room Details: {{room_details}}
- Total Paid: NGN {{total_paid}}

A copy of your final receipt is attached or available in your guest account. Safe travels and we hope to host you again soon!

Sincerely,
The Freshland Team`
  },
  {
    name: 'Payment Receipt Email',
    channel: 'email',
    subject: 'Payment Receipt - {{payment_ref}} - Freshland',
    body: `Dear {{guest_name}},

Thank you for your payment. We have successfully processed the following transaction:

Payment Details:
- Booking Reference: {{booking_ref}}
- Payment Reference: {{payment_ref}}
- Amount Paid: NGN {{payment_amount}}
- Payment Method: {{payment_method}}
- Transaction Date: {{payment_date}}

Current Balance: NGN {{balance_due}}

Thank you for your business.

Best regards,
Finance Department, Freshland`
  },
  {
    name: 'Booking Invoice Email',
    channel: 'email',
    subject: 'Invoice Issued - {{invoice_number}} - Freshland',
    body: `Dear {{guest_name}},

Please find below the invoice details for your stay at Freshland:

Invoice Summary:
- Invoice Number: {{invoice_number}}
- Booking Reference: {{booking_ref}}
- Check-in Date: {{check_in}}
- Check-out Date: {{check_out}}
- Room Details: {{room_details}}
- Total Stay Charge: NGN {{total_amount}}
- Total Paid: NGN {{total_paid}}
- Balance Due: NGN {{balance_due}}

If you have any billing queries, please reply directly to this email.

Thank you for choosing Freshland.

Sincerely,
Accounts Department, Freshland`
  },
  {
    name: 'Check-in Reminder (SMS)',
    channel: 'sms',
    subject: null,
    body: 'Hi {{guest_name}}, your stay at Freshland begins tomorrow! Check-in is at 2:00 PM. See you soon!'
  },
  {
    name: 'Checkout Reminder (SMS)',
    channel: 'sms',
    subject: null,
    body: 'Hi {{guest_name}}, this is a reminder that check-out for Room {{room_number}} is tomorrow at 11:00 AM. Thank you for staying with us!'
  },
  {
    name: 'Appreciation (SMS)',
    channel: 'sms',
    subject: null,
    body: 'Dear {{guest_name}}, thank you for staying at Freshland. We appreciate your patronage and hope to host you again soon!'
  }
];

const rulesMapping = [
  { name: 'Send Welcome & Booking Details Email', trigger: 'booking_created', templateName: 'Welcome Email' },
  { name: 'Send Booking Confirmation Email', trigger: 'booking_confirmed', templateName: 'Booking Confirmed Email' },
  { name: 'Send Booking Cancellation Email', trigger: 'booking_cancelled', templateName: 'Booking Cancelled Email' },
  { name: 'Send Check-in Welcome & Instructions Email', trigger: 'check_in', templateName: 'Check-in Confirmation Email' },
  { name: 'Send Checkout Summary Email', trigger: 'checkout', templateName: 'Checkout Summary Email' },
  { name: 'Send Payment Receipt Email', trigger: 'payment_received', templateName: 'Payment Receipt Email' },
  { name: 'Send Booking Invoice Email', trigger: 'invoice_issued', templateName: 'Booking Invoice Email' },
  { name: 'Send Check-in SMS 24hr Before', trigger: 'check_in_1day', templateName: 'Check-in Reminder (SMS)' },
  { name: 'Send Checkout SMS Reminder', trigger: 'check_out_1day', templateName: 'Checkout Reminder (SMS)' },
  { name: 'Send Appreciation SMS', trigger: 'checkout', templateName: 'Appreciation (SMS)' }
];

async function main() {
  console.log("=== SEEDING SPARKLES AUTOMATIONS ===");

  // 1. Delete existing rules & templates to prevent duplicates and clean old Luxe references
  console.log("Deleting old rules...");
  const { error: delRulesErr } = await supabase.from('automation_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delRulesErr) {
    console.error("Failed to delete automation rules:", delRulesErr);
    return;
  }

  console.log("Deleting old templates...");
  const { error: delTemplatesErr } = await supabase.from('notification_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delTemplatesErr) {
    console.error("Failed to delete templates:", delTemplatesErr);
    return;
  }

  // 2. Insert new templates
  console.log("Inserting new templates...");
  const { data: insertedTemplates, error: insTemplatesErr } = await supabase
    .from('notification_templates')
    .insert(templates)
    .select();

  if (insTemplatesErr) {
    console.error("Failed to insert templates:", insTemplatesErr);
    return;
  }
  console.log(`Successfully inserted ${insertedTemplates.length} templates.`);

  // 3. Insert new rules
  console.log("Inserting new rules...");
  const rulesToInsert = rulesMapping.map(r => {
    const matchedTemplate = insertedTemplates.find(t => t.name === r.templateName);
    if (!matchedTemplate) {
      throw new Error(`Template not found: ${r.templateName}`);
    }
    return {
      name: r.name,
      trigger_event: r.trigger,
      template_id: matchedTemplate.id,
      is_active: true,
      delay_minutes: 0
    };
  });

  const { data: insertedRules, error: insRulesErr } = await supabase
    .from('automation_rules')
    .insert(rulesToInsert)
    .select();

  if (insRulesErr) {
    console.error("Failed to insert rules:", insRulesErr);
    return;
  }
  console.log(`Successfully inserted ${insertedRules.length} rules.`);
  console.log("Seeding completed successfully!");
}

main();
