import { compress } from 'brotli';
import { readFileSync } from 'fs'

const minified = readFileSync('dist/index.min.js');

console.log('Uncompressed, minified:', minified.length, 'Bytes');

const brotliCompressed = compress(minified);

console.log('Brotli -11:', brotliCompressed.length, 'Bytes');

const gzipCompressed = Bun.gzipSync(minified, {level: 9});

console.log('Gzip -9:', gzipCompressed.length, 'Bytes');
