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
// List of files worth caching ahead of time for offline use: every lazy
// filesystem index, the bundled fonts and the graphics support chunks. Help
// pages and demos are left out (they are fetched on demand).
import { readdirSync, statSync } from 'node:fs';
const warm = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const rel = path.relative(dest, full).split(path.sep).join('/');
      const isDoc = /(^|\/)(html|help|demo|doc)\.(data\.gz|js\.metadata)$/.test(rel);
      const isChunk = rel.endsWith('.data.gz') || rel.endsWith('.js.metadata');
      const keep =
        !isChunk || // individually served files (fontconfig cache, translations DESCRIPTION, certificates)
        rel.endsWith('.js.metadata') ||
        rel.startsWith('vfs/usr/share/fonts/') ||
        rel.startsWith('vfs/var/cache/fontconfig/') ||
        rel.startsWith('vfs/etc/fonts/') ||
        /^vfs\/usr\/lib\/R\/library\/grDevices\/(fonts|libs|afm|enc)\.data\.gz$/.test(rel) ||
        rel === 'vfs/usr/lib/R/share.data.gz';
      if (keep && !isDoc) warm.push(rel);
    }
  }
};
walk(path.join(dest, 'vfs'));
writeFileSync(path.join(dest, 'warm-list.json'), JSON.stringify(warm));
writeFileSync(stamp, pkg.version + '\n');
console.log(`Copied webr ${pkg.version} to public/webr`);
