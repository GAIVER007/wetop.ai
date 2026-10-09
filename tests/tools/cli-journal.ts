/**
 * История прогонов таблицей (TESTING.md): архив `journal.jsonl` и записи `tests/runs/entries/` одной Markdown-таблицей
 * в вывод. Файлом не хранится и не коммитится: общий файл, в который все дописывают, конфликтовал при каждом слиянии.
 *
 * Запуск: npm run test:journal [-- <набор>] [> файл.md]
 */
import { ROOT } from './git-state';
import { JOURNAL_MD_HEADER, journalRow, parseJournal } from './journal';
import { readJournalText } from './journal-files';

const filter = process.argv[2];
const runs = parseJournal(readJournalText(ROOT)).filter((r) => !filter || r.suite === filter);
process.stdout.write(JOURNAL_MD_HEADER + runs.map((r) => `${journalRow(r)}\n`).join(''));
