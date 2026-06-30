import{s as E}from"./index-C-Uu8TfT.js";const C=async({to:t,subject:e,html:i,from:o})=>{try{console.log(`[Resend Client] Dispatching email to: ${t} via backend proxy...`);const l=await fetch("/api/email/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t,subject:e,html:i,from:o})});if(l.ok)return{success:!0,id:(await l.json()).id||"msg_"+Math.random().toString(36).substr(2,9)};const u=await l.text();console.warn(`[Resend Client] Backend endpoint failed (${l.status}): ${u}. Falling back...`)}catch(a){console.warn(`[Resend Client] Backend proxy unreachable: ${a.message}. Falling back...`)}return console.warn(`[Resend Client] Simulating email delivery to: ${t}`),await new Promise(a=>setTimeout(a,800)),{success:!0,simulated:!0}},J=async(t,e)=>{if(!e)return console.warn(`[Automation Engine] Trigger aborted for ${t}: Missing payload.`),{success:!1,reason:"Missing booking payload"};try{console.log(`[Automation Engine] Triggered event: "${t}"`);const{data:i}=await E.from("system_settings").select("setting_key, setting_value").in("setting_key",["notification_engine_active","contact_logo","contact_address","contact_phone","contact_email","system_theme"]),o=i?.reduce((r,n)=>(r[n.setting_key]=n.setting_value,r),{})||{};if(!(o.notification_engine_active==="true"||o.notification_engine_active===!0||o.notification_engine_active===void 0))return console.log("[Automation Engine] Engine is toggled offline in System Control."),{success:!1,reason:"Notification engine inactive"};const l=o.system_theme||"theme-luxe-gold",x={"theme-slate-dark":"#64748B","theme-luxe-gold":"#DF6853","theme-emerald-green":"#10B981","theme-royal-blue":"#3B82F6","theme-sunset-orange":"#F97316","theme-rose-burgundy":"#F43F5E","theme-midnight-purple":"#A855F7","theme-ocean-teal":"#14B8A6"}[l]||"#DF6853";let c=o.contact_logo||"/Images/logo.png";c&&c.startsWith("/")&&((c.includes("logo.svg")||c.includes("logo.png.png"))&&(c="/Images/logo.png"),c=window.location.origin+c);const L=o.contact_address||"No2. Gowon P Haruna Close, Karu, Abuja",R=o.contact_phone||"08103694837, 08174971881",j=o.contact_email||"info@freshlandhotels.com",{data:g,error:_}=await E.from("automation_rules").select("*, notification_templates(*)").eq("trigger_event",t).eq("is_active",!0);if(_)return console.error("[Automation Engine] Failed to fetch active rules:",_),{success:!1,error:_.message};if(t==="booking_created"||t==="booking_confirmed")try{const r=e.profiles||{},n=e.guest_name||`${r.first_name||""} ${r.last_name||""}`.trim()||"Valued Guest",m=e.guest_email||e.email||r.email||"N/A",b=e.guest_phone||e.phone||r.phone||"N/A",f=e.booking_reference||e.id||"N/A",w=e.room_number||e.rooms&&e.rooms.room_number||"N/A",h=e.room_details||e.rooms&&e.rooms.name||"Premium Suite",A=e.total_amount||e.total_amount_ngn||e.total_price||"0.00",$=e.check_in_date||e.check_in||"N/A",d=e.check_out_date||e.check_out||"N/A",S=`
          <div style="font-family: 'Outfit', sans-serif; padding: 20px; color: #1f2937; background-color: #f3f4f6; border-radius: 8px;">
            <h2 style="color: #DF6853; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">🚨 New Booking Alert: ${t}</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 20px;">
              <tr><td style="padding: 8px 0; font-weight: bold; width: 30%;">Guest Name:</td><td>${n}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td>${m}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Phone:</td><td>${b}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Booking Ref:</td><td><strong style="color: #000;">${f}</strong></td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Room:</td><td>${w} - ${h}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Check In:</td><td>${$}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Check Out:</td><td>${d}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Amount:</td><td><strong style="color: #10B981;">₦${Number(A).toLocaleString()}</strong></td></tr>
            </table>
          </div>
        `;console.log("[Automation Engine] Firing dedicated admin alert to booking@freshlandhotels.com..."),C({to:"booking@freshlandhotels.com",subject:`[ADMIN ALERT] New Booking: ${f}`,from:"booking@freshlandhotels.com",html:S}).catch(v=>console.error(v))}catch(r){console.warn("[Automation Engine] Failed to dispatch dedicated admin alert:",r)}if(!g||g.length===0)return console.log(`[Automation Engine] Zero active rules configured for event "${t}".`),{success:!0,count:0};console.log(`[Automation Engine] Processing ${g.length} automations for "${t}"...`);const B=[];for(const r of g){const n=r.notification_templates;if(!n)continue;const m=e.profiles||{},b=e.guest_name||`${m.first_name||""} ${m.last_name||""}`.trim()||"Valued Guest",f=e.guest_email||e.email||m.email||"guest@example.com",w=e.guest_phone||e.phone||m.phone||"N/A",h=e.booking_reference||e.id||"BKG-MOCK",A=e.check_in_date||e.check_in||"N/A",$=e.check_out_date||e.check_out||"N/A",d=n.channel==="email"?f:w;if(!d||d==="N/A"){console.warn(`[Automation Engine] Skipping rule "${r.name}": No recipient detail.`);continue}const S=e.room_number||e.rooms&&e.rooms.room_number||"N/A",v=e.room_details||e.rooms&&e.rooms.name||"Premium Suite",M=e.total_amount||e.total_amount_ngn||e.total_price||"0.00",T=e.total_paid||e.amount_paid||e.amount_paid_ngn||"0.00",I=e.balance_due!==void 0?e.balance_due:(Number(M)-Number(T)).toFixed(2),O=e.payment_status||"Pending",G=e.payment_amount||e.amount||"0.00",H=e.payment_ref||e.payment_reference||"N/A",K=e.payment_method||"N/A",U=e.payment_date||new Date().toLocaleDateString(),W=e.invoice_number||"INV-"+h,z=s=>s?s.replace(/{{guest_name}}/g,b).replace(/{{booking_ref}}/g,h).replace(/{{check_in}}/g,A).replace(/{{check_out}}/g,$).replace(/{{room_number}}/g,S).replace(/{{room_details}}/g,v).replace(/{{total_amount}}/g,Number(M).toLocaleString()).replace(/{{total_paid}}/g,Number(T).toLocaleString()).replace(/{{balance_due}}/g,Number(I).toLocaleString()).replace(/{{payment_status}}/g,O).replace(/{{payment_amount}}/g,Number(G).toLocaleString()).replace(/{{payment_ref}}/g,H).replace(/{{payment_method}}/g,K.toUpperCase()).replace(/{{payment_date}}/g,U).replace(/{{invoice_number}}/g,W):"",Y=z(n.subject||"Freshland Update"),N=z(n.body||"");let p="failed",P=null,y=!1;if(n.channel==="email"){const s=`
          <div style="font-family: 'Outfit', sans-serif; padding: 30px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 6px solid ${x}; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
              ${c?`<img src="${c}" alt="Freshland" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />`:""}
              <h2 style="color: #000000; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">Freshland</h2>
              <span style="font-size: 11px; color: ${x}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">Premium Luxury Hotel</span>
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
              ${N.replace(/\n/g,"<br/>")}
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 5px 0;">This is an automated operational alert sent from the Sparkles PMS Hub.</p>
              <p style="margin: 0;">${L}</p>
              <p style="margin: 5px 0 0 0;">Phones: ${R} | Email: ${j}</p>
            </div>
          </div>
        `,F=await C({to:d,subject:Y,from:"booking@freshlandhotels.com",html:s});F.success?(p="sent",y=!!F.simulated):P=F.error||"SMTP routing failure"}else if(n.channel==="sms"){const s=await q({to:d,message:N});s.success?(p="sent",y=!!s.simulated):P=s.error||"SMS Gateway routing failure"}else console.log(`[Automation Engine] Simulating "${n.channel}" dispatch to ${d}:
${N}`),await new Promise(s=>setTimeout(s,400)),p="sent",y=!0;try{const{error:s}=await E.from("notification_logs").insert([{recipient:d,channel:n.channel,template_name:n.name,status:p,error_message:P,sent_at:new Date().toISOString()}]);s&&console.error("[Automation Engine] Log insertion error:",s)}catch(s){console.error("[Automation Engine] Log commit exception:",s)}B.push({ruleName:r.name,channel:n.channel,status:p,simulated:y})}return{success:!0,executions:B}}catch(i){return console.error("[Automation Engine] Core trigger execution crash:",i),{success:!1,error:i.message}}},q=async({to:t,message:e})=>{try{console.log(`[SMS Client] Dispatching SMS to: ${t} via backend proxy...`);const o=await fetch("/api/sms/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t,message:e})});if(o.ok){const l=await o.json();return{success:!0,id:l.messageId,simulated:!!l.simulated}}const a=await o.text();return console.warn(`[SMS Client] Backend SMS proxy failed: ${a}`),{success:!1,error:a}}catch(i){return console.error(`[SMS Client] Backend SMS proxy unreachable: ${i.message}`),{success:!1,error:i.message}}},k=async({email:t,firstName:e,lastName:i,password:o=null})=>{const a=`${window.location.origin}/login`,l=o?"Your Freshland Credentials & Account Details":"Welcome to Freshland - Premium Luxury Hotel",u=`
    <div style="font-family: 'Outfit', sans-serif; padding: 40px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 8px solid #DF6853; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 25px; margin-bottom: 25px;">
        <h2 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em;">Freshland</h2>
        <span style="font-size: 11px; color: #DF6853; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Premium Luxury Hotel</span>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #DF6853; padding-left: 10px;">Welcome to Freshland!</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0;">
          Dear <strong>${e} ${i}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 10px;">
          Thank you for registering with Freshland. Your account has been successfully created. You can now log in to the Guest Portal to view and manage your bookings, request room upgrades, make laundry and dining orders, and view your prepayment wallet.
        </p>
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
        <h4 style="color: #374151; font-size: 13px; font-weight: 700; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Credentials</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 35%;">Guest Portal URL:</td>
            <td style="padding: 6px 0; color: #111827;"><a href="${a}" style="color: #DF6853; font-weight: bold; text-decoration: none;">Click Here to Login</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Email Address:</td>
            <td style="padding: 6px 0; color: #111827; font-weight: bold;">${t}</td>
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
        <a href="${a}" style="background-color: #DF6853; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Access Guest Portal</a>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0 0 5px 0;">This is an official automated onboarding notification from Freshland.</p>
        <p style="margin: 0;">No2. Gowon P Haruna Close, Karu, Abuja</p>
      </div>
    </div>
  `;return await C({to:t,subject:l,html:u,from:"booking@freshlandhotels.com"})};export{C as a,q as b,k as s,J as t};
