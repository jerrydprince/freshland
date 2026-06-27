<?php
// Set CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Parse route parameter
$route = isset($_GET['route']) ? trim($_GET['route'], '/') : '';

// Helper to fetch Supabase settings
function get_supabase_settings() {
    $supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
    $anonKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
    
    $url = $supabaseUrl . '/rest/v1/system_settings?select=setting_key,setting_value';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $anonKey,
        'Authorization: Bearer ' . $anonKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode >= 200 && $httpCode < 300 && $response) {
        $data = json_decode($response, true);
        if (is_array($data)) {
            $settings = [];
            foreach ($data as $row) {
                if (isset($row['setting_key'])) {
                    $settings[$row['setting_key']] = isset($row['setting_value']) ? $row['setting_value'] : null;
                }
            }
            return $settings;
        }
    }
    return [];
}

// Supabase general cURL API helper
function supabase_api($method, $table, $params = [], $body = null) {
    $supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
    $anonKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
    
    $url = $supabaseUrl . '/rest/v1/' . $table;
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    
    $headers = [
        'apikey: ' . $anonKey,
        'Authorization: Bearer ' . $anonKey
    ];
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Prefer: return=representation';
    } else if ($method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Prefer: return=representation';
    } else if ($method === 'GET') {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode >= 200 && $httpCode < 300) {
        return [
            'success' => true,
            'data' => json_decode($response, true),
            'code' => $httpCode
        ];
    }
    
    return [
        'success' => false,
        'error' => $response,
        'code' => $httpCode
    ];
}

// Helper to decode Base64 logo and save as a physical file
function get_and_optimize_logo($settings) {
    $logo_base64 = isset($settings['contact_logo']) ? $settings['contact_logo'] : '';
    if (empty($logo_base64)) {
        return '';
    }
    
    // Check if it is a base64 image
    if (preg_match('/^data:image\/(\w+);base64,(.+)$/i', $logo_base64, $matches)) {
        $type = $matches[1]; // png, jpeg, webp, etc.
        $data = base64_decode($matches[2]);
        
        $filename = 'logo.' . $type;
        $filepath = dirname(__DIR__) . '/' . $filename;
        
        // Write the file if it doesn't exist or is different size
        if (!file_exists($filepath) || filesize($filepath) !== strlen($data)) {
            @file_put_contents($filepath, $data);
        }
        
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'test.sparklesapartments.ng';
        
        return $protocol . $host . '/' . $filename;
    }
    
    return $logo_base64;
}


