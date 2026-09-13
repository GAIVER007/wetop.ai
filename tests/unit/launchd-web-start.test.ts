/**
 * scripts/ops/launchd/exit-with-parent.cjs — процесс выходит, когда его родитель умер.
 * 13.09.2026: `launchctl kickstart -k` добил обёртку стойки SIGKILL, группу процессов launchd не снял,
 * и старый next-server остался сиротой (126 МБ на Mac со свопом 11 ГБ). SIGKILL не перехватить —
 * поэтому дочерний процесс сам следит за родителем.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRELOAD = resolve(import.meta.dirname, '../../scripts/ops/launchd/exit-with-parent.cjs');

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('exit-with-parent', () => {
  it('дочерний процесс завершается сам, когда родителя убили SIGKILL', async () => {
    // Родитель запускает долгоживущего ребёнка с модулем-сторожем и печатает его PID
    const parentCode = `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['--require', ${JSON.stringify(PRELOAD)}, '-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      console.log(child.pid);
      setInterval(() => {}, 1000);
    `;
    const parent = spawn(process.execPath, ['-e', parentCode], { stdio: ['ignore', 'pipe', 'inherit'] });
    const childPid = await new Promise<number>((ok, fail) => {
      parent.stdout.once('data', (d: Buffer) => ok(Number(String(d).trim())));
      parent.once('error', fail);
    });
    try {
      await sleep(1500);
      expect(alive(childPid)).toBe(true); // ребёнок жив, пока жив родитель

      parent.kill('SIGKILL');
      let gone = false;
      for (let i = 0; i < 25 && !gone; i++) {
        await sleep(200);
        gone = !alive(childPid);
      }
      expect(gone).toBe(true);
    } finally {
      if (alive(childPid)) process.kill(childPid, 'SIGKILL');
      if (alive(parent.pid!)) parent.kill('SIGKILL');
    }
  }, 20_000);
});
