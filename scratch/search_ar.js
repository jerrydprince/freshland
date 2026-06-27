const fs = require('fs');
const content = fs.readFileSync('c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/StaffManagement.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('roleStructures') && line.includes('useState')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
