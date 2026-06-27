import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Billing.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
let brackets = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const renderSpecialistPayouts = () => {')) {
    start = i;
  }
  if (start !== -1) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
    brackets += (lines[i].match(/{/g) || []).length;
    brackets -= (lines[i].match(/}/g) || []).length;
    if (brackets === 0) break;
  }
}
