import fs from 'fs/promises';
import path from 'path';
await fs.mkdir('dist', { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css']) {
  await fs.copyFile(file, path.join('dist', file));
}
console.log('Static site copied to dist/.');
