import fs from 'fs';

const filePath = 'c:/Users/jerry/Desktop/Apartment booking project/frontend/src/pages/admin/Maintenance.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let inForm = false;
let formLine = 0;
lines.forEach((line, index) => {
    if (line.includes('<form')) {
        inForm = true;
        formLine = index + 1;
    }
    if (line.includes('</form>')) {
        inForm = false;
    }
    if (line.includes('Approve to Pay')) {
        console.log(`Approve to Pay found at line ${index + 1}. Inside form? ${inForm} (Form started at line ${formLine})`);
    }
});
