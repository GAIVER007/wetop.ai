// Стойка в launchd на production-сборке (ADR-034): нет сборки → `next build`, затем `next start`.
// Обёртка на node, а не на bash: launchd не даёт bash читать папку проекта на «Рабочем столе», node — даёт
// (install.sh, 13.09.2026). next запускается напрямую, без npm и sh: сигнал доходит до сервера, а модуль
// exit-with-parent.cjs завершает сервер, если обёртку добили SIGKILL (иначе сирота держит порт и память).
//   node scripts/ops/launchd/web-start.mjs
// Выкатка правки стойки: npm run build -w apps/web && launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.web
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

// Те же адрес и порт, что в apps/web/package.json (скрипт start)
const HOST = '127.0.0.1';
const PORT = 3000;
const WEB = resolve('apps/web');
const nextBin = createRequire(resolve(WEB, 'package.json')).resolve('next/dist/bin/next');
const preload = resolve('scripts/ops/launchd/exit-with-parent.cjs');
const stamp = () => new Date().toISOString();

if (!existsSync(resolve(WEB, '.next/BUILD_ID'))) {
  console.log(`${stamp()} web-start: production-сборки нет — next build`);
  const build = spawnSync(process.execPath, [nextBin, 'build'], { cwd: WEB, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error(`${stamp()} web-start: сборка упала (код ${build.status}) — стойка не запущена`);
    process.exit(build.status ?? 1);
  }
}

/** Прежний сервер после перезапуска может ещё секунду-другую держать порт */
const portFree = () =>
  new Promise((ok) => {
    const probe = createServer();
    probe.once('error', () => ok(false));
    probe.listen(PORT, HOST, () => probe.close(() => ok(true)));
  });
for (let i = 0; i < 30 && !(await portFree()); i++) {
  if (i === 0) console.log(`${stamp()} web-start: порт ${PORT} занят — жду`);
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`${stamp()} web-start: next start`);
const child = spawn(
  process.execPath,
  ['--require', preload, nextBin, 'start', '--port', String(PORT), '--hostname', HOST],
  { cwd: WEB, stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    child.kill(signal);
    // launchd долго ждать не будет; сервер без родителя всё равно выйдет сам (exit-with-parent.cjs)
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