// Custom SMTP client using standard secure PHP stream sockets
function send_smtp_email($to, $subject, $html, $from, $settings, $replyTo = null) {
    $host = isset($settings['smtp_host']) ? trim($settings['smtp_host']) : '';
    $port = isset($settings['smtp_port']) ? intval($settings['smtp_port']) : 25;
    $username = isset($settings['smtp_username']) ? trim($settings['smtp_username']) : '';
    $password = isset($settings['smtp_password']) ? trim($settings['smtp_password']) : '';
    $secure = isset($settings['smtp_secure']) ? trim(strtolower($settings['smtp_secure'])) : 'none';
    
    if (empty($host) || empty($username) || empty($password)) {
        throw new Exception("SMTP is enabled but Host, Username, or Password is not configured in settings.");
    }
    
    $connectionHost = $host;
    if ($secure === 'ssl') {
        $connectionHost = 'ssl://' . $host;
    }
    
    $socket = @fsockopen($connectionHost, $port, $errno, $errstr, 15);
    if (!$socket) {
        throw new Exception("Could not connect to SMTP host '$connectionHost' on port $port: $errstr ($errno)");
    }
    
    $readResponse = function($socket, $expectedCode) {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        $code = intval(substr($response, 0, 3));
        if ($code !== $expectedCode) {
            throw new Exception("SMTP protocol error: Expected $expectedCode, got $code. Response: " . trim($response));
        }
        return $response;
    };
    
    try {
        $readResponse($socket, 220);
        
        $helloHost = isset($_SERVER['SERVER_NAME']) && !empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost';
        fwrite($socket, "EHLO " . $helloHost . "\r\n");
        $readResponse($socket, 250);
        
        if ($secure === 'tls') {
            fwrite($socket, "STARTTLS\r\n");
            $readResponse($socket, 220);
            
            // Enable encryption on socket
            $crypto_method = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                $crypto_method |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            }
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT')) {
                $crypto_method |= STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT;
            }
            $cryptoSuccess = @stream_socket_enable_crypto($socket, true, $crypto_method);
            if (!$cryptoSuccess) {
                throw new Exception("Failed to upgrade SMTP connection using STARTTLS (stream_socket_enable_crypto failed).");
            }
            
            fwrite($socket, "EHLO " . $helloHost . "\r\n");
            $readResponse($socket, 250);
        }
        
        fwrite($socket, "AUTH LOGIN\r\n");
        $readResponse($socket, 334);
        
        fwrite($socket, base64_encode($username) . "\r\n");
        $readResponse($socket, 334);
        
        fwrite($socket, base64_encode($password) . "\r\n");
        $readResponse($socket, 235);
        
        // Envelope Sender MUST match the authenticated username to satisfy Exim local delivery authorization
        fwrite($socket, "MAIL FROM:<" . $username . ">\r\n");
        $readResponse($socket, 250);
        
        fwrite($socket, "RCPT TO:<" . $to . ">\r\n");
        $readResponse($socket, 250);
        
        fwrite($socket, "DATA\r\n");
        $readResponse($socket, 354);
        
        // Construct standard MIME headers
        $boundary = '----=' . md5(uniqid(rand(), true));
        
        $senderName = "Sparkles Apartments";
        if (strpos($from, 'contact@') !== false) {
            $senderName = "Sparkles Contact Form";
        } else if (strpos($from, 'info@') !== false) {
            $senderName = "Sparkles Info";
        }
        
        $headers = [];
        $headers[] = "From: " . $senderName . " <" . $from . ">";
        $headers[] = "Reply-To: " . ($replyTo ? $replyTo : $from);
        $headers[] = "To: <" . $to . ">";
        $headers[] = "Subject: " . $subject;
        $headers[] = "Date: " . date('r');
        $headers[] = "Message-ID: <" . uniqid('', true) . "@" . $host . ">";
        $headers[] = "X-Mailer: PHP/" . phpversion();
        $headers[] = "MIME-Version: 1.0";
        $headers[] = "Content-Type: multipart/alternative; boundary=\"" . $boundary . "\"";
        
        $body = [];
        $body[] = "This is a multi-part message in MIME format.";
        $body[] = "--" . $boundary;
        $body[] = "Content-Type: text/plain; charset=\"UTF-8\"";
        $body[] = "Content-Transfer-Encoding: quoted-printable";
        $body[] = "";
        $body[] = quoted_printable_encode(strip_tags($html));
        $body[] = "";
        $body[] = "--" . $boundary;
        $body[] = "Content-Type: text/html; charset=\"UTF-8\"";
        $body[] = "Content-Transfer-Encoding: quoted-printable";
        $body[] = "";
        $body[] = quoted_printable_encode($html);
        $body[] = "";
        $body[] = "--" . $boundary . "--";
        
        $messageContent = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $body);
        
        // Escape periods at start of lines for SMTP protocol compliance
        $messageContent = preg_replace('/^\./m', '..', $messageContent);
        
        fwrite($socket, $messageContent . "\r\n.\r\n");
        $readResponse($socket, 250);
        
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        return true;
    } catch (Exception $e) {
        @fclose($socket);
        throw $e;
    }
}

