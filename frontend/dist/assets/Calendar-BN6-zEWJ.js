import{r as d,bB as m,e}from"./vendor-core-CFe2neJJ.js";import{l as B,w as q}from"./vendor-calendar-Dvk5fLAr.js";import{e as U,g as W,h as V,p as K,f as H}from"./vendor-datefns-BhEXyi6r.js";import{s as b}from"./index-C-Uu8TfT.js";import"./vendor-router-CFW00010.js";import"./vendor-supabase-CyiB4KQ2.js";import"./vendor-icons-BX0SL7v2.js";import"./vendor-motion-DIIkuBLB.js";const J={"en-US":U},Q=B.dateFnsLocalizer({format:H,parse:K,startOfWeek:V,getDay:W,locales:J}),X=q.default||q,Z=X(B.Calendar),le=()=>{const[v,R]=d.useState([]),[ee,P]=d.useState([]),[L,Y]=d.useState(!0),[t,k]=d.useState(null),[g,p]=d.useState(!1),[u,D]=d.useState(""),[x,S]=d.useState(""),[f,C]=d.useState(""),[y,E]=d.useState([]),[_,F]=d.useState(!1),[w,j]=d.useState(!1);d.useEffect(()=>{h()},[]);const h=async()=>{Y(!0);const{data:o,error:r}=await b.from("rooms").select("id, name"),{data:s,error:i}=await b.from("bookings").select("*, profiles(first_name, last_name), rooms(id, room_number, name, base_price_ngn)");if(r||i)m.error("Failed to load calendar data");else{P(o);const n=(s||[]).filter(a=>!(a.booking_source==="online"&&a.payment_status==="unpaid")).map(a=>{const c=a.profiles?`${a.profiles.first_name} ${a.profiles.last_name}`:a.special_requests||"Walk-in";return{id:a.id,title:`${c} (${a.status})`,start:new Date(a.check_in_date),end:new Date(a.check_out_date),resourceId:a.room_id,status:a.status,booking:a}});R(n)}Y(!1)},$=async(o,r)=>{if(!(!o||!r)){F(!0);try{const{data:s}=await b.from("rooms").select("id, name, room_number, base_price_ngn");if(!s)return E([]);const{data:i,error:l}=await b.rpc("get_booked_room_ids",{req_start_date:o,req_end_date:r});l&&console.error("Availability check error:",l);const n=new Set((i||[]).map(c=>typeof c=="string"?c:c.booked_room_id||c.room_id||c.id||Object.values(c)[0])),a=s.filter(c=>!n.has(c.id));E(a)}catch(s){console.error("Rebooking check failed:",s)}finally{F(!1)}}};d.useEffect(()=>{g&&u&&x&&$(u,x)},[u,x,g]),d.useEffect(()=>{if(t&&g){const o=moment().format("YYYY-MM-DD"),r=moment().add(1,"days").format("YYYY-MM-DD");D(o),S(r),C(t.booking.room_id||"")}else D(""),S(""),C(""),E([])},[t,g]);const O=async o=>{if(o.preventDefault(),!f){m.error("Please select an available room.");return}j(!0);const r=m.loading("Processing guest rebooking...");try{const s=y.find(N=>N.id===f);if(!s)throw new Error("Selected room is invalid or unavailable.");const i=Math.max(1,moment(x).diff(moment(u),"days")),l=Number(s.base_price_ngn)*i,n=l+(t.booking.total_extras_price_ngn||0),a=Number(t.booking.amount_paid_ngn||0),c=a>=n?"paid":a>0?"partial":"unpaid";if(t.booking.room_id){const{error:N}=await b.from("rooms").update({status:"available"}).eq("id",t.booking.room_id);if(N)throw N}const{error:M}=await b.from("bookings").update({check_in_date:u,check_out_date:x,room_id:f,total_room_price_ngn:l,total_amount_ngn:n,payment_status:c,status:"confirmed"}).eq("id",t.booking.id);if(M)throw M;const{error:A}=await b.from("payments").insert([{booking_id:t.booking.id,amount:0,currency:"NGN",method:"rebook",status:"completed",is_refund:!1,transaction_ref:`REBOOK-${Math.random().toString(36).substring(2,8).toUpperCase()}-${Date.now()}`,notes:"Rebook"}]);A&&console.warn("Failed to log rebooking payment ledger entry:",A),m.success("Guest successfully rebooked for the new dates!",{id:r}),k(null),p(!1),h()}catch(s){console.error(s),m.error(`Rebooking failed: ${s.message||"Error occurred"}`,{id:r})}finally{j(!1)}},z=async o=>{j(!0);const r=m.loading("Marking reservation as No-Show...");try{const{error:s}=await b.from("bookings").update({status:"no_show"}).eq("id",o.id);if(s)throw s;if(o.room_id){const{error:i}=await b.from("rooms").update({status:"available"}).eq("id",o.room_id);if(i)throw i}m.success("Reservation status updated to No-Show & room released.",{id:r}),k(null),p(!1),h()}catch(s){console.error(s),m.error(`Operation failed: ${s.message||"Error occurred"}`,{id:r})}finally{j(!1)}},I=async({event:o,start:r,end:s,resourceId:i})=>{const l=v.map(a=>a.id===o.id?{...a,start:r,end:s,resourceId:i}:a);R(l);const{error:n}=await b.from("bookings").update({check_in_date:moment(r).format("YYYY-MM-DD"),check_out_date:moment(s).format("YYYY-MM-DD"),room_id:i}).eq("id",o.id);n?(m.error("Failed to move booking"),h()):m.success("Booking updated successfully")},G=async({event:o,start:r,end:s})=>{const i=v.map(n=>n.id===o.id?{...n,start:r,end:s}:n);R(i);const{error:l}=await b.from("bookings").update({check_in_date:moment(r).format("YYYY-MM-DD"),check_out_date:moment(s).format("YYYY-MM-DD")}).eq("id",o.id);l?(m.error("Failed to resize booking"),h()):m.success("Booking dates updated")},T=o=>{let r="#3182ce";return o.status==="confirmed"&&(r="#38a169"),o.status==="checked_in"&&(r="#805ad5"),o.status==="cancelled"&&(r="#e53e3e"),o.status==="no_show"&&(r="#dd6b20"),{style:{backgroundColor:r,borderRadius:"4px",opacity:.9,color:"white",border:"0px",display:"block"}}};return e.jsxs("div",{className:"space-y-6 h-full flex flex-col",children:[e.jsx("style",{children:`
        /* Dark Mode overrides for react-big-calendar */
        .rbc-calendar {
          font-family: inherit;
        }
        .rbc-header {
          border-bottom: 1px solid #374151 !important;
          border-left: 1px solid #374151 !important;
          background: #111827;
          color: #9CA3AF;
          padding: 10px 0;
          font-weight: 600;
        }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
          border: 1px solid #374151;
          border-radius: 0.5rem;
          background-color: #1F2937;
        }
        .rbc-day-bg {
          border-left: 1px solid #374151 !important;
        }
        .rbc-month-row {
          border-top: 1px solid #374151 !important;
        }
        .rbc-off-range-bg {
          background-color: #111827;
        }
        .rbc-today {
          background-color: rgba(223, 104, 83, 0.1);
        }
        .rbc-date-cell {
          padding-right: 5px;
          color: #D1D5DB;
        }
        .rbc-off-range {
          color: #4B5563;
        }
        .rbc-time-content {
          border-top: 1px solid #374151;
        }
        .rbc-time-header-content {
          border-left: 1px solid #374151;
        }
        .rbc-timeslot-group {
          border-bottom: 1px solid #374151;
        }
        .rbc-time-gutter .rbc-timeslot-group {
          background: #1F2937;
          color: #9CA3AF;
        }
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid rgba(55, 65, 81, 0.5);
        }
        .rbc-btn-group button {
          color: #D1D5DB;
          border: 1px solid #374151;
          background: #1F2937;
        }
        .rbc-btn-group button:hover {
          background: #374151;
          color: #FFF;
        }
        .rbc-btn-group button.rbc-active {
          background: #DF6853;
          border-color: #DF6853;
          color: #FFF;
          box-shadow: none;
        }
        .rbc-toolbar button:active, .rbc-toolbar button.rbc-active:hover {
          background: #c55b48;
        }
        .rbc-toolbar-label {
          color: #FFF;
          font-weight: bold;
          font-size: 1.25rem;
        }
        .rbc-event {
          border-radius: 4px;
        }
      `}),e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold text-white",children:"Visual Calendar"}),e.jsx("p",{className:"text-gray-200 mt-1",children:"Drag and drop bookings to change dates or assign rooms."})]}),e.jsx("div",{className:"bg-dark-800 border border-dark-700 shadow-sm p-4 rounded-lg flex-1 min-h-[700px]",children:L?e.jsx("div",{className:"h-full flex items-center justify-center text-gray-300",children:"Loading calendar data..."}):e.jsx(Z,{localizer:Q,events:v,onEventDrop:I,onEventResize:G,onSelectEvent:o=>{k(o),p(o.status==="no_show")},resizable:!0,selectable:!0,startAccessor:"start",endAccessor:"end",eventPropGetter:T,style:{height:"100%"},views:["month","week","day","agenda"],defaultView:"month",popup:!0})}),t&&e.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",children:e.jsxs("div",{className:"bg-dark-800 border border-dark-700 w-full max-w-lg rounded-xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto",children:[e.jsxs("div",{className:"flex justify-between items-center border-b border-dark-700 pb-3 mb-4",children:[e.jsx("h3",{className:"text-lg font-bold",children:"Booking Details"}),e.jsx("button",{onClick:()=>{k(null),p(!1)},className:"text-gray-200 hover:text-white",children:"✕"})]}),e.jsxs("div",{className:"space-y-3 mb-6",children:[e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Guest Name:"}),e.jsx("span",{className:"font-semibold text-white",children:t.booking.profiles?`${t.booking.profiles.first_name} ${t.booking.profiles.last_name}`:t.booking.special_requests||"Walk-in"})]}),e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Reference:"}),e.jsx("span",{className:"font-mono text-gold-500 font-semibold",children:t.booking.booking_reference})]}),e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Room:"}),e.jsxs("span",{className:"font-semibold text-white",children:["Room ",t.booking.rooms?.room_number," (",t.booking.rooms?.name,")"]})]}),e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Dates:"}),e.jsxs("span",{className:"font-semibold text-white",children:[t.booking.check_in_date," to ",t.booking.check_out_date]})]}),e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Status:"}),e.jsx("span",{className:`px-2 py-0.5 rounded text-xs font-semibold uppercase ${t.status==="confirmed"?"bg-green-500/20 text-green-400 border border-green-500/30":t.status==="checked_in"?"bg-purple-500/20 text-purple-400 border border-purple-500/30":t.status==="no_show"?"bg-amber-500/20 text-amber-400 border border-amber-500/30":t.status==="cancelled"?"bg-red-500/20 text-red-400 border border-red-500/30":"bg-blue-500/20 text-blue-400 border border-blue-500/30"}`,children:t.status})]}),e.jsxs("div",{className:"flex justify-between py-1 border-b border-dark-700/50",children:[e.jsx("span",{className:"text-gray-200",children:"Amount Paid:"}),e.jsxs("span",{className:"font-semibold text-green-400 font-mono",children:["₦",Number(t.booking.amount_paid_ngn||0).toLocaleString()]})]}),e.jsxs("div",{className:"flex justify-between py-1",children:[e.jsx("span",{className:"text-gray-200",children:"Total Bill:"}),e.jsxs("span",{className:"font-semibold text-white font-mono",children:["₦",Number(t.booking.total_amount_ngn||0).toLocaleString()]})]})]}),e.jsxs("div",{className:"space-y-4 pt-2 border-t border-dark-700",children:[!g&&t.status!=="cancelled"&&t.status!=="checked_out"&&e.jsxs("div",{className:"flex flex-col sm:flex-row gap-3",children:[e.jsx("button",{disabled:w,onClick:()=>z(t.booking),className:"flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm",children:"Mark as No-Show Only"}),e.jsx("button",{disabled:w,onClick:()=>p(!0),className:"flex-1 px-4 py-2.5 bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm",children:"Mark as No-Show & Rebook"})]}),g&&e.jsxs("form",{onSubmit:O,className:"space-y-4",children:[e.jsxs("div",{className:"bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4",children:[e.jsx("h4",{className:"font-bold text-gold-500 text-sm tracking-wider uppercase",children:"Rebook Guest"}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{className:"flex flex-col space-y-1",children:[e.jsx("label",{className:"text-xs text-gray-200 font-semibold",children:"New Check-In"}),e.jsx("input",{type:"date",required:!0,value:u,onChange:o=>D(o.target.value),className:"bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500"})]}),e.jsxs("div",{className:"flex flex-col space-y-1",children:[e.jsx("label",{className:"text-xs text-gray-200 font-semibold",children:"New Check-Out"}),e.jsx("input",{type:"date",required:!0,value:x,onChange:o=>S(o.target.value),className:"bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500"})]})]}),e.jsxs("div",{className:"flex flex-col space-y-1",children:[e.jsx("label",{className:"text-xs text-gray-200 font-semibold",children:"Select Room"}),e.jsxs("select",{required:!0,value:f,onChange:o=>C(o.target.value),className:"bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500",disabled:_,children:[e.jsx("option",{value:"",children:"-- Choose a Room --"}),y.map(o=>e.jsxs("option",{value:o.id,children:["Room ",o.room_number," - ",o.name," (₦",Number(o.base_price_ngn).toLocaleString(),"/night)"]},o.id))]}),_&&e.jsx("span",{className:"text-xs text-gray-200 animate-pulse",children:"Checking available inventory..."}),!_&&y.length===0&&u&&x&&e.jsx("span",{className:"text-xs text-red-400",children:"No rooms available for the selected dates."})]})]}),u&&x&&f&&(()=>{const o=y.find(a=>a.id===f);if(!o)return null;const r=Math.max(1,moment(x).diff(moment(u),"days")),s=Number(t.booking.amount_paid_ngn||0),l=Number(o.base_price_ngn)*r+(t.booking.total_extras_price_ngn||0),n=l-s;return e.jsxs("div",{className:"bg-dark-900/50 border border-dark-700/50 p-4 rounded-lg space-y-2 text-sm font-sans",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-gray-200",children:"Nights:"}),e.jsxs("span",{children:[r," night(s)"]})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-gray-200",children:"New Total Cost:"}),e.jsxs("span",{className:"font-semibold text-white font-mono",children:["₦",l.toLocaleString()]})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-gray-200",children:"Carried Balance Paid:"}),e.jsxs("span",{className:"font-semibold text-green-400 font-mono",children:["₦",s.toLocaleString()]})]}),e.jsxs("div",{className:"flex justify-between border-t border-dark-700/50 pt-2 font-bold",children:[e.jsx("span",{className:"text-gray-300",children:n>0?"Pending Balance:":"Overpaid Balance:"}),e.jsxs("span",{className:n>0?"text-amber-500 font-mono":"text-green-400 font-mono",children:["₦",Math.abs(n).toLocaleString()]})]}),e.jsx("p",{className:"text-[10px] text-gray-300 leading-normal",children:"* Confirming this rebooking updates the booking dates and assigns the selected room. A payment ledger entry of ₦0 with description 'rebook' is recorded."})]})})(),e.jsxs("div",{className:"flex gap-3",children:[e.jsx("button",{type:"button",onClick:()=>{p(!1)},className:"flex-1 px-4 py-2.5 bg-dark-900 border border-dark-700 hover:bg-dark-950 text-gray-300 font-semibold rounded-lg transition-colors text-sm",children:"Cancel"}),e.jsx("button",{type:"submit",disabled:w||_||!f,className:"flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm",children:w?"Confirming...":"Confirm Rebooking"})]})]})]})]})})]})};export{le as default};
