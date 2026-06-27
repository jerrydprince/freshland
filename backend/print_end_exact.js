import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Billing.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = lines.length - 15; i < lines.length; i++) {
  console.log(`Line ${i + 1}: ${lines[i].replace(/\r/g, '')}`);
}
