// Итог набора по JSON-отчёту Playwright: успех только если выполнено не меньше заданного числа тестов
// и нет упавших, пропущенных и прошедших со второй попытки. Код выхода Playwright этого не гарантирует:
// пустой отбор, `test.skip` и повторы выглядят зелёными.
//   node scripts/ci/check-playwright-report.mjs <report.json> <минимум тестов>
import console from 'node:console';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const [file, min] = process.argv.slice(2);
const minimum = Number(min);
if (!file || !Number.isInteger(minimum) || minimum < 1) {
  console.error('usage: check-playwright-report.mjs <report.json> <минимум тестов>');
  process.exit(2);
}
let stats;
try {
  stats = JSON.parse(readFileSync(file, 'utf8')).stats;
} catch (error) {
  console.error(`нет отчёта ${file}: ${error.message}`);
  process.exit(1);
}
const { expected = 0, unexpected = 0, skipped = 0, flaky = 0 } = stats ?? {};
console.log(`выполнено ${expected}, упало ${unexpected}, пропущено ${skipped}, со второй попытки ${flaky}`);
const problems = [
  expected < minimum && `выполнено ${expected}, нужно не меньше ${minimum}`,
  unexpected > 0 && `упало ${unexpected}`,
  skipped > 0 && `пропущено ${skipped}`,
  flaky > 0 && `прошли со второй попытки ${flaky}`,
].filter(Boolean);
if (problems.length) {
  console.error(`набор не принят: ${problems.join('; ')}`);
  process.exit(1);
}
