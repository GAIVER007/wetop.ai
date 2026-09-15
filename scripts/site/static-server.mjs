/**
 * Крошечный статический сервер для собранной главной (`apps/site/out`): им пользуются картинка ссылки
 * (`make-og-image.mjs`) и проверки сайта (`tests/site`). Ничего наружу не слушает — только loopback.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** @param {{root: string, port: number, routes?: Record<string, string>}} opts */
export async function serve({ root, port, routes = {} }) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (routes[path]) {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(routes[path]);
      return;
    }
    const base = resolve(root);
    const candidates = [join(root, path), join(root, path, 'index.html'), join(root, `${path.replace(/\/$/, '')}.html`)];
    for (const file of candidates) {
      // наружу из папки сборки не выходим (`..` в адресе); сервер и так только на loopback, но пусть и не умеет
      if (!resolve(file).startsWith(base + sep)) continue;
      try {
        if (!(await stat(file)).isFile()) continue;
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(await readFile(file));
        return;
      } catch {
        /* следующий кандидат */
      }
    }
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end('<!doctype html><title>404</title>404');
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

if (process.argv[1]?.endsWith('static-server.mjs')) {
  const root = process.argv[2] ?? new URL('../../apps/site/out', import.meta.url).pathname;
  const port = Number(process.argv[3] ?? 4321);
  const { url } = await serve({ root, port });
  console.log(`[site] ${root} → ${url}`);
}
