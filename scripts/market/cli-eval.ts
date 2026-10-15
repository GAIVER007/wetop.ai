/**
 * Какая модель верно читает страницы площадок (ADR-142, дополнение 09.10.2026). Прогоняет разбор по записанным страницам
 * `tests/fixtures/market-pages/` и сверяет с ручной разметкой `labels.json`; ответы моделей записывает в `recorded/`,
 * по ним регрессионный тест проверяет разбор без сети.
 *
 *   ANTHROPIC_API_KEY=… npm run market:eval [-- claude-haiku-5-5 claude-sonnet-5-5 claude-opus-5-5]
 *
 * Каждый запуск тратит деньги: по одному вызову модели на страницу и модель.
 */
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { claudeExtractor } from './sources';

const DIR = 'tests/fixtures/market-pages';
/** Цена за миллион токенов, вход и выход (справочник claude-api, 06.10.2026) */
const PRICE: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};
interface Label {
  file: string;
  night: string;
  name: string;
  expected: { status: string; roomsLeft: number | null };
}

const models = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PRICE);
const labels = JSON.parse(readFileSync(`${DIR}/labels.json`, 'utf8')) as Label[];
const client = new Anthropic();
mkdirSync(`${DIR}/recorded`, { recursive: true });
console.log('| Модель | Совпало | Стоимость прогона |\n|---|---|---|');
for (const model of models) {
  const recorded: Record<string, string | null> = {};
  let inTok = 0;
  let outTok = 0;
  let ok = 0;
  for (const l of labels) {
    let raw: string | null = null;
    const read = claudeExtractor(client, model, (r) => {
      raw = r.raw;
      inTok += r.inputTokens;
      outTok += r.outputTokens;
    });
    const got = await read(readFileSync(`${DIR}/${l.file}`, 'utf8'), { name: l.name, night: l.night });
    recorded[l.file] = raw;
    const match = got.status === l.expected.status && got.roomsLeft === l.expected.roomsLeft;
    if (match) ok += 1;
    else console.error(`  ${model} ${l.file}: ждали ${JSON.stringify(l.expected)}, получили ${JSON.stringify(got)}`);
  }
  writeFileSync(`${DIR}/recorded/${model}.json`, `${JSON.stringify(recorded, null, 2)}\n`);
  const [pi, po] = PRICE[model] ?? [NaN, NaN];
  const cost = (inTok * pi + outTok * po) / 1e6;
  console.log(`| ${model} | ${ok} из ${labels.length} | $${cost.toFixed(4)} (вход ${inTok}, выход ${outTok}) |`);
}
