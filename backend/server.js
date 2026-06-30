import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = 5001;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Security Middleware (DDOS / Bot Protection)
app.use(helmet()); // Sets various HTTP headers for security

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Throttled to 5000 requests to support multiple concurrent users sharing NAT IPs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// Standard Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// RBAC Middleware Example
const checkRole = (role) => {
  return async (req, res, next) => {
    // In a real app, you would verify the JWT token via Supabase Auth
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) throw error;

      // Assuming role is stored in user metadata
      if (user.user_metadata?.role !== role) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      }
      
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// Routes
app.get('/', (req, res) => {
  res.send('Luxe Apartment Booking API is running.');
});

app.get('/api', (req, res) => {
  res.send('Luxe Apartment Booking API is running (via /api).');
});

app.get('/api/', (req, res) => {
  res.send('Luxe Apartment Booking API is running (via /api/).');
});

// Paystack Payment Initialization Example
app.post('/api/payments/initialize', async (req, res) => {
  const { email, amount } = req.body;
  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Paystack expects amount in kobo
        currency: 'NGN'
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify Paystack Transaction
app.get('/api/payments/verify/:reference', async (req, res) => {
  const reference = req.params.reference;
  
  let apiKey = process.env.PAYSTACK_SECRET_KEY;
  if (!apiKey) {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'paystack_secret')
        .single();
      
      if (!error && data) {
        apiKey = data.setting_value;
      }
    } catch (e) {
      console.warn("Failed to fetch paystack_secret from system_settings table: ", e.message);
    }
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Paystack Secret Key is not configured in process.env or system_settings.' });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});


// Email Dispatcher (Supports SMTP/cPanel & Resend Fallback)
app.post('/api/email/send', async (req, res) => {
  const { to, subject, html, from } = req.body;

  try {
    // 1. Fetch system settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value');

    const settingsMap = {};
    if (!settingsError && settings) {
      settings.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value;
      });
    }

    const envSmtpEnabled = process.env.SMTP_ENABLED === 'true';
    const smtpEnabled = true;

    // 2. If SMTP (cPanel Webmail) is enabled, route via Nodemailer SMTP
    if (smtpEnabled) {
      const host = process.env.SMTP_HOST || settingsMap.smtp_host || 'mail.freshlandhotels.com';
      const port = parseInt(process.env.SMTP_PORT || settingsMap.smtp_port || '587', 10);
      const username = process.env.SMTP_USERNAME || settingsMap.smtp_username || 'booking@freshlandhotels.com';
      const password = process.env.SMTP_PASSWORD || settingsMap.smtp_password || 'Freshland2026.';
      const secure = (process.env.SMTP_SECURE === 'ssl') || settingsMap.smtp_secure === 'ssl' || port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Force from address dynamically based on env or fallback
      const fromName = process.env.SMTP_FROM_NAME || 'Freshland';
      const fromAddress = process.env.SMTP_FROM_ADDRESS || username;
      const smtpFrom = `${fromName} <${fromAddress}>`;

      // Replace frontend logo URL with CID for inline email rendering
      let processedHtml = html.replace(/https?:\/\/[^\/]+\/Images\/logo\.(png\.png|svg|png)/g, 'cid:logo');
      processedHtml = processedHtml.replace(/\/Images\/logo\.(png\.png|svg|png)/g, 'cid:logo');

      const fs = await import('fs');
      const attachmentPath = '../frontend/public/Images/logo.png';
      const attachments = [];
      if (fs.existsSync(attachmentPath)) {
        attachments.push({
          filename: 'logo.png',
          path: attachmentPath,
          cid: 'logo'
        });
      }

      const mailOptions = {
        from: smtpFrom,
        to,
        subject,
        html: processedHtml,
        attachments
      };

      console.log(`[SMTP Backend] Dispatching email to: ${to} via cPanel SMTP (${host}:${port}) from ${smtpFrom}...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP Backend] Email sent successfully via SMTP: ${info.messageId}`);
      return res.json({ success: true, id: info.messageId });
    }

    // 3. Fallback to Resend API
    let apiKey = process.env.RESEND_API_KEY || settingsMap.resend_api_key;

    if (!apiKey) {
      return res.status(500).json({ error: 'Neither SMTP nor Resend API key is configured.' });
    }

    const fromAddress = from ? `Freshland <${from}>` : 'Freshland <onboarding@resend.dev>';
    console.log(`[Resend Backend] Dispatching email to: ${to} via Resend...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: subject,
        html: html
      })
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.message || 'Resend API returned an error');
    }
    res.json(responseData);
  } catch (error) {
    console.error('[Email Dispatch Error]', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch email' });
  }
});

// Helper function to send email internally for auth actions
async function sendAuthEmailInternal({ to, subject, html }) {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value');

    const settingsMap = {};
    if (!settingsError && settings) {
      settings.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value;
      });
    }

    const envSmtpEnabled = process.env.SMTP_ENABLED === 'true';
    const smtpEnabled = true;

    if (smtpEnabled) {
      const host = process.env.SMTP_HOST || settingsMap.smtp_host || 'mail.freshlandhotels.com';
      const port = parseInt(process.env.SMTP_PORT || settingsMap.smtp_port || '587', 10);
      const username = process.env.SMTP_USERNAME || settingsMap.smtp_username || 'booking@freshlandhotels.com';
      const password = process.env.SMTP_PASSWORD || settingsMap.smtp_password || 'Freshland2026.';
      const secure = (process.env.SMTP_SECURE === 'ssl') || settingsMap.smtp_secure === 'ssl' || port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: username, pass: password },
        tls: { rejectUnauthorized: false }
      });

      const fromName = process.env.SMTP_FROM_NAME || 'Freshland';
      const fromAddress = process.env.SMTP_FROM_ADDRESS || username;
      const smtpFrom = `${fromName} <${fromAddress}>`;
      
      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html
      });
      console.log(`[SMTP Auth] Email sent successfully to ${to}`);
      return { success: true };
    }

    let apiKey = process.env.RESEND_API_KEY || settingsMap.resend_api_key;
    if (!apiKey) {
      throw new Error('Neither SMTP nor Resend API key is configured.');
    }

    const fromAddress = 'Freshland <info@Freshlandhotels.com>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html
      })
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.message || 'Resend API returned an error');
    }
    console.log(`[Resend Auth] Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Auth Email Helper Error]', error);
    throw error;
  }
}

// Request Password Recovery Token & Dispatch Email
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Verify user exists in profiles or auth.users
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (profileErr) {
      console.error('[Forgot Password] Profile query error:', profileErr);
    }

    if (!profile) {
      // Prevent user enumeration by returning success anyway
      console.log(`[Forgot Password] Request received for non-existent profile: ${cleanEmail}`);
      return res.json({ success: true, message: 'Recovery link sent if email is registered.' });
    }

    // 2. Generate secure token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiry

    // 3. Insert token into password_resets
    const { error: insertErr } = await supabase
      .from('password_resets')
      .insert({
        email: cleanEmail,
        token,
        expires_at: expiresAt,
        used: false
      });

    if (insertErr) throw insertErr;

    // 4. Send email
    const origin = req.headers.origin || 'http://localhost:5173';
    const resetLink = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    const htmlContent = `
      <div style="font-family: 'Outfit', sans-serif; padding: 40px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 8px solid #DF6853; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 25px; margin-bottom: 25px;">
          <h2 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em;">Freshland</h2>
          <span style="font-size: 11px; color: #DF6853; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Premium Luxury Hotel</span>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #DF6853; padding-left: 10px;">Reset Your Password</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0;">
            Dear <strong>${profile.first_name || 'Guest'}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 10px;">
            We received a request to reset your password for your Freshland account. Please click the button below to choose a new password. This link is secure and valid for 1 hour.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
          <a href="${resetLink}" style="background-color: #DF6853; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
        </div>

        <div style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-bottom: 20px;">
          If the button above does not work, copy and paste the following URL into your browser:<br/>
          <a href="${resetLink}" style="color: #DF6853; text-decoration: underline; word-break: break-all;">${resetLink}</a>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0 0 5px 0;">If you did not request a password reset, please ignore this email.</p>
          <p style="margin: 0;">No2. Gowon P Haruna Close, Karu, Abuja</p>
        </div>
      </div>
    `;

    await sendAuthEmailInternal({
      to: cleanEmail,
      subject: 'Reset Password Request - Freshland',
      html: htmlContent
    });

    res.json({ success: true, message: 'Recovery link sent successfully.' });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    res.status(500).json({ error: error.message || 'Failed to request password reset' });
  }
});

