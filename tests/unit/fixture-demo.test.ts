import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
let child: ChildProcess | null = null;

afterEach(() => {
  child?.kill('SIGTERM');
  child = null;
});

describe('local demo preview', () => {
  it('starts its synthetic API without a database or providers', async () => {
    // Свободный порт от системы: 44000 + pid % 1000 совпадал с занятым портом раннера (EADDRINUSE 44410)
    const port = await new Promise<number>((done, fail) => {
      const probe = createServer();
      probe.once('error', fail);
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        probe.close(() => done(typeof address === 'object' && address ? address.port : 0));
      });
    });
    let stderr = '';
    child = spawn(
      process.execPath,
      ['--import', 'tsx', resolve(ROOT, 'scripts/preview/fixture-api.ts')],
      {
        cwd: ROOT,
        env: { ...process.env, WETOP_PREVIEW_MODE: 'demo', FIXTURE_PORT: String(port) },
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
    child.stderr?.on('data', (chunk) => (stderr += String(chunk)));

    const deadline = Date.now() + 5_000;
    let response: Response | null = null;
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`);
        break;
      } catch {
        await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      }
    }

    expect(child.exitCode, stderr).toBeNull();
    expect(response?.status, stderr).toBe(200);
    await expect(response!.json()).resolves.toEqual({ demo: true });
  });
});
