/**
 * `install.sh domain` на подставных launchctl / curl / cloudflared: настоящие службы не трогаются.
 *
 * Два случая 17.09.2026, когда постоянный туннель ломали попыткой его починить.
 *  1) Образец конфига скопировали, а заполнить забыли: cloudflared падал на «error parsing tunnel ID:
 *     <TUNNEL-ID>» восемь раз подряд, launchd поднимал его каждые 15 с, а `status.sh` бодро писал
 *     «domain загружен».
 *  2) Тот же туннель уже держал другой cloudflared (системная служба от root). Вторая копия первую не
 *     заменяет — Cloudflare делит запросы между ними, и api.wetop.ai начал отвечать через раз.
 *
 * Обе проверки идут до записи plist; `plutil` и `sleep` тоже подставные, поэтому macOS не нужен.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INSTALL = resolve(import.meta.dirname, '../../scripts/ops/launchd/install.sh');
const EXAMPLE = resolve(import.meta.dirname, '../../scripts/ops/cloudflared-wetop.example.yml');

/** Заполненный конфиг: тот же образец, но без заглушек `<…>`. */
const FILLED = `tunnel: 91ba3ca8-633e-400c-9c9e-abf5044fd681
credentials-file: /tmp/91ba3ca8-633e-400c-9c9e-abf5044fd681.json

ingress:
  - hostname: app.wetop.ai
    service: http://127.0.0.1:3000
  - service: http_status:404
`;

interface Case {
  /** Содержимое ~/.cloudflared/wetop.yml; по умолчанию — нетронутый образец из репозитория. */
  config?: string;
  /** Что отвечает api.wetop.ai снаружи (`curl -w '%{http_code}'`). */
  httpCode: string;
  /** Осознанный обход проверки «туннель уже держат». */
  allowSecond?: boolean;
}

function run(opts: Case): string {
  const dir = mkdtempSync(join(tmpdir(), 'launchd-domain-'));
  const home = join(dir, 'home');
  const bin = join(dir, 'bin');
  mkdirSync(join(home, '.cloudflared'), { recursive: true });
  mkdirSync(join(home, '.local', 'bin'), { recursive: true });
  mkdirSync(bin);
  const script = (file: string, body: string) => {
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  };
  writeFileSync(join(home, '.cloudflared', 'wetop.yml'), opts.config ?? readFileSync(EXAMPLE, 'utf8'));
  // cloudflared ищется по PATH_ENV скрипта, а он начинается с $HOME/.local/bin
  script(join(home, '.local', 'bin', 'cloudflared'), 'exit 0');
  script(join(bin, 'launchctl'), 'exit 113'); // ни одна задача не загружена
  script(join(bin, 'curl'), `printf '%s' '${opts.httpCode}'`);
  script(join(bin, 'plutil'), 'exit 0');
  script(join(bin, 'sleep'), 'exit 0'); // ожидания launchd в тесте не нужны
  const res = spawnSync('bash', [INSTALL, 'domain'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env['PATH'] ?? ''}`,
      ...(opts.allowSecond ? { ALLOW_SECOND_TUNNEL: '1' } : {}),
    },
  });
  return res.stdout + res.stderr;
}

describe('install.sh domain: две проверки до установки', () => {
  it('не ставит службу по нетронутому образцу с заглушками', () => {
    const out = run({ httpCode: '000' });
    expect(out).toContain('остались заглушки');
    expect(out).not.toContain('загружен, журнал');
  });

  it('не поднимает вторую копию, когда туннель уже держит другой cloudflared', () => {
    const out = run({ config: FILLED, httpCode: '200' });
    expect(out).toContain('туннель уже держит другой cloudflared');
    expect(out).toContain('ALLOW_SECOND_TUNNEL=1');
    expect(out).not.toContain('загружен, журнал');
  });

  it('с заполненным конфигом и молчащим адресом обе проверки пропускают', () => {
    const out = run({ config: FILLED, httpCode: '000' });
    expect(out).not.toContain('остались заглушки');
    expect(out).not.toContain('туннель уже держит другой cloudflared');
  });

  it('ALLOW_SECOND_TUNNEL=1 — осознанный обход', () => {
    const out = run({ config: FILLED, httpCode: '200', allowSecond: true });
    expect(out).not.toContain('туннель уже держит другой cloudflared');
  });
});
