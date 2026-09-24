import { readFileSync } from 'node:fs';
import { parseBackupStatus } from '@pms/domain';
import type { BackupSignal } from './guard.ports';

/**
 * Статус ночной копии с диска (ADR-077). В контейнере это `/backup-status/last.json`: папка `/root/backups/status`
 * хоста, смонтированная только на чтение (deploy/compose.yml). Ошибка чтения — не исключение, а исход: сторож называет
 * её в заголовке неисправности (EACCES — права, EISDIR — не тот путь).
 */
export function readBackupStatus(path: string): BackupSignal {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === 'ENOENT'
      ? { state: 'missing' }
      : { state: 'unreadable', error: code ?? 'ошибка чтения' };
  }
  const status = parseBackupStatus(text);
  return status ? { state: 'ok', status } : { state: 'unreadable', error: 'не статус копии' };
}
