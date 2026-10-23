import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Файлы выпуска голосового воркера (docs/ops/voice-release.md): образ, compose и шаги владельца. Сторож без Docker:
 * проверяет, что в образе нет секретов и root, что очередь и журнал лежат на томе, а каждая переменная окружения
 * воркера названа в образце `env.example` и в шагах владельца (AGENTS.md §7, `SECURITY.md`).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const VOICE = resolve(ROOT, 'apps/ai-seller/voice');
const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
/** Без строк-комментариев: в комментариях объяснения вроде «тяжёлый стек (torch) не нужен» допустимы */
const code = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

describe('образ воркера', () => {
  const docker = code(read(resolve(VOICE, 'Dockerfile')));
  it('есть, Python 3.12+, не root, секретов и .env в образе нет', () => {
    expect(docker).toMatch(/^FROM python:3\.(1[2-9])/m);
    expect(docker).toMatch(/useradd[^\n]*app/);
    expect(docker).toMatch(/^USER app/m);
    expect(docker).not.toMatch(/\.env(?!\.example)\b|COPY[^\n]*secrets/i);
    expect(docker).not.toMatch(/(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/);
  });
  it('ставит зависимости воркера, а не тяжёлый стек продавца, и запускает воркер модулем', () => {
    expect(docker).toContain('voice/requirements.txt');
    expect(docker).not.toMatch(/torch|sentence_transformers/);
    expect(docker).toMatch(/CMD \["python", "-m", "voice\.worker"\]/);
  });
});

describe('исключения сборки образа', () => {
  const ignore = read(resolve(VOICE, 'Dockerfile.dockerignore'));
  it('.env воркера в образ не попадает (корневой .dockerignore не видит voice/.env)', () => {
    expect(ignore).toMatch(/^\*\*\/\.env$/m);
    expect(ignore).toMatch(/^\*\*\/\.env\.\*$/m);
    expect(ignore).toMatch(/^voice\/tests$/m);
  });
});

describe('корневой .dockerignore контекста apps/ai-seller', () => {
  const rootIgnore = read(resolve(ROOT, 'apps/ai-seller/.dockerignore'));
  it('.env исключён на любой глубине: старый Docker без BuildKit не читает Dockerfile.dockerignore (ревью M1)', () => {
    expect(rootIgnore).toMatch(/^\*\*\/\.env$/m);
    expect(rootIgnore).toMatch(/^\*\*\/\.env\.\*$/m);
  });
});

describe('compose воркера', () => {
  const compose = code(read(resolve(VOICE, 'compose.yml')));
  it('есть, ключи только из env_file, очередь и журнал на томе, перезапуск, журнал не только в контейнере', () => {
    expect(compose).toContain('env_file');
    expect(compose).toMatch(/voice-data:\/data|\.\/data:\/data/);
    expect(compose).toContain('restart: unless-stopped');
    expect(compose).toMatch(/max-size/);
    expect(compose).not.toMatch(/(API_KEY|SECRET|TOKEN|PASSWORD|INGEST_KEY|BOOK_KEY)\s*[:=]\s*[^\s$]/);
  });
  it('очередь догоняется отдельной командой voice.flush', () => {
    expect(compose).toContain('voice.flush');
  });
  it('порт воркера наружу не публикуется', () => {
    expect(compose).not.toMatch(/ports:/);
  });
});

describe('образец окружения и шаги владельца', () => {
  const env = read(resolve(VOICE, 'env.example'));
  const names = [...env.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!);
  const runbook = read(resolve(ROOT, 'docs/ops/voice-release.md'));
  it('в образце нет значений секретов', () => {
    for (const secret of ['VIDEOSDK_AUTH_TOKEN', 'GOOGLE_API_KEY', 'VOICE_WETOP_SERVICE_KEY', 'VOICE_INGEST_KEY', 'VOICE_BOOK_KEY'])
      expect(env, secret).toMatch(new RegExp(`^${secret}=\\s*$`, 'm'));
  });
  it('каждая переменная образца названа в шагах владельца', () => {
    expect(runbook).not.toBe('');
    for (const name of names) expect(runbook, name).toContain(name);
  });
  it('шаги владельца: миграция, ключ, правило маршрутизации, пробный звонок, откат, юридические условия', () => {
    for (const must of [
      '20261022000145_voice_calls',
      '20261023000147_voice_booking',
      'VOICE_BOOK_KEY',
      'openssl rand',
      '"organization_id"',
      '"agent_id"',
      'sip.videosdk.live',
      'Transfer to PSTN',
      'Q-VOICE-1',
      'Q-VOICE-2',
      'python -m voice.flush',
      'Откат',
    ])
      expect(runbook, must).toContain(must);
  });
  it('шаги: адрес API достижим из контейнера, localhost не годится; cron с -T; нужен BuildKit', () => {
    expect(runbook).toMatch(/localhost[^\n]*не (годится|работает)|не (годится|работает)[^\n]*localhost/);
    expect(runbook).toContain('docker compose run --rm -T voice-flush');
    expect(runbook).toContain('BuildKit');
    expect(runbook).toContain('docker compose run --rm voice-worker python -c');
  });
  it('в шагах нет настоящих ключей и нет длинного тире', () => {
    expect(runbook).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}/);
    expect(runbook).not.toContain(String.fromCharCode(0x2014));
  });
});
