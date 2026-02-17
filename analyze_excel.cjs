
const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('base_datos.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get headers (first row)
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length > 0) {
        console.log('TOTAL ROWS:', data.length);
        console.log('SAMPLE ROWS:');
        for (let i = 0; i < Math.min(20, data.length); i++) {
            console.log(`ROW ${i}:`, JSON.stringify(data[i]));
        }
    } else {
        console.log('EMPTY_FILE');
    }
} catch (e) {
    console.error('ERROR:', e.message);
}
