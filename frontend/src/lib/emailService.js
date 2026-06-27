import { supabase } from './supabase';

/**
 * Resend API Client-Side Wrapper
 * 
 * Prioritizes relative fetch calls to backend Express route (/api/email/send) 
 * to secure Resend API keys. Falls back to mock simulation or client environment 
 * key if backend is offline.
 */
export const sendResendEmail = async ({ to, subject, html, from }) => {
  try {
    console.log(`[Resend Client] Dispatching email to: ${to} via backend proxy...`);
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, html, from })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, id: data.id || 'msg_' + Math.random().toString(36).substr(2, 9) };
    }

    const errText = await response.text();
    console.warn(`[Resend Client] Backend endpoint failed (${response.status}): ${errText}. Falling back...`);
  } catch (e) {
    console.warn(`[Resend Client] Backend proxy unreachable: ${e.message}. Falling back...`);
  }

  // FALLBACK 1: Direct Client-Side call if VITE_RESEND_API_KEY is defined
  const CLIENT_KEY = import.meta.env.VITE_RESEND_API_KEY;
  if (CLIENT_KEY) {
    try {
      console.log(`[Resend Client] Direct dispatch attempt via client key...`);
      const directResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLIENT_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Sparkles Apartments <onboarding@resend.dev>',
          to: [to],
          subject: subject,
          html: html
        })
      });

      if (directResponse.ok) {
        const directData = await directResponse.json();
        return { success: true, id: directData.id };
      }
      const directErr = await directResponse.json();
      console.error(`[Resend Client] Direct Resend API failed:`, directErr);
    } catch (directErr) {
      console.error(`[Resend Client] Direct Resend API error:`, directErr);
    }
  }

  // FALLBACK 2: Local Simulation
  console.warn(`[Resend Client] Simulating email delivery to: ${to}`);
  await new Promise(resolve => setTimeout(resolve, 800));
  return { success: true, simulated: true };
};

/**
 * Live Automation Trigger Engine
 * Resolves active triggers, formats templates with dynamic variables,
 * dispatches notifications via secure channels, and records to logs.
 */
