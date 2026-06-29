import{s as S}from"./index-B82PRexk.js";const v=async({to:t,subject:e,html:r,from:o})=>{try{console.log(`[Resend Client] Dispatching email to: ${t} via backend proxy...`);const a=await fetch("/api/email/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t,subject:e,html:r,from:o})});if(a.ok)return{success:!0,id:(await a.json()).id||"msg_"+Math.random().toString(36).substr(2,9)};const p=await a.text();console.warn(`[Resend Client] Backend endpoint failed (${a.status}): ${p}. Falling back...`)}catch(i){console.warn(`[Resend Client] Backend proxy unreachable: ${i.message}. Falling back...`)}return console.warn(`[Resend Client] Simulating email delivery to: ${t}`),await new Promise(i=>setTimeout(i,800)),{success:!0,simulated:!0}},Z=async(t,e)=>{if(!e)return console.warn(`[Automation Engine] Trigger aborted for ${t}: Missing payload.`),{success:!1,reason:"Missing booking payload"};try{console.log(`[Automation Engine] Triggered event: "${t}"`);const{data:r}=await S.from("system_settings").select("setting_key, setting_value").in("setting_key",["notification_engine_active","contact_logo","contact_address","contact_phone","contact_email","system_theme"]),o=r?.reduce((d,s)=>(d[s.setting_key]=s.setting_value,d),{})||{};if(!(o.notification_engine_active==="true"||o.notification_engine_active===!0||o.notification_engine_active===void 0))return console.log("[Automation Engine] Engine is toggled offline in System Control."),{success:!1,reason:"Notification engine inactive"};const a=o.system_theme||"theme-luxe-gold",h={"theme-slate-dark":"#64748B","theme-luxe-gold":"#DF6853","theme-emerald-green":"#10B981","theme-royal-blue":"#3B82F6","theme-sunset-orange":"#F97316","theme-rose-burgundy":"#F43F5E","theme-midnight-purple":"#A855F7","theme-ocean-teal":"#14B8A6"}[a]||"#DF6853";let c=o.contact_logo||"https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";c&&c.startsWith("/")&&(c=window.location.origin+c);const M=o.contact_address||"Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja",T=o.contact_phone||"08033214684, 08062332639, 08171278657",z=o.contact_email||"info@Freshlandhotels.com",{data:u,error:y}=await S.from("automation_rules").select("*, notification_templates(*)").eq("trigger_event",t).eq("is_active",!0);if(y)return console.error("[Automation Engine] Failed to fetch active rules:",y),{success:!1,error:y.message};if(!u||u.length===0)return console.log(`[Automation Engine] Zero active rules configured for event "${t}".`),{success:!0,count:0};console.log(`[Automation Engine] Processing ${u.length} automations for "${t}"...`);const A=[];for(const d of u){const s=d.notification_templates;if(!s)continue;const g=e.profiles||{},$=e.guest_name||`${g.first_name||""} ${g.last_name||""}`.trim()||"Valued Guest",B=e.guest_email||e.email||g.email||"guest@example.com",L=e.guest_phone||e.phone||g.phone||"N/A",F=e.booking_reference||e.id||"BKG-MOCK",O=e.check_in_date||e.check_in||"N/A",j=e.check_out_date||e.check_out||"N/A",l=s.channel==="email"?B:L;if(!l||l==="N/A"){console.warn(`[Automation Engine] Skipping rule "${d.name}": No recipient detail.`);continue}const k=e.room_number||e.rooms&&e.rooms.room_number||"N/A",I=e.room_details||e.rooms&&e.rooms.name||"Premium Suite",P=e.total_amount||e.total_amount_ngn||e.total_price||"0.00",E=e.total_paid||e.amount_paid||e.amount_paid_ngn||"0.00",R=e.balance_due!==void 0?e.balance_due:(Number(P)-Number(E)).toFixed(2),H=e.payment_status||"Pending",G=e.payment_amount||e.amount||"0.00",W=e.payment_ref||e.payment_reference||"N/A",q=e.payment_method||"N/A",U=e.payment_date||new Date().toLocaleDateString(),Y=e.invoice_number||"INV-"+F,N=n=>n?n.replace(/{{guest_name}}/g,$).replace(/{{booking_ref}}/g,F).replace(/{{check_in}}/g,O).replace(/{{check_out}}/g,j).replace(/{{room_number}}/g,k).replace(/{{room_details}}/g,I).replace(/{{total_amount}}/g,Number(P).toLocaleString()).replace(/{{total_paid}}/g,Number(E).toLocaleString()).replace(/{{balance_due}}/g,Number(R).toLocaleString()).replace(/{{payment_status}}/g,H).replace(/{{payment_amount}}/g,Number(G).toLocaleString()).replace(/{{payment_ref}}/g,W).replace(/{{payment_method}}/g,q.toUpperCase()).replace(/{{payment_date}}/g,U).replace(/{{invoice_number}}/g,Y):"",C=N(s.subject||"Freshland Update"),x=N(s.body||"");let m="failed",b=null,f=!1;if(s.channel==="email"){const n=`
          <div style="font-family: 'Outfit', sans-serif; padding: 30px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 6px solid ${h}; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
              ${c?`<img src="${c}" alt="Freshland" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />`:""}
              <h2 style="color: #000000; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">Freshland</h2>
              <span style="font-size: 11px; color: ${h}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">Premium Luxury Hotel</span>
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
              ${x.replace(/\n/g,"<br/>")}
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 5px 0;">This is an automated operational alert sent from the Sparkles PMS Hub.</p>
              <p style="margin: 0;">${M}</p>
              <p style="margin: 5px 0 0 0;">Phones: ${T} | Email: ${z}</p>
            </div>
          </div>
        `;if(l!=="booking@Freshlandhotels.com")try{console.log("[Automation Engine] Forwarding admin copy of booking update to booking@Freshlandhotels.com...");const w=`
              <div style="background-color: #f3f4f6; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; color: #4b5563; line-height: 1.5;">
                <strong>[PMS Admin Notification]</strong><br/>
                Recipient: <strong>${$}</strong> (${l})<br/>
                Trigger Event: <strong>${t}</strong>
              </div>
              ${n}
            `;v({to:"booking@Freshlandhotels.com",subject:`[ADMIN] ${C}`,from:"booking@Freshlandhotels.com",html:w}).catch(J=>console.error(J))}catch(w){console.warn("[Automation Engine] Failed to dispatch admin copy:",w)}const _=await v({to:l,subject:C,from:"booking@Freshlandhotels.com",html:n});_.success?(m="sent",f=!!_.simulated):b=_.error||"SMTP routing failure"}else if(s.channel==="sms"){const n=await K({to:l,message:x});n.success?(m="sent",f=!!n.simulated):b=n.error||"SMS Gateway routing failure"}else console.log(`[Automation Engine] Simulating "${s.channel}" dispatch to ${l}:
${x}`),await new Promise(n=>setTimeout(n,400)),m="sent",f=!0;try{const{error:n}=await S.from("notification_logs").insert([{recipient:l,channel:s.channel,template_name:s.name,status:m,error_message:b,sent_at:new Date().toISOString()}]);n&&console.error("[Automation Engine] Log insertion error:",n)}catch(n){console.error("[Automation Engine] Log commit exception:",n)}A.push({ruleName:d.name,channel:s.channel,status:m,simulated:f})}return{success:!0,executions:A}}catch(r){return console.error("[Automation Engine] Core trigger execution crash:",r),{success:!1,error:r.message}}},K=async({to:t,message:e})=>{try{console.log(`[SMS Client] Dispatching SMS to: ${t} via backend proxy...`);const o=await fetch("/api/sms/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t,message:e})});if(o.ok){const a=await o.json();return{success:!0,id:a.messageId,simulated:!!a.simulated}}const i=await o.text();return console.warn(`[SMS Client] Backend SMS proxy failed: ${i}`),{success:!1,error:i}}catch(r){return console.error(`[SMS Client] Backend SMS proxy unreachable: ${r.message}`),{success:!1,error:r.message}}},Q=async({email:t,firstName:e,lastName:r,password:o=null})=>{const i=`${window.location.origin}/login`,a=o?"Your Freshland Credentials & Account Details":"Welcome to Freshland - Premium Luxury Hotel",p=`
    <div style="font-family: 'Outfit', sans-serif; padding: 40px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 8px solid #DF6853; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 25px; margin-bottom: 25px;">
        <h2 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em;">Freshland</h2>
        <span style="font-size: 11px; color: #DF6853; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Premium Luxury Hotel</span>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #DF6853; padding-left: 10px;">Welcome to Freshland!</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0;">
          Dear <strong>${e} ${r}</strong>,
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
            <td style="padding: 6px 0; color: #111827;"><a href="${i}" style="color: #DF6853; font-weight: bold; text-decoration: none;">Click Here to Login</a></td>
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
        <a href="${i}" style="background-color: #DF6853; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Access Guest Portal</a>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0 0 5px 0;">This is an official automated onboarding notification from Freshland.</p>
        <p style="margin: 0;">Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja</p>
      </div>
    </div>
  `;return await v({to:t,subject:a,html:p,from:"welcome@sparklesapartments.ng"})};export{v as a,K as b,Q as s,Z as t};
