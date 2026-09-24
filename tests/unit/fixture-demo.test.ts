import { spawn, type ChildProcess } from 'node:child_process';
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
    const port = 44_000 + (process.pid % 1_000);
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
