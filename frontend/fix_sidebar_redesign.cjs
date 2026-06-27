const fs = require('fs');
const file = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update linkClass
const oldLinkClass = `const linkClass = (path) => {
    const isActive = location.pathname === path;
    return \`block px-3 py-2.5 rounded-lg transition-all duration-300 \${
      isActive
        ? 'bg-brand-500 text-white shadow-md font-bold'
        : 'text-gray-400 hover:bg-dark-800 hover:text-white font-medium'
    }\`;
  };`;

const newLinkClass = `const linkClass = (path) => {
    const isActive = location.pathname === path;
    return \`block px-3.5 py-2.5 rounded-xl transition-all duration-300 font-sans tracking-wide \${
      isActive
        ? 'bg-gradient-to-r from-brand-500/15 to-transparent text-brand-400 border-l-2 border-brand-500 shadow-sm font-semibold'
        : 'text-gray-400/90 hover:bg-white/5 hover:text-gray-100 hover:translate-x-1 font-medium border-l-2 border-transparent'
    }\`;
  };`;

// Note: the original linkClass in AdminLayout might be slightly different.
// Let's use regex to replace it safely.
content = content.replace(/const linkClass = \(path\) => \{[\s\S]*?return \`block px-3 py-2\.5 rounded-lg transition-all duration-300 \\?\$\{[\s\S]*?isActive[\s\S]*?\? 'bg-brand-500 text-white shadow-md font-bold'[\s\S]*?: 'text-gray-400 hover:bg-dark-800 hover:text-white font-medium'[\s\S]*?\}\`;\s*\};\s*/g, newLinkClass + '\n\n  ');

// 2. Update sidebar container styling
content = content.replace(
  /<aside className=\{\`fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 transform transition-transform duration-300 ease-in-out flex flex-col \$\{isMobileMenuOpen \? 'translate-x-0' : '-translate-x-full md:translate-x-0'\}\`\}>/g,
  '<aside className={`fixed inset-y-0 left-0 z-50 w-[270px] bg-dark-900/95 backdrop-blur-2xl border-r border-white/5 transform transition-transform duration-300 ease-in-out flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.2)] font-sans ${isMobileMenuOpen ? \'translate-x-0\' : \'-translate-x-full md:translate-x-0\'}`}>'
);

// 3. Make the nav container spacing tighter and add padding
content = content.replace(
  /<nav className="flex-1 px-3 py-6 space-y-4 overflow-y-auto custom-scrollbar select-none">/g,
  '<nav className="flex-1 px-4 py-8 space-y-6 overflow-y-auto custom-scrollbar select-none">'
);

// We need to also make sure the brand logo area looks trendy
content = content.replace(
  /<div className="h-16 flex items-center justify-between px-4 border-b border-dark-800">/g,
  '<div className="h-[76px] flex items-center justify-between px-6 border-b border-white/5 bg-dark-900/50">'
);

fs.writeFileSync(file, content);
console.log('Sidebar trendy redesign applied successfully.');
