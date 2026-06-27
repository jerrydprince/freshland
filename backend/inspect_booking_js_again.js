import fs from 'fs';

const filePath = 'c:\\Users\\jerry\\Desktop\\Apartment booking project\\frontend\\dist\\assets\\Booking-C47YFyo8.js';

function read() {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log("File loaded. Length:", content.length);
  
  const targetCol = 225672;
  console.log("\n=== Around Col 225672 ===");
  console.log(content.substring(targetCol - 200, targetCol + 200));
}

read();
