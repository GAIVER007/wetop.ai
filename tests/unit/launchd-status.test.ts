/**
 * scripts/ops/launchd/status.sh на подставных launchctl / pgrep / curl: настоящие службы не трогаются.
 *
 * Случай 17.09.2026. `status.sh` печатал только состояние своих ярлыков, и строки «tunnel не загружен»,
 * «domain не загружен» прочитали как «туннеля нет». На деле туннель `wetop` работал: его держала
 * системная служба cloudflared от root (`cloudflared service install` 15.09), адрес снаружи отвечал 200.
 * Поднятая «на всякий случай» вторая копия того же туннеля начала перехватывать часть запросов —
 * api.wetop.ai отвечал через раз. Отсюда правило: ярлык launchd не доказывает, что туннеля нет,
 * и обратное тоже — спрашиваем сам адрес и ищем живой cloudflared, кем бы он ни был запущен.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STATUS = resolve(import.meta.dirname, '../../scripts/ops/launchd/status.sh');

interface Stubs {
  /** Ярлыки launchd, которые считаются загруженными (имена без `kz.luxx.pms.`). */
  loaded: string[];
  /** Что отвечает адрес снаружи: `200`, `404`, `000` — как `curl -w '%{http_code}'`. */
  httpCode: string;
  /** PID живых процессов cloudflared; пусто — ни одного. */
  cloudflaredPids?: number[];
}

/** Папка с подставными командами в PATH. Ни одна из них ничего не меняет в системе. */
function stubs(opts: Stubs): string {
  const dir = mkdtempSync(join(tmpdir(), 'launchd-status-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const write = (name: string, body: string) => {
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  };
  const loaded = opts.loaded.map((n) => `kz.luxx.pms.${n}`).join(' ');
  write(
    'launchctl',
    `[ "$1" = print ] || exit 1
label="\${2##*/}"
for l in ${loaded || '""'}; do
  if [ "$l" = "$label" ]; then
    printf '\\tstate = running\\n\\tpid = 4242\\n\\truns = 7\\n\\tlast exit code = 0\\n'
    exit 0
  fi
done
exit 113`,
  );
  const pids = (opts.cloudflaredPids ?? []).join('\n');
  write('pgrep', pids ? `printf '%s\\n' ${(opts.cloudflaredPids ?? []).join(' ')}` : 'exit 1');
  write('curl', `printf '%s' '${opts.httpCode}'`);
  return bin;
}

function run(opts: Stubs): string {
  const bin = stubs(opts);
  const res = spawnSync('bash', [STATUS], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}` },
  });
  expect(res.status, res.stderr).toBe(0);
  return res.stdout;
}

describe('status.sh: состояние туннеля', () => {
  it('ни tunnel, ни domain не загружены, но адрес отвечает — говорит, что туннель работает', () => {
    const out = run({ loaded: ['api', 'web'], httpCode: '200', cloudflaredPids: [431] });
    expect(out).toContain('tunnel  не загружен');
    expect(out).toMatch(/туннель.*200/s);
    expect(out).toContain('вторую копию не поднимать');
    expect(out).toContain('431');
  });

  it('адрес молчит и задача не загружена — говорит, что туннеля нет', () => {
    const out = run({ loaded: ['api', 'web'], httpCode: '000' });
    expect(out).toMatch(/туннель.*не отвечает/s);
    expect(out).not.toContain('вторую копию не поднимать');
  });

  it('задача загружена и адрес отвечает — обычная строка без предупреждения', () => {
    const out = run({ loaded: ['api', 'web', 'domain'], httpCode: '200', cloudflaredPids: [777] });
    expect(out).toContain('domain  running');
    expect(out).toMatch(/туннель.*200/s);
    expect(out).not.toContain('вторую копию не поднимать');
  });

  it('задача загружена, а снаружи молчит — называет это расхождением', () => {
    const out = run({ loaded: ['api', 'web', 'domain'], httpCode: '000', cloudflaredPids: [777] });
    expect(out).toMatch(/туннель.*не отвечает/s);
    expect(out).toContain('задача загружена');
  });
});
