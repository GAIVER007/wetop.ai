/**
 * После каждого прогона e2e отменяем брони автотестов: они занимают настоящие ячейки в общей базе
 * и вытесняют импорт из Exely («ячейка N занята 20260910-XXXXXX» в логе синхронизации).
 * Ошибку уборки не считаем провалом прогона — печатаем, чтобы было видно.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalTeardown(): void {
  const script = resolve(import.meta.dirname, '../scripts/reconciliation/src/cli-e2e-cleanup.ts');
  try {
    const out = execFileSync('npx', ['tsx', script], { encoding: 'utf-8' });
    process.stdout.write(`[уборка e2e] ${out.trim()}\n`);
  } catch (e) {
    process.stdout.write(`[уборка e2e] не выполнена: ${(e as Error).message}\n`);
  }
}
