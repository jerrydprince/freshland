import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Billing.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('paymentMethod') || line.includes('setPaymentMethod')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
