const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add new imports
content = content.replace(
  /} from 'lucide-react';/,
  ', Activity, ConciergeBell, Building2, Store, Landmark, Shield } from \'lucide-react\';'
);

const navSections = [
  { key: 'overview', title: 'Overview & Comms', iconComponent: '<Activity size={16} className="text-brand-500/80" />' },
  { key: 'frontOffice', title: 'Front Office', iconComponent: '<ConciergeBell size={16} className="text-brand-500/80" />' },
  { key: 'hotelOperations', title: 'Hotel Operations', iconComponent: '<Building2 size={16} className="text-brand-500/80" />' },
  { key: 'pos', title: 'Point of Sale', iconComponent: '<Store size={16} className="text-brand-500/80" />' },
  { key: 'finance', title: 'Finance & Auditing', iconComponent: '<Landmark size={16} className="text-brand-500/80" />' },
  { key: 'systemControl', title: 'System Control', iconComponent: '<Shield size={16} className="text-brand-500/80" />' }
];

navSections.forEach(sec => {
  // Find the exact button HTML for this section
  // It looks like:
  // <button onClick={() => toggleMenu('overview')} className="w-full flex items-center justify-between text-[10px] font-black text-brand-500/85 uppercase tracking-widest px-3 pt-2 pb-1.5 hover:bg-brand-500/10 hover:text-brand-400 rounded-lg transition-colors cursor-pointer outline-none">
  //             <span>Overview & Comms</span>
  //             {openMenus.overview ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
  //           </button>
  
  const searchRegex = new RegExp(
    `<button onClick={\\(\\) => toggleMenu\\('${sec.key}'\\)}.*?<span>${sec.title.replace('&', '&amp;')}</span>.*?<ChevronRight size={12} /> }\\s*</button>`,
    's' // dotAll
  );
  
  const replacement = `<button onClick={() => toggleMenu('${sec.key}')} className="w-full flex items-center justify-between text-xs font-black text-white bg-dark-800/40 hover:bg-brand-500/15 hover:text-brand-400 border border-dark-700/50 px-3.5 py-2.5 rounded-xl transition-all duration-300 cursor-pointer outline-none shadow-sm uppercase tracking-widest group">
              <div className="flex items-center gap-2.5">
                ${sec.iconComponent}
                <span>${sec.title}</span>
              </div>
              <div className="text-gray-500 group-hover:text-brand-400 transition-colors">
                {openMenus.${sec.key} ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </button>`;

  content = content.replace(searchRegex, replacement);
});

fs.writeFileSync(file, content);
console.log('AdminLayout buttons updated successfully.');
