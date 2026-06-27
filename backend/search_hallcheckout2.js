import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/Booking.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const matches = [...content.matchAll(/handleHallCheckout/g)];
matches.forEach(m => {
  const line = content.substring(0, m.index).split('\n').length;
  const lineText = content.split('\n')[line - 1];
  console.log(`Line ${line}: ${lineText}`);
});
