
import * as XLSX from 'xlsx';
import * as fs from 'fs';

try {
    const workbook = XLSX.readFile('base_datos.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get headers (first row)
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length > 0) {
        console.log('HEADERS:', JSON.stringify(data[0]));
        if (data.length > 1) {
            console.log('FIRST_ROW:', JSON.stringify(data[1]));
        }
        if (data.length > 2) {
            console.log('SECOND_ROW:', JSON.stringify(data[2]));
        }
    } else {
        console.log('EMPTY_FILE');
    }
} catch (e) {
    console.error('ERROR:', e.message);
}
