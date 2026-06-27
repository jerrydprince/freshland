import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/Booking.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('hall') && (lines[i].includes('checkout') || lines[i].includes('handleHall') || lines[i].includes('Hall') && lines[i].includes('submit') || lines[i].includes('booking_mode') || lines[i].includes('handleBook'))) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
