const XLSX = require('xlsx');
const path = require('path');

const wb   = XLSX.readFile(process.argv[2]);
const ws   = wb.Sheets['Usuarios'];
const filas= XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

console.log('\nTotal filas:', filas.length);
console.log('\nPrimera fila (claves):', Object.keys(filas[0]));
console.log('\nPrimeras 3 filas:');
filas.slice(0, 3).forEach((f, i) => console.log(`  [${i}]`, JSON.stringify(f)));

const roles = [...new Set(filas.map(f => f.rol))];
console.log('\nValores únicos de "rol":', roles);
