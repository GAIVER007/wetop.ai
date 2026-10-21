import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { parseJournal, JOURNAL_FILE, SUITES, assess } from '../../tests/tools/journal';
import { readJournalText, writeRunRecord } from '../../tests/tools/journal-files';
const start = performance.now();
const before = parseJournal(readFileSync(JOURNAL_FILE, 'utf8'));
const parsed = performance.now();
const dir = mkdtempSync(join(tmpdir(), 'ui31-journal-profile-'));
try {
  for (const row of before) writeRunRecord(dir, row);
  const written = performance.now();
  const after = parseJournal(readJournalText(dir));
  const read = performance.now();
  const now = new Date(before.at(-1)!.startedAt);
  const verdicts = Object.values(SUITES).every((suite) => {
    const fingerprint = [...before].reverse().find((r) => r.suite === suite.name)?.fingerprint || 'none';
    return isDeepStrictEqual(assess(suite, before, { fingerprint, now }), assess(suite, after, { fingerprint, now }));
  });
  const result = { records: before.length, parseMs: parsed - start, writeMs: written - parsed, readParseMs: read - written, elapsedMs: performance.now() - start, recordsEqual: isDeepStrictEqual(before, after), verdictsEqual: verdicts, note: 'Timing diagnostic, no test timeout changed; equality checks use Node deep comparison rather than Vitest' };
  writeFileSync('reports/ui3-1-audit-2026-10-11/journal-profile.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
