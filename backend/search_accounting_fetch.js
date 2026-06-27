import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Accounting.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("Searching for 'setStaff'...");
lines.forEach((line, idx) => {
  if (line.includes('setStaff')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\nSearching for load functions (e.g. 'fetchData', 'loadData', 'fetchAccounting') ...");
lines.forEach((line, idx) => {
  if ((line.includes('const fetch') || line.includes('function fetch')) && line.includes(' = ') && idx < 500) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
