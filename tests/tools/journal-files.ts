import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENTRY_DIR, JOURNAL_FILE, joinJournal, type RunRecord } from './journal';

/** Запись прогона: свой файл на прогон, общих файлов не трогает (TESTING.md). Возвращает путь записи */
export function writeRunRecord(root: string, record: RunRecord): string {
  const path = `${ENTRY_DIR}/${record.id}.json`;
  mkdirSync(resolve(root, ENTRY_DIR), { recursive: true });
  writeFileSync(resolve(root, path), `${JSON.stringify(record)}\n`);
  return path;
}

/** Весь журнал текстом JSONL: архив `journal.jsonl` и записи `entries/*.json` */
export function readJournalText(root: string): string {
  const archive = resolve(root, JOURNAL_FILE);
  const dir = resolve(root, ENTRY_DIR);
  const entries = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    : [];
  return joinJournal(existsSync(archive) ? readFileSync(archive, 'utf8') : '', entries);
}
