const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /} from 'lucide-react';/,
  ', ChevronDown, ChevronRight } from \'lucide-react\';'
);

const stateCode = `  const [brandLogo, setBrandLogo] = useState(() => localStorage.getItem('contact_logo') || '');

  const [openMenus, setOpenMenus] = useState({
    overview: true,
    frontOffice: true,
    hotelOperations: true,
    pos: true,
    finance: true,
    systemControl: true
  });

  const toggleMenu = (key) => setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));`;

content = content.replace(
  /  const \[brandLogo, setBrandLogo\] = useState\(\(\) => localStorage\.getItem\('contact_logo'\) \|\| ''\);/,
  stateCode
);

const navSections = [
  { key: 'overview', title: 'Overview & Comms' },
  { key: 'frontOffice', title: 'Front Office' },
  { key: 'hotelOperations', title: 'Hotel Operations' },
  { key: 'pos', title: 'Point of Sale' },
  { key: 'finance', title: 'Finance & Auditing' },
  { key: 'systemControl', title: 'System Control' }
];

navSections.forEach(sec => {
  const h4Regex = new RegExp(`<h4 className=\"text-\\[9px\\] font-black text-brand-500/85 uppercase tracking-widest px-3 pt-2 pb-1\">${sec.title.replace('&', '&amp;')}</h4>\\s*<div className=\"space-y-0.5\">`);
  const actualTitle = sec.title === 'Overview & Comms' ? 'Overview & Comms' : 
                      sec.title === 'Finance & Auditing' ? 'Finance & Auditing' : sec.title;
  // Let's use string replace instead of regex for the exact h4 to avoid regex escaping issues.
  const h4Str = `<h4 className="text-[9px] font-black text-brand-500/85 uppercase tracking-widest px-3 pt-2 pb-1">${actualTitle}</h4>\n            <div className="space-y-0.5">`;
  
  const replacement = `<button onClick={() => toggleMenu('${sec.key}')} className="w-full flex items-center justify-between text-[10px] font-black text-brand-500/85 uppercase tracking-widest px-3 pt-2 pb-1.5 hover:bg-brand-500/10 hover:text-brand-400 rounded-lg transition-colors cursor-pointer outline-none">
              <span>${actualTitle}</span>
              {openMenus.${sec.key} ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {openMenus.${sec.key} && (
            <div className="space-y-0.5 animate-in slide-in-from-top-1 fade-in duration-200 mt-1">`;
            
  content = content.replace(h4Str, replacement);
});

content = content.replace(/<\/div>\n          <\/div>\n          \)}/g, '</div>\n            )}\n          </div>\n          )}');

fs.writeFileSync(file, content);
console.log('AdminLayout updated successfully.');
