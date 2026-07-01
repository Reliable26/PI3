import fs from 'node:fs/promises';
await fs.mkdir('dist', { recursive: true });
await fs.cp('app', 'dist/app', { recursive: true });
await fs.cp('public', 'dist/public', { recursive: true });
await fs.copyFile('index.html', 'dist/index.html');
console.log('Site built to dist/');