export const triggerAutomationRules = async (triggerEvent, bookingData) => {
  if (!bookingData) {
    console.warn(`[Automation Engine] Trigger aborted for ${triggerEvent}: Missing payload.`);
    return { success: false, reason: 'Missing booking payload' };
  }

  try {
    console.log(`[Automation Engine] Triggered event: "${triggerEvent}"`);

    // 1. Check if Notification Engine is enabled globally & load contact info
    const { data: sysSettings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'notification_engine_active', 
        'contact_logo', 
        'contact_address', 
        'contact_phone', 
        'contact_email',
        'system_theme'
      ]);
      
    const settingsMap = sysSettings?.reduce((acc, curr) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, {}) || {};
    
    const isEngineActive = settingsMap.notification_engine_active === 'true' || 
                           settingsMap.notification_engine_active === true || 
                           settingsMap.notification_engine_active === undefined;
    
    if (!isEngineActive) {
      console.log(`[Automation Engine] Engine is toggled offline in System Control.`);
      return { success: false, reason: 'Notification engine inactive' };
    }

    const systemTheme = settingsMap.system_theme || 'theme-luxe-gold';
    const themeColors = {
      'theme-slate-dark': '#64748B',
      'theme-luxe-gold': '#DF6853',
      'theme-emerald-green': '#10B981',
      'theme-royal-blue': '#3B82F6',
      'theme-sunset-orange': '#F97316',
      'theme-rose-burgundy': '#F43F5E',
      'theme-midnight-purple': '#A855F7',
      'theme-ocean-teal': '#14B8A6'
    };
    const accentColor = themeColors[systemTheme] || '#DF6853';

    let contactLogo = settingsMap.contact_logo || 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    if (contactLogo && contactLogo.startsWith('/')) {
      contactLogo = window.location.origin + contactLogo;
    }
    const contactAddress = settingsMap.contact_address || 'Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja';
    const contactPhone = settingsMap.contact_phone || '08033214684, 08062332639, 08171278657';
    const contactEmail = settingsMap.contact_email || 'info@sparklesapartments.ng';

    // 2. Query automation rules for trigger event
    const { data: rules, error: rulesErr } = await supabase
      .from('automation_rules')
      .select('*, notification_templates(*)')
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true);

    if (rulesErr) {
      console.error(`[Automation Engine] Failed to fetch active rules:`, rulesErr);
      return { success: false, error: rulesErr.message };
    }

    if (!rules || rules.length === 0) {
      console.log(`[Automation Engine] Zero active rules configured for event "${triggerEvent}".`);
      return { success: true, count: 0 };
    }

    console.log(`[Automation Engine] Processing ${rules.length} automations for "${triggerEvent}"...`);

    const results = [];
    for (const rule of rules) {
      const template = rule.notification_templates;
      if (!template) continue;

      // Extract variables safely with proper fallbacks
      const profile = bookingData.profiles || {};
      const guestName = bookingData.guest_name || 
                        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 
                        'Valued Guest';
                        
      const guestEmail = bookingData.guest_email || bookingData.email || profile.email || 'guest@example.com';
      const guestPhone = bookingData.guest_phone || bookingData.phone || profile.phone || 'N/A';
      
      const bookingRef = bookingData.booking_reference || bookingData.id || 'BKG-MOCK';
      const checkIn = bookingData.check_in_date || bookingData.check_in || 'N/A';
      const checkOut = bookingData.check_out_date || bookingData.check_out || 'N/A';

      const recipient = template.channel === 'email' ? guestEmail : guestPhone;

      if (!recipient || recipient === 'N/A') {
        console.warn(`[Automation Engine] Skipping rule "${rule.name}": No recipient detail.`);
        continue;
      }

      // Additional variables
      const roomNum = bookingData.room_number || (bookingData.rooms && bookingData.rooms.room_number) || 'N/A';
      const roomDetails = bookingData.room_details || (bookingData.rooms && bookingData.rooms.name) || 'Premium Suite';

      const totalAmount = bookingData.total_amount || bookingData.total_amount_ngn || bookingData.total_price || '0.00';
      const totalPaid = bookingData.total_paid || bookingData.amount_paid || bookingData.amount_paid_ngn || '0.00';
      const balanceDue = bookingData.balance_due !== undefined ? bookingData.balance_due : (Number(totalAmount) - Number(totalPaid)).toFixed(2);
      const paymentStatus = bookingData.payment_status || 'Pending';

      const paymentAmount = bookingData.payment_amount || bookingData.amount || '0.00';
      const paymentRef = bookingData.payment_ref || bookingData.payment_reference || 'N/A';
      const paymentMethod = bookingData.payment_method || 'N/A';
      const paymentDate = bookingData.payment_date || new Date().toLocaleDateString();

      const invoiceNum = bookingData.invoice_number || ('INV-' + bookingRef);

      // Variable interpolation
      const formatString = (str) => {
        if (!str) return '';
        return str
          .replace(/{{guest_name}}/g, guestName)
          .replace(/{{booking_ref}}/g, bookingRef)
          .replace(/{{check_in}}/g, checkIn)
          .replace(/{{check_out}}/g, checkOut)
          .replace(/{{room_number}}/g, roomNum)
          .replace(/{{room_details}}/g, roomDetails)
          .replace(/{{total_amount}}/g, Number(totalAmount).toLocaleString())
          .replace(/{{total_paid}}/g, Number(totalPaid).toLocaleString())
          .replace(/{{balance_due}}/g, Number(balanceDue).toLocaleString())
          .replace(/{{payment_status}}/g, paymentStatus)
          .replace(/{{payment_amount}}/g, Number(paymentAmount).toLocaleString())
          .replace(/{{payment_ref}}/g, paymentRef)
          .replace(/{{payment_method}}/g, paymentMethod.toUpperCase())
          .replace(/{{payment_date}}/g, paymentDate)
          .replace(/{{invoice_number}}/g, invoiceNum);
      };

      const parsedSubject = formatString(template.subject || 'Sparkles Apartments Update');
      const parsedBody = formatString(template.body || '');

      let sentStatus = 'failed';
      let errorMsg = null;
      let isSimulated = false;

      if (template.channel === 'email') {
        const emailHtml = `
          <div style="font-family: 'Outfit', sans-serif; padding: 30px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 6px solid ${accentColor}; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
              ${contactLogo ? `<img src="${contactLogo}" alt="Sparkles Apartments" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />` : ''}
              <h2 style="color: #000000; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">SPARKLES APARTMENTS</h2>
              <span style="font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">Premium Luxury Shortlets</span>
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
              ${parsedBody.replace(/\n/g, '<br/>')}
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 5px 0;">This is an automated operational alert sent from the Sparkles PMS Hub.</p>
              <p style="margin: 0;">${contactAddress}</p>
              <p style="margin: 5px 0 0 0;">Phones: ${contactPhone} | Email: ${contactEmail}</p>
            </div>
          </div>
        `;

        const result = await sendResendEmail({
          to: recipient,
          subject: parsedSubject,
          from: 'booking@sparklesapartments.ng',
          html: emailHtml
        });

        if (result.success) {
          sentStatus = 'sent';
          isSimulated = !!result.simulated;
        } else {
          errorMsg = result.error || 'SMTP routing failure';
        }

        // Also duplicate to booking@sparklesapartments.ng as admin notification
        if (recipient !== 'booking@sparklesapartments.ng') {
          try {
            console.log(`[Automation Engine] Forwarding admin copy of booking update to booking@sparklesapartments.ng...`);
            const adminHtml = `
              <div style="background-color: #f3f4f6; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; color: #4b5563; line-height: 1.5;">
                <strong>[PMS Admin Notification]</strong><br/>
                Recipient: <strong>${guestName}</strong> (${recipient})<br/>
                Trigger Event: <strong>${triggerEvent}</strong>
              </div>
              ${emailHtml}
            `;
            await sendResendEmail({
              to: 'booking@sparklesapartments.ng',
              subject: `[ADMIN] ${parsedSubject}`,
              from: 'booking@sparklesapartments.ng',
              html: adminHtml
            });
          } catch (adminCopyErr) {
            console.warn(`[Automation Engine] Failed to dispatch admin copy:`, adminCopyErr);
          }
        }
      } else if (template.channel === 'sms') {
        // Real SMS gateway dispatch
        const result = await sendSMSNotification({
          to: recipient,
          message: parsedBody
        });

        if (result.success) {
          sentStatus = 'sent';
          isSimulated = !!result.simulated;
        } else {
          errorMsg = result.error || 'SMS Gateway routing failure';
        }
      } else {
        // WhatsApp, Push simulation
        console.log(`[Automation Engine] Simulating "${template.channel}" dispatch to ${recipient}:\n${parsedBody}`);
        await new Promise(resolve => setTimeout(resolve, 400));
        sentStatus = 'sent';
        isSimulated = true;
      }

      // Commit delivery log record
      try {
        const { error: logErr } = await supabase.from('notification_logs').insert([{
          recipient: recipient,
          channel: template.channel,
          template_name: template.name,
          status: sentStatus,
          error_message: errorMsg,
          sent_at: new Date().toISOString()
        }]);
        if (logErr) console.error(`[Automation Engine] Log insertion error:`, logErr);
      } catch (logEx) {
        console.error(`[Automation Engine] Log commit exception:`, logEx);
      }

      results.push({ ruleName: rule.name, channel: template.channel, status: sentStatus, simulated: isSimulated });
    }

    return { success: true, executions: results };
  } catch (err) {
    console.error(`[Automation Engine] Core trigger execution crash:`, err);
    return { success: false, error: err.message };
  }
};

