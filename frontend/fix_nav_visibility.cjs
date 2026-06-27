const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldBtnClass = 'w-full flex items-center justify-between text-[11px] font-bold text-gray-200 bg-gradient-to-r from-dark-800/80 to-dark-900/80 backdrop-blur-xl hover:from-brand-500/20 hover:to-dark-800/90 hover:text-brand-300 border border-white/5 hover:border-brand-500/40 px-4 py-3 rounded-2xl transition-all duration-500 ease-out cursor-pointer outline-none shadow-lg hover:shadow-[0_8px_25px_-5px_rgba(223,104,83,0.25)] hover:-translate-y-1 uppercase tracking-[0.15em] group overflow-hidden relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-brand-500/0 before:via-brand-500/10 before:to-brand-500/0 before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700';

const fixedBtnClass = 'w-full flex items-center justify-between text-xs font-bold text-white bg-dark-800 hover:bg-brand-500/10 hover:text-brand-400 border border-dark-700/50 hover:border-brand-500/40 px-4 py-3 rounded-2xl transition-all duration-300 cursor-pointer outline-none shadow-md hover:shadow-[0_6px_20px_rgba(223,104,83,0.15)] hover:-translate-y-0.5 uppercase tracking-widest group relative overflow-hidden';

content = content.split(oldBtnClass).join(fixedBtnClass);

// We need to add relative z-10 to the inner elements so they are above any potential stacking context issues
content = content.split('<div className="flex items-center gap-2.5">').join('<div className="flex items-center gap-2.5 relative z-10">');
content = content.split('className="text-gray-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all duration-300"').join('className="text-gray-400 group-hover:text-brand-400 group-hover:translate-x-1 transition-all duration-300 relative z-10"');

fs.writeFileSync(file, content);
console.log('Fixed visibility and simplified styles.');
