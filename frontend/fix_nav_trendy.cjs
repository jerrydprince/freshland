const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// Update spacing to space-y-4
content = content.replace(/space-y-3 overflow-y-auto/, 'space-y-4 overflow-y-auto');

// The current button class
const oldBtnClass = 'w-full flex items-center justify-between text-xs font-black text-white bg-dark-800/40 hover:bg-brand-500/15 hover:text-brand-400 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(223,104,83,0.15)] border border-dark-700/50 hover:border-brand-500/30 px-3.5 py-2.5 rounded-xl transition-all duration-300 cursor-pointer outline-none uppercase tracking-widest group';

// The trendy button class
const trendyBtnClass = 'w-full flex items-center justify-between text-[11px] font-bold text-gray-200 bg-gradient-to-r from-dark-800/80 to-dark-900/80 backdrop-blur-xl hover:from-brand-500/20 hover:to-dark-800/90 hover:text-brand-300 border border-white/5 hover:border-brand-500/40 px-4 py-3 rounded-2xl transition-all duration-500 ease-out cursor-pointer outline-none shadow-lg hover:shadow-[0_8px_25px_-5px_rgba(223,104,83,0.25)] hover:-translate-y-1 uppercase tracking-[0.15em] group overflow-hidden relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-brand-500/0 before:via-brand-500/10 before:to-brand-500/0 before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700';

content = content.split(oldBtnClass).join(trendyBtnClass);

fs.writeFileSync(file, content);
console.log('Trendy styling applied successfully.');
