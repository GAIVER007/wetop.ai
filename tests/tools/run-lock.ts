/**
 * Замок прогона: два набора, которым нужна общая dev-БД, не идут в одном дереве одновременно.
 *
 * 15.09.2026 в дереве шли сразу два прогона e2e — свой в один воркер и чужой в два. Playwright чистит
 * `test-results/` в начале прогона, поэтому второй снёс трассы живого первого (`browserContext.close:
 * ENOENT … .playwright-artifacts-N/traces/…`), а его воркеры заняли койку в чужом окне дат. Три спека
 * упали не по коду, разбор занял полчаса. Окна дат спеков от этого не спасают: сторож
 * `tests/unit/e2e-windows.test.ts` сверяет спеки между собой, а не два прогона друг с другом.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LockHolder {
  pid: number;
  startedAt: string;
  suite: string;
}
export type RunLock =
  | { ok: true; release: () => void }
  | { ok: false; holder: LockHolder };

/** Процесс жив? Сигнал 0 ничего не делает, только проверяет право послать сигнал. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM — процесс есть, но чужой: значит, жив
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readHolder(file: string): LockHolder | null {
  try {
    const h = JSON.parse(readFileSync(file, 'utf8')) as Partial<LockHolder>;
    return typeof h.pid === 'number' && typeof h.startedAt === 'string'
      ? { pid: h.pid, startedAt: h.startedAt, suite: String(h.suite ?? '') }
      : null;
  } catch {
    return null; // битый или недописанный файл — как будто замка нет
  }
}

/**
 * Взять замок набора. Занят живым процессом — отказ с тем, кто держит; остался от убитого прогона —
 * перехватываем, иначе упавший прогон заблокировал бы набор навсегда.
 */
export function acquireRunLock(dir: string, suite: string): RunLock {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${suite}.lock`);
  if (existsSync(file)) {
    const holder = readHolder(file);
    if (holder && alive(holder.pid)) return { ok: false, holder };
  }
  const mine: LockHolder = { pid: process.pid, startedAt: new Date().toISOString(), suite };
  writeFileSync(file, JSON.stringify(mine));
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      // Снимаем только свой замок: чужой мог перехватить его, пока наш прогон доживал
      if (readHolder(file)?.pid === process.pid) rmSync(file, { force: true });
    },
  };
}
