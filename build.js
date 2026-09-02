const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'public');
const output = path.join(__dirname, 'dist');

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });

console.log('Static site prepared in dist.');
