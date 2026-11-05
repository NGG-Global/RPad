// Minimal static server WITHOUT custom headers, used to test the GitHub Pages
// build: serves a directory under a URL prefix, like https://owner.github.io/<repo>/.
//   node scripts/static-server.mjs <dir> <prefix> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [dir = 'dist-pages', prefix = '/RPad/', port = '4175'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.so': 'application/octet-stream' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(404).end();
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(prefix.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(path.resolve(dir), rel);
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const headers = { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size };
    if (req.method === 'HEAD') {
      res.writeHead(200, headers).end();
      return;
    }
    res.writeHead(200, headers).end(await readFile(file));
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`static server: http://127.0.0.1:${port}${prefix} -> ${dir}`));
