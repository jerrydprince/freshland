const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// Change text to 'Finance & Audit'
content = content.replace(/<span>Finance & Auditing<\/span>/g, '<span className="truncate">Finance & Audit</span>');

// Change tracking-widest to tracking-wider globally for the buttons so they don't stretch too much
content = content.replace(/tracking-widest/g, 'tracking-wider');

// Reduce font size slightly for buttons from text-xs to text-[11px] to ensure they fit well
content = content.replace(/text-xs font-bold text-white bg-dark-800/g, 'text-[11px] font-bold text-white bg-dark-800');

fs.writeFileSync(file, content);
console.log('Fixed finance button width');
