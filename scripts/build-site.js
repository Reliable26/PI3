import fs from 'node:fs/promises';
import path from 'node:path';

const files = ['index.html', 'app.js', 'styles.css', '.nojekyll'];
await fs.mkdir('dist', { recursive: true });
for (const file of files) {
  await fs.copyFile(file, path.join('dist', file));
}
console.log('Static site copied to dist/');
