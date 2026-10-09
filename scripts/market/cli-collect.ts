/**
 * Запуск ИИ-сборщика загрузки конкурентов (ADR-142, дополнение 09.10.2026; `docs/market/collector.md`).
 *
 *   npm run market:collect -- [--dry-run] [--nights 14]
 *
 * Окружение: MARKET_COLLECT_URL (адрес API WETOP), MARKET_COLLECT_KEY (служебный ключ сборщика), ANTHROPIC_API_KEY,
 * необязательно MARKET_COLLECT_MODEL (по умолчанию claude-opus-5-5), MARKET_COLLECT_DELAY_MS (пауза между
 * страницами, по умолчанию 8000). Значения ключей вписывает владелец (SECURITY.md §3).
 */
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from '@playwright/test';
import { collect } from './collect';
import { claudeExtractor, collectorApi, pageReader } from './sources';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const url = process.env['MARKET_COLLECT_URL'];
  const key = process.env['MARKET_COLLECT_KEY'];
  if (!url || !key) throw new Error('Нужны MARKET_COLLECT_URL и MARKET_COLLECT_KEY');
  const nights = Math.min(Math.max(Number(arg('--nights') ?? 14), 1), 62);
  const browser = await chromium.launch();
  try {
    const reports = await collect(
      {
        api: collectorApi(url, key),
        readPage: pageReader(browser),
        extract: claudeExtractor(new Anthropic(), process.env['MARKET_COLLECT_MODEL'] || 'claude-opus-5-5'),
      },
      {
        nights,
        delayMs: Number(process.env['MARKET_COLLECT_DELAY_MS'] ?? 8000),
        dryRun: process.argv.includes('--dry-run'),
        log: (line) => console.log(line),
      },
    );
    const blocked = reports.filter((r) => r.outcome === 'blocked').length;
    console.log(`Готово: соседей ${reports.length}, записано ${reports.filter((r) => r.outcome === 'written').length}, закрыто проверкой ${blocked}`);
  } finally {
    await browser.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