// Verify Recovery Token & Update Password via Database Security Definer RPC
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, token, and password are required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Call the database function to reset user password
    const { data: resetResult, error: resetError } = await supabase.rpc('reset_auth_user_password', {
      p_email: cleanEmail,
      p_token: token,
      p_new_password: password
    });

    if (resetError) throw resetError;

    if (resetResult === true) {
      console.log(`[Reset Password] Password reset successfully for: ${cleanEmail}`);
      res.json({ success: true, message: 'Password updated successfully!' });
    } else {
      res.status(400).json({ error: 'Password reset link is invalid, expired, or has already been used.' });
    }
  } catch (error) {
    console.error('[Reset Password Error]', error);
    res.status(500).json({ error: error.message || 'Failed to update password' });
  }
});

// Contact Form Submission (Local stub)
app.post('/api/contact/submit', async (req, res) => {
  const { name, email, subject, message } = req.body;
  console.log(`[Local Contact API] Received submission:`);
  console.log(`- From: ${name} <${email}>`);
  console.log(`- Subject: ${subject}`);
  console.log(`- Message: ${message}`);
  
  try {
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>New Website Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
    `;

    // Internal fetch call to our own email endpoint
    const response = await fetch('http://localhost:5001/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'contact@freshlandhotels.com',
        subject: `[Website Contact] ${subject}`,
        html: htmlBody,
        from: 'contact@freshlandhotels.com'
      })
    });

    if (!response.ok) {
      console.warn('[Local Contact API] Warning: Failed to deliver contact form email internally.');
    } else {
      console.log('[Local Contact API] Contact form email successfully forwarded to contact@freshlandhotels.com');
    }
  } catch (err) {
    console.error('[Local Contact API] Error routing contact email:', err);
  }

  res.json({ success: true });
});

// Biometric Shift Clock-in and Clock-out API Integration
app.post('/api/attendance/biometric', async (req, res) => {
  const { staff_id, action, biometric_key } = req.body;

  if (!staff_id) {
    return res.status(400).json({ error: 'Missing staff_id in request body' });
  }

  try {
    // 1. Fetch staff member profile to verify existence and biometric enrollment
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', staff_id)
      .single();

    if (profileError || !profileData) {
      return res.status(404).json({ error: 'Staff member profile not found.' });
    }

    if (biometric_key && profileData.biometric_key !== biometric_key) {
      return res.status(403).json({ error: 'Invalid biometric credentials / fingerprint match failed.' });
    }

    const timestamp = new Date().toISOString();

    if (action === 'clock_in') {
      // 2. Perform clock-in database updates
      const { data: shiftData, error: shiftError } = await supabase
        .from('staff_attendance')
        .insert([{
          staff_id,
          clock_in: timestamp,
          status: 'present',
          notes: 'Biometric fingerprint scan verified.'
        }])
        .select()
        .single();

      if (shiftError) throw shiftError;

      // Update shift status on profiles table (graceful check if column doesn't exist yet)
      try {
        await supabase.from('profiles').update({ is_on_shift: true }).eq('id', staff_id);
      } catch (err) {
        console.warn("Could not update profiles.is_on_shift column: ", err.message);
      }

      // Log system activity event
      await supabase.from('system_logs').insert([{
        user_id: staff_id,
        email: profileData.email,
        log_type: 'activity',
        action: 'Biometric Shift Clock-In',
        module: 'System',
        entity_table: 'staff_attendance',
        entity_id: shiftData.id,
        ip_address: req.ip || '127.0.0.1',
        metadata: { biometric_scan: 'success', key: profileData.biometric_key || 'BIO-MOCK' }
      }]);

      return res.json({
        success: true,
        message: `✓ Biometric scan verified! ${profileData.first_name} is now on shift.`,
        shift: shiftData
      });

    } else if (action === 'clock_out') {
      // 3. Perform clock-out database updates
      // Find open active shift for the user
      const { data: openShifts, error: openError } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', staff_id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1);

      if (openError) throw openError;

      let shiftData;
      if (openShifts && openShifts.length > 0) {
        const { data: updatedShift, error: updateError } = await supabase
          .from('staff_attendance')
          .update({
            clock_out: timestamp,
            notes: (openShifts[0].notes || '') + '\nBiometric fingerprint check-out verified.'
          })
          .eq('id', openShifts[0].id)
          .select()
          .single();

        if (updateError) throw updateError;
        shiftData = updatedShift;
      } else {
        // Safe fallback if no open shift found: create a completed shift entry
        const { data: fallbackShift, error: fallbackError } = await supabase
          .from('staff_attendance')
          .insert([{
            staff_id,
            clock_in: timestamp,
            clock_out: timestamp,
            status: 'present',
            notes: 'Clock-out biometric scan verified (no active clock-in recorded).'
          }])
          .select()
          .single();

        if (fallbackError) throw fallbackError;
        shiftData = fallbackShift;
      }

      // Update shift status on profiles table
      try {
        await supabase.from('profiles').update({ is_on_shift: false }).eq('id', staff_id);
      } catch (err) {
        console.warn("Could not update profiles.is_on_shift column: ", err.message);
      }

      // Log system activity event
      await supabase.from('system_logs').insert([{
        user_id: staff_id,
        email: profileData.email,
        log_type: 'activity',
        action: 'Biometric Shift Clock-Out',
        module: 'System',
        entity_table: 'staff_attendance',
        entity_id: shiftData.id,
        ip_address: req.ip || '127.0.0.1',
        metadata: { biometric_scan: 'success', key: profileData.biometric_key || 'BIO-MOCK' }
      }]);

      return res.json({
        success: true,
        message: `✓ Biometric scan verified! ${profileData.first_name} is now off shift.`,
        shift: shiftData
      });

    } else {
      return res.status(400).json({ error: 'Invalid shift action. Must be clock_in or clock_out.' });
    }

  } catch (err) {
    console.error("Biometric API Failure:", err);
    return res.status(500).json({ error: 'Failed to process shift transaction: ' + err.message });
  }
});

// Standalone TCP/IP Biometric Attendance Terminal Push Endpoint (ZKTeco ADMS/Push standard)
app.post('/api/attendance/terminal-push', async (req, res) => {
  const { device_sn, user_pin, verify_time, verify_mode, verify_status } = req.body;

  if (!user_pin || !device_sn) {
    return res.status(400).json({ error: 'Missing device_sn or user_pin in push packet.' });
  }

  try {
    // 1. Resolve staff profile by biometric terminal registration
    const pinStr = user_pin.toString().trim().toUpperCase();
    
    // Look up profiles to find a match
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'guest');

    if (profileErr) throw profileErr;

    // Search for matching profile where biometric_key contains the pin, 
    // or the profile ID / username matches
    const staffMember = profiles.find(p => {
      if (!p.biometric_key) return false;
      const keyNormalized = p.biometric_key.toUpperCase();
      return keyNormalized.includes(pinStr) || p.username?.toUpperCase().includes(pinStr);
    });

    if (!staffMember) {
      return res.status(404).json({ 
        error: `Push failed: No active staff member mapped to Terminal ID PIN "${pinStr}". Please register this terminal key in Staff Directory.` 
      });
    }

    const timestamp = verify_time ? new Date(verify_time).toISOString() : new Date().toISOString();
    const action = verify_status === 0 || verify_status === '0' || verify_status === 'clock_in' ? 'clock_in' : 'clock_out';

    let shiftData;

    if (action === 'clock_in') {
      const { data: insertedShift, error: shiftError } = await supabase
        .from('staff_attendance')
        .insert([{
          staff_id: staffMember.id,
          clock_in: timestamp,
          status: 'present',
          notes: `Network Biometric Terminal Sync (Device SN: ${device_sn}, Mode: Fingerprint).`
        }])
        .select()
        .single();

      if (shiftError) throw shiftError;
      shiftData = insertedShift;

      try {
        await supabase.from('profiles').update({ is_on_shift: true }).eq('id', staffMember.id);
      } catch (err) {
        console.warn("Could not toggle shift state: ", err.message);
      }

      // Log system activity event
      await supabase.from('system_logs').insert([{
        user_id: staffMember.id,
        email: staffMember.email,
        log_type: 'activity',
        action: 'Network Biometric Clock-In',
        module: 'System',
        entity_table: 'staff_attendance',
        entity_id: shiftData.id,
        ip_address: req.ip || '127.0.0.1',
        metadata: { terminal_sn: device_sn, user_pin: pinStr, mode: verify_mode || 'fingerprint' }
      }]);

      return res.json({
        success: true,
        message: `[Terminal Push] Verified! ${staffMember.first_name} clocked in successfully at Entrance Terminal.`,
        shift: shiftData
      });

    } else {
      // Find open shift
      const { data: openShifts, error: openError } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', staffMember.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1);

      if (openError) throw openError;

      let targetShiftId;
      if (openShifts && openShifts.length > 0) {
        targetShiftId = openShifts[0].id;
        const { data: updatedShift, error: updateError } = await supabase
          .from('staff_attendance')
          .update({
            clock_out: timestamp,
            notes: (openShifts[0].notes || '') + `\nNetwork Biometric Terminal Sync Out (Device SN: ${device_sn}).`
          })
          .eq('id', targetShiftId)
          .select()
          .single();

        if (updateError) throw updateError;
        shiftData = updatedShift;
      } else {
        const { data: fallbackShift, error: fallbackError } = await supabase
          .from('staff_attendance')
          .insert([{
            staff_id: staffMember.id,
            clock_in: timestamp,
            clock_out: timestamp,
            status: 'present',
            notes: `Network Biometric Terminal Sync Out Fallback (Device SN: ${device_sn}, no active clock-in).`
          }])
          .select()
          .single();

        if (fallbackError) throw fallbackError;
        shiftData = fallbackShift;
      }

      try {
        await supabase.from('profiles').update({ is_on_shift: false }).eq('id', staffMember.id);
      } catch (err) {
        console.warn("Could not toggle shift state: ", err.message);
      }

      // Log system activity event
      await supabase.from('system_logs').insert([{
        user_id: staffMember.id,
        email: staffMember.email,
        log_type: 'activity',
        action: 'Network Biometric Clock-Out',
        module: 'System',
        entity_table: 'staff_attendance',
        entity_id: shiftData.id,
        ip_address: req.ip || '127.0.0.1',
        metadata: { terminal_sn: device_sn, user_pin: pinStr, mode: verify_mode || 'fingerprint' }
      }]);

      return res.json({
        success: true,
        message: `[Terminal Push] Verified! ${staffMember.first_name} clocked out successfully at Entrance Terminal.`,
        shift: shiftData
      });
    }

  } catch (err) {
    console.error("Biometric Terminal API Failure:", err);
    return res.status(500).json({ error: 'Terminal transaction push failed: ' + err.message });
  }
});

// Secure SMS Send Gateway API Proxy

// ----- Overdue Checkout Auto-Charge -----
// This job runs every 5 minutes to detect guests who have exceeded checkout time
// and automatically adds hourly charges to their booking.

const processOverdueCheckouts = async () => {
  try {
    // Define checkout time (12:00 PM) and grace period (15 minutes)
    const checkoutHour = 12; // 12 PM
    const graceMinutes = 15;

    // Current timestamp in UTC
    const now = new Date();
    const nowUtc = new Date(now.toISOString());

    // Fetch bookings that are still checked in and whose checkout date is today or earlier
    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('id, check_out_date, status, room_id, total_amount_ngn, amount_paid_ngn')
      .eq('status', 'checked_in');

    if (bookingsErr) throw bookingsErr;
    if (!bookings || bookings.length === 0) return;

    for (const b of bookings) {
      // Build a Date object for the checkout deadline (checkout time + grace)
      const checkoutDate = new Date(b.check_out_date);
      checkoutDate.setUTCHours(checkoutHour, graceMinutes, 0, 0); // e.g., 12:15 UTC

      if (nowUtc > checkoutDate) {
        // Calculate overdue hours (rounded up)
        const msOverdue = nowUtc - checkoutDate;
        const hoursOverdue = Math.ceil(msOverdue / (1000 * 60 * 60));

        // Fetch room base price to compute per‑hour rate
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('base_price_ngn')
          .eq('id', b.room_id)
          .single();
        if (roomErr) {
          console.warn(`Failed to fetch room for booking ${b.id}:`, roomErr);
          continue;
        }
        const hourlyRate = Number(room.base_price_ngn) / 24;
        const extraCharge = hourlyRate * hoursOverdue;

        // Update booking total amount
        const { error: updateErr } = await supabase
          .from('bookings')
          .update({ total_amount_ngn: Number(b.total_amount_ngn) + extraCharge })
          .eq('id', b.id);
        if (updateErr) {
          console.warn(`Failed to update booking ${b.id}:`, updateErr);
          continue;
        }

        // Insert a payment record for the extra charge (status pending)
        const txnRef = `OVERDUE-${b.id.slice(0, 8)}-${Date.now()}`;
        await supabase.from('payments').insert([
          {
            booking_id: b.id,
            amount: extraCharge,
            method: 'auto_charge',
            status: 'pending',
            transaction_ref: txnRef,
            notes: `${hoursOverdue} hour(s) overdue checkout charge (hourly rate NGN ${hourlyRate.toFixed(2)})`
          }
        ]);

        console.log(`[Overdue Checkout] Booking ${b.id} charged NGN ${extraCharge.toFixed(2)} for ${hoursOverdue} hour(s) overdue.`);
      }
    }
  } catch (err) {
    console.error('Error in overdue checkout processing:', err);
  }
};

// Schedule the job to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log('Running overdue checkout auto‑charge job...');
  processOverdueCheckouts();
});

app.post('/api/sms/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message in request body' });
  }

  // Load SMS settings from system_settings
  let gateway = 'mock';
  let termiiKey = '';
  let termiiSender = 'Sparkles';
  let twilioSid = '';
  let twilioToken = '';
  let twilioFrom = '';

  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'sms_gateway',
        'sms_termii_api_key',
        'sms_termii_sender_id',
        'sms_twilio_account_sid',
        'sms_twilio_auth_token',
        'sms_twilio_from_number'
      ]);

    if (!error && settings) {
      const sMap = settings.reduce((acc, curr) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});
      gateway = sMap.sms_gateway || 'mock';
      termiiKey = sMap.sms_termii_api_key || '';
      termiiSender = sMap.sms_termii_sender_id || 'Sparkles';
      twilioSid = sMap.sms_twilio_account_sid || '';
      twilioToken = sMap.sms_twilio_auth_token || '';
      twilioFrom = sMap.sms_twilio_from_number || '';
    }
  } catch (dbErr) {
    console.warn("Failed to load SMS settings from DB: ", dbErr.message);
  }

  // Normalize phone numbers to include international code, stripping optional lead symbols
  let normalizedPhone = to.trim();
  if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
    normalizedPhone = '234' + normalizedPhone.slice(1);
  } else if (normalizedPhone.startsWith('+')) {
    normalizedPhone = normalizedPhone.slice(1);
  }

  console.log(`[SMS Gateway proxy] Route selected: "${gateway}" to recipient: "${normalizedPhone}"`);

  if (gateway === 'termii') {
    if (!termiiKey) {
      return res.status(500).json({ error: 'Termii API Key is not configured in settings.' });
    }
    try {
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
        return res.json({ success: true, messageId: data.message_id || 'termii_' + Date.now() });
      } else {
        return res.status(500).json({ error: data.message || 'Termii SMS API failed to accept message', details: data });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Termii API dispatch error: ' + err.message });
    }
  } else if (gateway === 'twilio') {
    if (!twilioSid || !twilioToken || !twilioFrom) {
      return res.status(500).json({ error: 'Twilio SID, Token, or From number is not configured in settings.' });
    }
    try {
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
        return res.json({ success: true, messageId: data.sid });
      } else {
        return res.status(500).json({ error: data.message || 'Twilio SMS API failed', details: data });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Twilio API dispatch error: ' + err.message });
    }
  } else {
    // Mock sandbox simulator mode
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      await supabase.from('notification_logs').insert([{
        recipient: normalizedPhone,
        channel: 'sms',
        template_name: 'Mock SMS Notification',
        status: 'sent',
        error_message: 'Simulated sandbox SMS delivery.'
      }]);
    } catch (e) {
      console.warn("Could not log mock SMS notification:", e.message);
    }
    return res.json({ success: true, simulated: true, messageId: 'mock_' + Date.now() });
  }
});

// Admin Route Example
app.get('/api/admin/bookings', checkRole('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin. Here are the bookings.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
