import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Дежурный агент на сервере (`scripts/ops/guard/run.sh`), разбор 01.10.2026 (reports/order-2026-10-01, пункт 6).
 *
 * До 01.10 скрипт принимал токен подписки `CLAUDE_CODE_OAUTH_TOKEN` наравне с ключом API: ночной разбор делил лимит
 * с дневной работой владельца. Теперь он идёт только на отдельном ключе `ANTHROPIC_API_KEY` (свой счёт, свой предел
 * расхода в консоли Anthropic), а токен подписки в `.env` агента считается ошибкой настройки, а не вторым вариантом.
 * Второй предохранитель: не больше `GUARD_RUNS_PER_DAY` вызовов модели в сутки, чтобы сбой сторожа, который
 * каждый час «находит» ту же неисправность, не превращался в счёт.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const RUN = read('scripts/ops/guard/run.sh');
const README = read('scripts/ops/guard/README.md');
const COMPOSE = read('scripts/ops/guard/compose.yml');

/** Только то, что исполняется: в пояснениях те же слова стоят намеренно. */
const code = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

describe('дежурный агент: отдельный ключ и суточный предел', () => {
  it('без ANTHROPIC_API_KEY не стартует', () => {
    expect(code(RUN)).toMatch(/\$\{ANTHROPIC_API_KEY:\?/);
  });

  it('токен подписки в .env агента: отказ, а не второй вариант', () => {
    const run = code(RUN);
    expect(run).toContain('CLAUDE_CODE_OAUTH_TOKEN');
    // Токен в .env, остановка до первого вызова модели, а не тихий запуск на подписке
    expect(run).toMatch(/-n "\$\{CLAUDE_CODE_OAUTH_TOKEN:-\}"[\s\S]{0,400}exit 1/);
    expect(run).not.toMatch(/-z "\$\{CLAUDE_CODE_OAUTH_TOKEN:-\}" \] && \[ -z "\$\{ANTHROPIC_API_KEY:-\}"/);
  });

  it('вызовов модели в сутки не больше GUARD_RUNS_PER_DAY, и предел считается до вызова claude', () => {
    const run = code(RUN);
    expect(run).toMatch(/GUARD_RUNS_PER_DAY/);
    expect(run.indexOf('GUARD_RUNS_PER_DAY')).toBeLessThan(run.indexOf('claude -p'));
  });

  it('инструкция и compose говорят про ключ API, а не про токен подписки', () => {
    expect(code(COMPOSE)).not.toContain('CLAUDE_CODE_OAUTH_TOKEN');
    expect(README).toContain('ANTHROPIC_API_KEY');
    expect(README).toContain('GUARD_RUNS_PER_DAY');
    expect(README).not.toMatch(/claude setup-token/);
  });
});
