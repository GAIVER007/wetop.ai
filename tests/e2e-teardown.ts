/**
 * После каждого прогона e2e отменяем брони автотестов: они занимают настоящие ячейки в общей базе
 * и вытесняют импорт из Legacy («ячейка N занята 20260910-XXXXXX» в логе синхронизации).
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
    // execFileSync кладёт stderr и сигнал в объект ошибки, в message их нет — печатаем, иначе причина невидима
    // (12.09.2026 после полного прогона уборка упала молча, ручной запуск сразу после прошёл)
    const err = e as Error & { stderr?: string; signal?: string | null; status?: number | null };
    const detail = [
      err.stderr?.trim(),
      err.signal ? `сигнал ${err.signal}` : '',
      err.status != null ? `код ${err.status}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    process.stdout.write(
      `[уборка e2e] не выполнена: ${err.message}${detail ? ` — ${detail}` : ''}\n`,
    );
  }
}
