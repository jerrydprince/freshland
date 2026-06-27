import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Maintenance.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let start = -1;
let openBrackets = 0;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleApproveDisbursement = async (payment) => {')) {
        start = i;
    }
    
    if (start !== -1) {
        console.log(`Line ${i + 1}: ${lines[i]}`);
        openBrackets += (lines[i].match(/{/g) || []).length;
        openBrackets -= (lines[i].match(/}/g) || []).length;
        
        if (openBrackets === 0) {
            break;
        }
    }
}
