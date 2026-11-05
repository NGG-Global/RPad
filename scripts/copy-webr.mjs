// Copies the pinned WebR distribution from node_modules into public/webr so the
// app self-hosts the exact tested runtime version (no unpinned CDN dependency).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'node_modules', 'webr', 'dist');
const dest = path.join(root, 'public', 'webr');
const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules', 'webr', 'package.json'), 'utf8'));
const stamp = path.join(dest, 'VERSION');

if (!existsSync(src)) {
  console.error('webr is not installed. Run `npm install` first.');
  process.exit(1);
}
if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === pkg.version) {
  console.log(`public/webr already at webr ${pkg.version}`);
  process.exit(0);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const entry of ['R.js', 'R.wasm', 'libRblas.so', 'libRlapack.so', 'webr-worker.js', 'webr.mjs', 'vfs']) {
  cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true });
}
writeFileSync(stamp, pkg.version + '\n');
console.log(`Copied webr ${pkg.version} to public/webr`);
