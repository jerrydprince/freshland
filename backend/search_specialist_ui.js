import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Billing.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Specialist Payouts') || lines[i].includes('specialistPayouts.length')) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
