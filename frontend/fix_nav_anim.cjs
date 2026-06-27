const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// Reduce spacing
content = content.replace(/space-y-6 overflow-y-auto/, 'space-y-3 overflow-y-auto');

// Introduce animation classes on the button
const oldBtnClass = 'w-full flex items-center justify-between text-xs font-black text-white bg-dark-800/40 hover:bg-brand-500/15 hover:text-brand-400 border border-dark-700/50 px-3.5 py-2.5 rounded-xl transition-all duration-300 cursor-pointer outline-none shadow-sm uppercase tracking-widest group';
const newBtnClass = 'w-full flex items-center justify-between text-xs font-black text-white bg-dark-800/40 hover:bg-brand-500/15 hover:text-brand-400 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(223,104,83,0.15)] border border-dark-700/50 hover:border-brand-500/30 px-3.5 py-2.5 rounded-xl transition-all duration-300 cursor-pointer outline-none uppercase tracking-widest group';

content = content.split(oldBtnClass).join(newBtnClass);

// Animate icons
const icons = ['Activity', 'ConciergeBell', 'Building2', 'Store', 'Landmark', 'Shield'];
icons.forEach(icon => {
  const oldIconStr = '<' + icon + ' size={16} className="text-brand-500/80" />';
  const newIconStr = '<' + icon + ' size={16} className="text-brand-500/80 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300" />';
  content = content.replace(oldIconStr, newIconStr);
});

// Also animate the chevron
content = content.split('className="text-gray-500 group-hover:text-brand-400 transition-colors"').join('className="text-gray-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all duration-300"');

fs.writeFileSync(file, content);
console.log('Updated spacing and animations successfully.');
