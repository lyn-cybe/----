import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('public/lib', { recursive: true });
await copyFile('node_modules/page-flip/dist/js/page-flip.browser.js', 'public/lib/page-flip.browser.js');
await copyFile('node_modules/page-flip/LICENSE', 'public/lib/StPageFlip-LICENSE.txt');
console.log('StPageFlip 2.0.7 browser bundle and MIT license prepared.');
