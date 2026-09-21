/** Local frontend + existing project backend. Never seeds, migrates, imports or starts demo. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config as loadEnv } from 'dotenv';
import { checkRealApi, realConfig } from './real-config';

const root = resolve(import.meta.dirname, '../..');
const inherited = { ...process.env };
loadEnv({ path: resolve(root, '.env'), quiet: true });
const children: ChildProcess[] = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      // Each owned child has its own process group, including Next/tsx descendants.
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* Already stopped. Never target unrelated processes. */
    }
  }
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function launch(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('error', () => {
    console.error('Не удалось запустить процесс приложения.');
    stop(1);
  });
  child.on('exit', (code) => stop(code || 0));
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (open: boolean) => {
      socket.destroy();
      resolvePort(open);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

try {
  const config = realConfig(process.env);
  const checkOnly = process.argv.includes('--check');
  if (!checkOnly) {
    if (await portOpen(3000))
      throw new Error('Порт 3000 занят. Остановите предыдущий frontend перед запуском.');
    if (config.startApi) {
      if (await portOpen(config.apiPort))
        throw new Error('Порт API занят. Для существующего backend задайте APP_API_URL.');
      console.log('Запуск backend проекта. Фоновые синхронизации и автоисправления отключены.');
      launch(
        [
          resolve(root, 'node_modules/tsx/dist/cli.mjs'),
          'watch',
          '--clear-screen=false',
          // В workspace зависимости выше cwd API; события в них не должны ронять запросы.
          '--exclude',
          resolve(root, 'node_modules/**'),
          'src/main.ts',
        ],
        resolve(root, 'apps/api'),
        {
          ...process.env,
          NODE_ENV: 'development',
          API_PORT: String(config.apiPort),
          CHANNEX_PULL: 'off',
          CHANNEX_OUTBOX_WORKER: 'off',
          CHANNEX_FULL_SYNC: 'off',
          CHANNEX_WEBHOOK_HEALTH: 'off',
          GUARD: 'off',
          GUARD_AUTOFIX: 'off',
        },
      );
      const deadline = Date.now() + 30_000;
      while (!stopping && !(await portOpen(config.apiPort)) && Date.now() < deadline)
        await delay(250);
      if (stopping) throw new Error('Backend завершился до проверки подключения.');
    }
  }
  await checkRealApi(config.apiUrl);
  if (!stopping) {
    console.log('Backend и база проекта доступны. Демоданные отключены.');
    if (!checkOnly) {
      launch(
        [
          resolve(root, 'node_modules/next/dist/bin/next'),
          'dev',
          '--port',
          '3000',
          '--hostname',
          '127.0.0.1',
        ],
        resolve(root, 'apps/web'),
        {
          ...inherited,
          NODE_ENV: 'development',
          APP_API_URL: config.apiUrl,
          APP_DEMO_MODE: '',
          APP_ALLOW_TEST_DATA: '',
          APP_UI_TEST: '',
        },
      );
      console.log(
        'Frontend: http://127.0.0.1:3000 · Подключения: http://127.0.0.1:3000/connections',
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Не удалось запустить проект.');
  stop(1);
}