/**
 * SMS API Send Client-Side Helper
 */
export const sendSMSNotification = async ({ to, message }) => {
  try {
    console.log(`[SMS Client] Dispatching SMS to: ${to} via backend proxy...`);
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, message })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, id: data.messageId, simulated: !!data.simulated };
    }

    const errText = await response.text();
    console.warn(`[SMS Client] Backend SMS proxy failed: ${errText}`);
    return { success: false, error: errText };
  } catch (e) {
    console.error(`[SMS Client] Backend SMS proxy unreachable: ${e.message}`);
    return { success: false, error: e.message };
  }
};

/**
 * Welcome Email Dispatcher for New Guests
 */
export const sendWelcomeEmail = async ({ email, firstName, lastName, password = null }) => {
  const loginUrl = `${window.location.origin}/login`;
  const subject = password 
    ? 'Your Sparkles Apartments Credentials & Account Details' 
    : 'Welcome to Sparkles Apartments - Premium Luxury Shortlets';

  const htmlContent = `
    <div style="font-family: 'Outfit', sans-serif; padding: 40px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 8px solid #DF6853; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 25px; margin-bottom: 25px;">
        <h2 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em;">SPARKLES APARTMENTS</h2>
        <span style="font-size: 11px; color: #DF6853; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Premium Luxury Shortlets</span>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #DF6853; padding-left: 10px;">Welcome to Sparkles Apartments!</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0;">
          Dear <strong>${firstName} ${lastName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 10px;">
          Thank you for registering with Sparkles Apartments. Your account has been successfully created. You can now log in to the Guest Portal to view and manage your bookings, request room upgrades, make laundry and dining orders, and view your prepayment wallet.
        </p>
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
        <h4 style="color: #374151; font-size: 13px; font-weight: 700; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Credentials</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 35%;">Guest Portal URL:</td>
            <td style="padding: 6px 0; color: #111827;"><a href="${loginUrl}" style="color: #DF6853; font-weight: bold; text-decoration: none;">Click Here to Login</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Email Address:</td>
            <td style="padding: 6px 0; color: #111827; font-weight: bold;">${email}</td>
          </tr>
          \${password ? \`
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #b45309;">Password:</td>
            <td style="padding: 6px 0; color: #b45309; font-family: monospace; font-size: 14px; font-weight: bold;">\${password}</td>
          </tr>
          \` : \`
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Password:</td>
            <td style="padding: 6px 0; color: #111827; font-style: italic;">The password you selected during registration</td>
          </tr>
          \`}
        </table>
        \${password ? \`
        <div style="margin-top: 15px; font-size: 11px; color: #b45309; background-color: #fffbeb; padding: 10px; border: 1px solid #fef3c7; border-radius: 6px;">
          ⚠️ For security reasons, please log in and change your password immediately in the settings tab.
        </div>
        \` : ''}
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${loginUrl}" style="background-color: #DF6853; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Access Guest Portal</a>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0 0 5px 0;">This is an official automated onboarding notification from Sparkles Apartments.</p>
        <p style="margin: 0;">Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja</p>
      </div>
    </div>
  `;

  return await sendResendEmail({
    to: email,
    subject: subject,
    html: htmlContent,
    from: 'welcome@sparklesapartments.ng'
  });
};