// Check route
if (preg_match('/^payments\/verify\/(.+)$/', $route, $matches)) {
    $reference = $matches[1];
    
    // Fetch settings to get paystack secret key
    $settings = get_supabase_settings();
    $paystackSecret = isset($settings['paystack_secret']) ? $settings['paystack_secret'] : '';
    
    if (!$paystackSecret) {
        // Fallback to local dev key if not configured
        $paystackSecret = 'sk_test_f0d450c6d9adea0270a749762a87b876e5646eae';
    }
    
    // Call Paystack verification API
    $url = 'https://api.paystack.co/transaction/verify/' . urlencode($reference);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $paystackSecret
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    http_response_code($httpCode);
    echo $response;
    exit;
} 
else if ($route === 'email/send') {
    // Get POST data
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    $to = isset($postData['to']) ? $postData['to'] : '';
    $subject = isset($postData['subject']) ? $postData['subject'] : '';
    $html = isset($postData['html']) ? $postData['html'] : '';
    $from = isset($postData['from']) ? $postData['from'] : 'booking@sparklesapartments.ng';
    
    if (!$to || !$subject || !$html) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields (to, subject, html)"]);
        exit;
    }
    
    // Fetch system settings to check for SMTP config
    $settings = get_supabase_settings();
    $smtpEnabled = isset($settings['smtp_enabled']) && ($settings['smtp_enabled'] === 'true' || $settings['smtp_enabled'] === true);
    
    // Optimize base64 image strings in HTML if they match the settings logo
    $logoUrl = get_and_optimize_logo($settings);
    if (!empty($logoUrl)) {
        if (isset($settings['contact_logo']) && !empty($settings['contact_logo'])) {
            $html = str_replace($settings['contact_logo'], $logoUrl, $html);
        }
        // Fallback: replace any inline base64 images
        $html = preg_replace('/src=["\']data:image\/[^;]+;base64,[^"\']+["\']/i', 'src="' . $logoUrl . '"', $html);
    }
    
    if ($smtpEnabled) {
        try {
            send_smtp_email($to, $subject, $html, $from, $settings);
            http_response_code(200);
            echo json_encode(["success" => true, "id" => "cpanel_smtp_" . uniqid()]);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "SMTP Authentication failed: " . $e->getMessage()]);
            exit;
        }
    } else {
        // Fallback to standard HTML email headers for cPanel mail server via PHP mail()
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8" . "\r\n";
        $headers .= "From: Sparkles Apartments <" . $from . ">" . "\r\n";
        $headers .= "Reply-To: " . $from . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
        
        $success = mail($to, $subject, $html, $headers);
        
        if ($success) {
            http_response_code(200);
            echo json_encode(["success" => true, "id" => "cpanel_mail_" . uniqid()]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode(["error" => "PHP mail() execution failed on cPanel server."]);
            exit;
        }
    }
}
else if ($route === 'sms/send') {
    // Get POST data
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    $to = isset($postData['to']) ? trim($postData['to']) : '';
    $message = isset($postData['message']) ? trim($postData['message']) : '';
    
    if (!$to || !$message) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields (to, message)"]);
        exit;
    }
    
    // Fetch system settings
    $settings = get_supabase_settings();
    $gateway = isset($settings['sms_gateway']) ? $settings['sms_gateway'] : 'mock';
    $termiiKey = isset($settings['sms_termii_api_key']) ? $settings['sms_termii_api_key'] : '';
    $termiiSender = isset($settings['sms_termii_sender_id']) ? $settings['sms_termii_sender_id'] : 'Sparkles';
    $twilioSid = isset($settings['sms_twilio_account_sid']) ? $settings['sms_twilio_account_sid'] : '';
    $twilioToken = isset($settings['sms_twilio_auth_token']) ? $settings['sms_twilio_auth_token'] : '';
    $twilioFrom = isset($settings['sms_twilio_from_number']) ? $settings['sms_twilio_from_number'] : '';
    
    // Normalize phone numbers to include international code
    $normalizedPhone = $to;
    if (strpos($normalizedPhone, '0') === 0 && strlen($normalizedPhone) === 11) {
        $normalizedPhone = '234' . substr($normalizedPhone, 1);
    } else if (strpos($normalizedPhone, '+') === 0) {
        $normalizedPhone = substr($normalizedPhone, 1);
    }
    
    if ($gateway === 'termii') {
        if (!$termiiKey) {
            http_response_code(500);
            echo json_encode(["error" => "Termii API Key is not configured in settings."]);
            exit;
        }
        
        $url = 'https://api.ng.termii.com/api/sms/send';
        $payload = [
            "to" => $normalizedPhone,
            "from" => $termiiSender,
            "sms" => $message,
            "type" => "plain",
            "channel" => "generic",
            "api_key" => $termiiKey
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $data = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && $data && (isset($data['message']) && ($data['message'] === 'Successfully Sent' || (isset($data['code']) && $data['code'] === 'ok')))) {
            http_response_code(200);
            echo json_encode(["success" => true, "messageId" => isset($data['message_id']) ? $data['message_id'] : 'termii_' . time()]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode([
                "error" => isset($data['message']) ? $data['message'] : 'Termii SMS API failed to accept message',
                "details" => $data
            ]);
            exit;
        }
    } 
    else if ($gateway === 'twilio') {
        if (!$twilioSid || !$twilioToken || !$twilioFrom) {
            http_response_code(500);
            echo json_encode(["error" => "Twilio SID, Token, or From number is not configured in settings."]);
            exit;
        }
        
        $url = "https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/Messages.json";
        $formattedTo = strpos($normalizedPhone, '+') === 0 ? $normalizedPhone : '+' . $normalizedPhone;
        $fields = [
            'To' => $formattedTo,
            'From' => $twilioFrom,
            'Body' => $message
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, "$twilioSid:$twilioToken");
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($fields));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $data = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && isset($data['sid'])) {
            http_response_code(200);
            echo json_encode(["success" => true, "messageId" => $data['sid']]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode([
                "error" => isset($data['message']) ? $data['message'] : 'Twilio SMS API failed',
                "details" => $data
            ]);
            exit;
        }
    } 
    else {
        // Mock sandbox simulator mode
        $supabaseUrl = 'https://pjmdlifojfwoviyugjwq.supabase.co';
        $anonKey = 'sb_publishable_Cd0GkjlGkIfFUJ0IR2etLA_IxImAYU9';
        
        $logPayload = [[
            "recipient" => $normalizedPhone,
            "channel" => "sms",
            "template_name" => "Mock SMS Notification",
            "status" => "sent",
            "error_message" => "Simulated sandbox SMS delivery."
        ]];
        
        $url = $supabaseUrl . '/rest/v1/notification_logs';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'apikey: ' . $anonKey,
            'Authorization: Bearer ' . $anonKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($logPayload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_exec($ch);
        curl_close($ch);
        
        http_response_code(200);
        echo json_encode(["success" => true, "simulated" => true, "messageId" => 'mock_' . time()]);
        exit;
    }
}
else if ($route === 'contact/submit') {
    // Get POST data
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    $name = isset($postData['name']) ? $postData['name'] : '';
    $email = isset($postData['email']) ? $postData['email'] : '';
    $subject = isset($postData['subject']) ? $postData['subject'] : '';
    $message = isset($postData['message']) ? $postData['message'] : '';
    
    if (!$name || !$email || !$subject || !$message) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required contact form fields."]);
        exit;
    }
    
    $settings = get_supabase_settings();
    $logoUrl = get_and_optimize_logo($settings);
    $logoHtml = !empty($logoUrl) ? '<img src="' . $logoUrl . '" alt="Sparkles Apartments" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" /><br/>' : '';

    $systemTheme = isset($settings['system_theme']) ? $settings['system_theme'] : 'theme-luxe-gold';
    $themeColors = [
        'theme-slate-dark' => '#64748B',
        'theme-luxe-gold' => '#DF6853',
        'theme-emerald-green' => '#10B981',
        'theme-royal-blue' => '#3B82F6',
        'theme-sunset-orange' => '#F97316',
        'theme-rose-burgundy' => '#F43F5E',
        'theme-midnight-purple' => '#A855F7',
        'theme-ocean-teal' => '#14B8A6'
    ];
    $accentColor = isset($themeColors[$systemTheme]) ? $themeColors[$systemTheme] : '#DF6853';

    // 1. Send the contact message details TO contact@sparklesapartments.ng
    $toAdmin = 'contact@sparklesapartments.ng';
    $subjectAdmin = 'New Contact Form Submission: ' . $subject;
    
    $htmlAdmin = "
        <div style=\"font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-top: 6px solid {$accentColor}; max-width: 600px; border-radius: 8px;\">
            <div style=\"text-align: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; margin-bottom: 20px;\">
                {$logoHtml}
                <h2 style=\"color: #000; margin: 0; font-size: 20px; font-weight: bold;\">SPARKLES APARTMENTS</h2>
                <span style=\"font-size: 11px; color: {$accentColor}; text-transform: uppercase; font-weight: bold;\">Admin Submission Alert</span>
            </div>
            <p><strong>Name:</strong> {$name}</p>
            <p><strong>Email:</strong> {$email}</p>
            <p><strong>Subject:</strong> {$subject}</p>
            <div style=\"margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid {$accentColor};\">
                <strong>Message:</strong><br/>
                " . nl2br(htmlspecialchars($message)) . "
            </div>
        </div>
    ";
    
    // 2. Send an AUTO-RESPONDER to the guest's email address
    $subjectGuest = 'Message Received: Sparkles Apartments';
    
    $htmlGuest = "
        <div style=\"font-family: Arial, sans-serif; padding: 25px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-top: 6px solid {$accentColor}; border-radius: 12px;\">
            <div style=\"text-align: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; margin-bottom: 20px;\">
                {$logoHtml}
                <h2 style=\"color: #000; margin: 0; font-size: 20px; font-weight: bold;\">SPARKLES APARTMENTS</h2>
                <span style=\"font-size: 11px; color: {$accentColor}; text-transform: uppercase; font-weight: bold; letter-spacing: 0.1em;\">Premium Luxury Shortlets</span>
            </div>
            <p>Dear {$name},</p>
            <p>Thank you for reaching out to Sparkles Apartments. We have received your inquiry regarding <strong>\"{$subject}\"</strong>.</p>
            <p>Our dedicated team is reviewing your message and will get back to you within 24 hours.</p>
            <p>If your request is urgent, please do not hesitate to contact us directly via phone.</p>
            <p style=\"margin-top: 25px;\">Warm regards,</p>
            <p style=\"font-weight: bold; color: {$accentColor}; margin: 0;\">Sparkles Guest Support Team</p>
            <div style=\"margin-top: 30px; padding-top: 15px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #9ca3af;\">
                <p style=\"margin: 0;\">Phones: 08033214684, 08062332639 | Email: contact@sparklesapartments.ng</p>
                <p style=\"margin: 5px 0 0 0;\">Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja</p>
            </div>
        </div>
    ";
    
    $smtpEnabled = isset($settings['smtp_enabled']) && ($settings['smtp_enabled'] === 'true' || $settings['smtp_enabled'] === true);
    
    if ($smtpEnabled) {
        try {
            // Send inquiry to admin
            $adminSent = send_smtp_email($toAdmin, $subjectAdmin, $htmlAdmin, 'contact@sparklesapartments.ng', $settings, "{$name} <{$email}>");
            
            // Send auto-responder to guest
            $guestSent = send_smtp_email($email, $subjectGuest, $htmlGuest, 'contact@sparklesapartments.ng', $settings);
            
            if ($adminSent && $guestSent) {
                echo json_encode(["success" => true]);
                exit;
            } else {
                throw new Exception("SMTP delivered failed silently.");
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "SMTP Authentication failed: " . $e->getMessage()]);
            exit;
        }
    } else {
        // Fallback to PHP mail()
        $headersAdmin = "MIME-Version: 1.0" . "\r\n";
        $headersAdmin .= "Content-Type: text/html; charset=UTF-8" . "\r\n";
        $headersAdmin .= "From: Sparkles Contact Form <contact@sparklesapartments.ng>" . "\r\n";
        $headersAdmin .= "Reply-To: {$name} <{$email}>" . "\r\n";
        
        $adminSent = mail($toAdmin, $subjectAdmin, $htmlAdmin, $headersAdmin);
        
        $headersGuest = "MIME-Version: 1.0" . "\r\n";
        $headersGuest .= "Content-Type: text/html; charset=UTF-8" . "\r\n";
        $headersGuest .= "From: Sparkles Apartments <contact@sparklesapartments.ng>" . "\r\n";
        $headersGuest .= "Reply-To: contact@sparklesapartments.ng" . "\r\n";
        
        $guestSent = mail($email, $subjectGuest, $htmlGuest, $headersGuest);
        
        if ($adminSent && $guestSent) {
            echo json_encode(["success" => true]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to deliver contact message or auto-responder via mail()."]);
            exit;
        }
    }
}
else if ($route === 'attendance/biometric') {
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    $staff_id = isset($postData['staff_id']) ? $postData['staff_id'] : '';
    $action = isset($postData['action']) ? $postData['action'] : '';
    $biometric_key = isset($postData['biometric_key']) ? $postData['biometric_key'] : '';
    
    if (!$staff_id) {
        http_response_code(400);
        echo json_encode(["error" => "Missing staff_id in request body"]);
        exit;
    }
    
    // 1. Fetch profile
    $profileRes = supabase_api('GET', 'profiles', ['id' => 'eq.' . $staff_id]);
    if (!$profileRes['success'] || empty($profileRes['data'])) {
        http_response_code(404);
        echo json_encode(["error" => "Staff member profile not found."]);
        exit;
    }
    
    $profileData = $profileRes['data'][0];
    if (!empty($biometric_key) && isset($profileData['biometric_key']) && $profileData['biometric_key'] !== $biometric_key) {
        http_response_code(403);
        echo json_encode(["error" => "Invalid biometric credentials / fingerprint match failed."]);
        exit;
    }
    
    $timestamp = date('c');
    $ip_address = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '127.0.0.1';
    
    if ($action === 'clock_in') {
        // 2. Perform clock-in
        $shiftRes = supabase_api('POST', 'staff_attendance', [], [
            'staff_id' => $staff_id,
            'clock_in' => $timestamp,
            'status' => 'present',
            'notes' => 'Biometric fingerprint scan verified.'
        ]);
        
        if (!$shiftRes['success']) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to save shift: " . json_encode($shiftRes['error'])]);
            exit;
        }
        
        $shiftData = $shiftRes['data'][0];
        
        // Update is_on_shift
        supabase_api('PATCH', 'profiles', ['id' => 'eq.' . $staff_id], ['is_on_shift' => true]);
        
        // Log activity
        supabase_api('POST', 'system_logs', [], [
            'user_id' => $staff_id,
            'email' => isset($profileData['email']) ? $profileData['email'] : null,
            'log_type' => 'activity',
            'action' => 'Biometric Shift Clock-In',
            'module' => 'System',
            'entity_table' => 'staff_attendance',
            'entity_id' => $shiftData['id'],
            'ip_address' => $ip_address,
            'metadata' => [
                'biometric_scan' => 'success',
                'key' => isset($profileData['biometric_key']) ? $profileData['biometric_key'] : 'BIO-MOCK'
            ]
        ]);
        
        echo json_encode([
            "success" => true,
            "message" => "✓ Biometric scan verified! " . $profileData['first_name'] . " is now on shift.",
            "shift" => $shiftData
        ]);
        exit;
        
    } else if ($action === 'clock_out') {
        // 3. Perform clock-out
        // Find open active shift
        $openShiftsRes = supabase_api('GET', 'staff_attendance', [
            'staff_id' => 'eq.' . $staff_id,
            'clock_out' => 'is.null',
            'order' => 'clock_in.desc',
            'limit' => 1
        ]);
        
        $shiftData = null;
        if ($openShiftsRes['success'] && !empty($openShiftsRes['data'])) {
            $openShift = $openShiftsRes['data'][0];
            $updateRes = supabase_api('PATCH', 'staff_attendance', ['id' => 'eq.' . $openShift['id']], [
                'clock_out' => $timestamp,
                'notes' => ($openShift['notes'] ? $openShift['notes'] : '') . "\nBiometric fingerprint check-out verified."
            ]);
            if ($updateRes['success']) {
                $shiftData = $updateRes['data'][0];
            }
        }
        
        if (!$shiftData) {
            // Fallback: create completed shift
            $fallbackRes = supabase_api('POST', 'staff_attendance', [], [
                'staff_id' => $staff_id,
                'clock_in' => $timestamp,
                'clock_out' => $timestamp,
                'status' => 'present',
                'notes' => 'Clock-out biometric scan verified (no active clock-in recorded).'
            ]);
            if ($fallbackRes['success']) {
                $shiftData = $fallbackRes['data'][0];
            }
        }
        
        // Update shift status
        supabase_api('PATCH', 'profiles', ['id' => 'eq.' . $staff_id], ['is_on_shift' => false]);
        
        // Log activity
        if ($shiftData) {
            supabase_api('POST', 'system_logs', [], [
                'user_id' => $staff_id,
                'email' => isset($profileData['email']) ? $profileData['email'] : null,
                'log_type' => 'activity',
                'action' => 'Biometric Shift Clock-Out',
                'module' => 'System',
                'entity_table' => 'staff_attendance',
                'entity_id' => $shiftData['id'],
                'ip_address' => $ip_address,
                'metadata' => [
                    'biometric_scan' => 'success',
                    'key' => isset($profileData['biometric_key']) ? $profileData['biometric_key'] : 'BIO-MOCK'
                ]
            ]);
        }
        
        echo json_encode([
            "success" => true,
            "message" => "✓ Biometric scan verified! " . $profileData['first_name'] . " is now off shift.",
            "shift" => $shiftData
        ]);
        exit;
        
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Invalid shift action. Must be clock_in or clock_out."]);
        exit;
    }
}
else if ($route === 'attendance/terminal-push') {
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    $device_sn = isset($postData['device_sn']) ? $postData['device_sn'] : '';
    $user_pin = isset($postData['user_pin']) ? $postData['user_pin'] : '';
    $verify_time = isset($postData['verify_time']) ? $postData['verify_time'] : '';
    $verify_mode = isset($postData['verify_mode']) ? $postData['verify_mode'] : 'fingerprint';
    $verify_status = isset($postData['verify_status']) ? $postData['verify_status'] : '';
    
    if (!$user_pin || !$device_sn) {
        http_response_code(400);
        echo json_encode(["error" => "Missing device_sn or user_pin in push packet."]);
        exit;
    }
    
    $pinStr = strtoupper(trim($user_pin));
    
    // Fetch profiles
    $profilesRes = supabase_api('GET', 'profiles', ['role' => 'not.eq.guest']);
    if (!$profilesRes['success']) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to fetch staff directory: " . json_encode($profilesRes['error'])]);
        exit;
    }
    
    $staffMember = null;
    foreach ($profilesRes['data'] as $p) {
        if (!isset($p['biometric_key'])) continue;
        $keyNormalized = strtoupper($p['biometric_key']);
        $usernameNormalized = isset($p['username']) ? strtoupper($p['username']) : '';
        
        if (strpos($keyNormalized, $pinStr) !== false || (!empty($usernameNormalized) && strpos($usernameNormalized, $pinStr) !== false)) {
            $staffMember = $p;
            break;
        }
    }
    
    if (!$staffMember) {
        http_response_code(404);
        echo json_encode([
            "error" => "Push failed: No active staff member mapped to Terminal ID PIN \"" . $user_pin . "\". Please register this terminal key in Staff Directory."
        ]);
        exit;
    }
    
    $timestamp = !empty($verify_time) ? date('c', strtotime($verify_time)) : date('c');
    $action = ($verify_status === 0 || $verify_status === '0' || $verify_status === 'clock_in') ? 'clock_in' : 'clock_out';
    $ip_address = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '127.0.0.1';
    
    $shiftData = null;
    
    if ($action === 'clock_in') {
        $insertRes = supabase_api('POST', 'staff_attendance', [], [
            'staff_id' => $staffMember['id'],
            'clock_in' => $timestamp,
            'status' => 'present',
            'notes' => 'Network Biometric Terminal Sync (Device SN: ' . $device_sn . ', Mode: Fingerprint).'
        ]);
        
        if ($insertRes['success']) {
            $shiftData = $insertRes['data'][0];
        }
        
        supabase_api('PATCH', 'profiles', ['id' => 'eq.' . $staffMember['id']], ['is_on_shift' => true]);
        
        if ($shiftData) {
            supabase_api('POST', 'system_logs', [], [
                'user_id' => $staffMember['id'],
                'email' => isset($staffMember['email']) ? $staffMember['email'] : null,
                'log_type' => 'activity',
                'action' => 'Network Biometric Clock-In',
                'module' => 'System',
                'entity_table' => 'staff_attendance',
                'entity_id' => $shiftData['id'],
                'ip_address' => $ip_address,
                'metadata' => [
                    'terminal_sn' => $device_sn,
                    'user_pin' => $pinStr,
                    'mode' => $verify_mode
                ]
            ]);
        }
        
        echo json_encode([
            "success" => true,
            "message" => "[Terminal Push] Verified! " . $staffMember['first_name'] . " clocked in successfully at Entrance Terminal.",
            "shift" => $shiftData
        ]);
        exit;
        
    } else {
        // Find open shift
        $openShiftsRes = supabase_api('GET', 'staff_attendance', [
            'staff_id' => 'eq.' . $staffMember['id'],
            'clock_out' => 'is.null',
            'order' => 'clock_in.desc',
            'limit' => 1
        ]);
        
        if ($openShiftsRes['success'] && !empty($openShiftsRes['data'])) {
            $openShift = $openShiftsRes['data'][0];
            $updateRes = supabase_api('PATCH', 'staff_attendance', ['id' => 'eq.' . $openShift['id']], [
                'clock_out' => $timestamp,
                'notes' => ($openShift['notes'] ? $openShift['notes'] : '') . "\nNetwork Biometric Terminal Sync Out (Device SN: " . $device_sn . ")."
            ]);
            if ($updateRes['success']) {
                $shiftData = $updateRes['data'][0];
            }
        }
        
        if (!$shiftData) {
            $fallbackRes = supabase_api('POST', 'staff_attendance', [], [
                'staff_id' => $staffMember['id'],
                'clock_in' => $timestamp,
                'clock_out' => $timestamp,
                'status' => 'present',
                'notes' => 'Network Biometric Terminal Sync Out Fallback (Device SN: ' . $device_sn . ', no active clock-in).'
            ]);
            if ($fallbackRes['success']) {
                $shiftData = $fallbackRes['data'][0];
            }
        }
        
        supabase_api('PATCH', 'profiles', ['id' => 'eq.' . $staffMember['id']], ['is_on_shift' => false]);
        
        if ($shiftData) {
            supabase_api('POST', 'system_logs', [], [
                'user_id' => $staffMember['id'],
                'email' => isset($staffMember['email']) ? $staffMember['email'] : null,
                'log_type' => 'activity',
                'action' => 'Network Biometric Clock-Out',
                'module' => 'System',
                'entity_table' => 'staff_attendance',
                'entity_id' => $shiftData['id'],
                'ip_address' => $ip_address,
                'metadata' => [
                    'terminal_sn' => $device_sn,
                    'user_pin' => $pinStr,
                    'mode' => $verify_mode
                ]
            ]);
        }
        
        echo json_encode([
            "success" => true,
            "message" => "[Terminal Push] Verified! " . $staffMember['first_name'] . " clocked out successfully at Entrance Terminal.",
            "shift" => $shiftData
        ]);
        exit;
    }
}
else {
    http_response_code(404);
    echo json_encode(["error" => "Route not found: " . $route]);
    exit;
}
