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
  /** Набор, который держит замок (не имя замка: наборы на общей базе делят один) */
  suite: string;
}

/** Набор, которому не нужны ни база, ни поднятые службы: замок на дерево ему ни к чему */
const SELF_CONTAINED = 'ничего внешнего';
/**
 * Один замок на всех, кому нужна dev-БД. Раньше замок брался на имя набора, и `e2e` с `integration`
 * спокойно шли одновременно — а база у них одна, и Session pooler Supabase один на проект (15 клиентов):
 * 15.09.2026 ночной e2e растянулся на 6 часов и упал десятью таймаутами базы.
 */
export const SHARED_DB_LOCK = 'dev-database';

export function lockNameFor(needs: string): string | null {
  return needs === SELF_CONTAINED ? null : SHARED_DB_LOCK;
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
export function acquireRunLock(dir: string, name: string, owner = name): RunLock {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.lock`);
  if (existsSync(file)) {
    const holder = readHolder(file);
    if (holder && alive(holder.pid)) return { ok: false, holder };
  }
  const mine: LockHolder = { pid: process.pid, startedAt: new Date().toISOString(), suite: owner };
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
