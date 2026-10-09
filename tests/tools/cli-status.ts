/**
 * Что уже доказано тестами на текущем коде (TESTING.md). По каждому набору — последний полный прогон из
 * журнала, изменился ли с тех пор код набора и нужно ли гонять снова. Сам ничего не запускает.
 *
 * Запуск: npm run test:status [-- <набор>]
 */
import { ROOT, changedSince, codeFingerprint, currentBranch, headCommit } from './git-state';
import {
  SUITES,
  almatyTime,
  assess,
  durationText,
  outcomeText,
  parseJournal,
  type AssessState,
  type SuiteName,
} from './journal';
import { readJournalText } from './journal-files';

const VERDICT: Record<AssessState, string> = {
  never: '⚪ полного прогона в журнале нет — гонять',
  proven: '✅ доказано на этом коде — повторять не нужно',
  changed: '🟡 код набора изменился после прогона — гонять',
  expired: '🟡 код тот же, но прогону больше суток (живая база, даты от «сегодня») — гонять',
  failing: '🔴 падает на этом коде — сначала чинить, потом гонять',
  'changed-after-failure': '🟡 падал, код с тех пор менялся — гонять',
};

function main(): void {
  const filter = process.argv[2];
  if (filter && !Object.hasOwn(SUITES, filter)) {
    console.error(`Нет набора «${filter}». Есть: ${Object.keys(SUITES).join(', ')}`);
    process.exit(2);
  }
  const runs = parseJournal(readJournalText(ROOT));
  const now = new Date();
  console.log(
    `Код ${headCommit().slice(0, 7)} (${currentBranch()}) · записей в журнале: ${runs.length} · ${almatyTime(now.toISOString())} Алматы\n`,
  );

  const todo: string[] = [];
  const suites = filter ? [SUITES[filter as SuiteName]] : Object.values(SUITES);
  for (const suite of suites) {
    const a = assess(suite, runs, { fingerprint: codeFingerprint(suite.watch), now });
    const r = a.run;
    console.log(`${suite.name} — ${suite.title}`);
    if (r) {
      const dirty = r.dirty.length ? ` +${r.dirty.length}` : '';
      console.log(
        `  последний полный прогон: ${almatyTime(r.startedAt)} · ${outcomeText(r)} · ${durationText(r.durationMs)} · коммит ${r.commit.slice(0, 7)}${dirty} · ${r.machine}`,
      );
      console.log(`  лог: ${r.log}`);
    }
    console.log(`  ${VERDICT[a.state]}`);

    if (r && (a.state === 'changed' || a.state === 'changed-after-failure')) {
      const changed = changedSince(r.commit, suite.watch);
      if (changed === null) {
        console.log(
          `  коммита ${r.commit.slice(0, 7)} нет в этой копии — прогон записан на другой машине`,
        );
      } else if (changed.length) {
        const shown = changed.slice(0, 5).join(', ');
        console.log(
          `  изменено файлов: ${changed.length} — ${shown}${changed.length > 5 ? ' …' : ''}`,
        );
      } else if (r.codeChangedDuringRun) {
        console.log('  код менялся прямо во время прогона');
      } else {
        console.log('  отличие — в незакоммиченных правках, которые были на момент прогона');
      }
    }
    if (r && (a.state === 'failing' || a.state === 'changed-after-failure')) {
      for (const f of r.failures.slice(0, 5)) {
        console.log(`  ✗ ${f.name}${f.file ? ` — ${f.file}` : ''}`);
        const first = f.message.split('\n')[0];
        if (first) console.log(`    ${first}`);
      }
    }
    for (const p of a.partialsAfter.slice(-3)) {
      console.log(
        `  частично после него: ${p.args.join(' ')} · ${outcomeText(p)} · ${almatyTime(p.startedAt)}`,
      );
    }
    if (a.state !== 'proven') todo.push(`npm run test:record -- ${suite.name}`);
    console.log('');
  }

  if (todo.length) console.log(`Гонять:\n${todo.map((c) => `  ${c}`).join('\n')}\n`);
  console.log('История прогонов таблицей: npm run test:journal');
}

main();
