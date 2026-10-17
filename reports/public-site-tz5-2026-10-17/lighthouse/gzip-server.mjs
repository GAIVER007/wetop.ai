// Статический сервер для замера: как Cloudflare Pages, сжимает текст (gzip), каталог/ → index.html. Только для Lighthouse.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import process from 'node:process';
import { URL } from 'node:url';
const [root, port] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json', '.xml': 'application/xml' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(root, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { f = join(root, '404.html'); res.statusCode = 404; }
  try {
    let body = await readFile(f); const type = TYPES[extname(f)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', type);
    if (/text|javascript|svg|json|xml/.test(type) && /gzip/.test(req.headers['accept-encoding'] ?? '')) { body = gzipSync(body); res.setHeader('Content-Encoding', 'gzip'); }
    if (p.startsWith('/_next/static/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(body);
  } catch { res.statusCode = 404; res.end('not found'); }
}).listen(Number(port), '127.0.0.1');
