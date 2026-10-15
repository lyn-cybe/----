import { cp, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'story.js', 'app.js']) {
  await copyFile(file, `dist/${file}`);
}
await writeFile('dist/.nojekyll', '');
console.log('Built standalone book in dist/. Open index.html or host the complete folder.');
