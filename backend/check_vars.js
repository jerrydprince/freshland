import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Maintenance.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('const [professionals')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
    if (line.includes('const [purchases')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
    if (line.includes('const handleApproveDisbursement')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
