import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Accounting.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("Searching for 'Sunday'...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('sunday')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\nSearching for 'penalty'...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('penalty')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\nSearching for 'expected'...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('expected') && line.toLowerCase().includes('day')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
