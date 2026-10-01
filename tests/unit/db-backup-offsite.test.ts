import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/db-backup-offsite.sh: вторая копия базы вне сервера, зашифрованная (Q-073; разбор 01.10.2026,
 * reports/order-2026-10-01, пункт 2). openssl здесь настоящий, хранилище подставное: `curl` в PATH записывает
 * аргументы и stdin, «принимает» загрузку и на HEAD отвечает размером принятого файла.
 */
const SCRIPT = resolve('scripts/ops/db-backup-offsite.sh');
const SECRET = 'r2-secret-value';
const PASS = 'passphrase-of-sixteen-plus';
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function sandbox(opts: { settings?: string | null; dump?: Buffer | null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-offsite-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const backups = join(dir, 'backups');
  mkdirSync(bin);
  mkdirSync(backups);
  const dump =
    opts.dump === undefined ? Buffer.from('PGDMP\u0000фиктивная копия базы, не секрет\n'.repeat(40)) : opts.dump;
  if (dump) writeFileSync(join(backups, 'wetop-20261001T233000Z.dump'), dump);
  // Подставной curl: аргументы в файл, настройки из stdin отдельно, на HEAD (-fsSI) content-length принятого файла
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
if [ "\${1:-}" = "--help" ]; then echo " --aws-sigv4 <provider1[:prvdr2[:reg[:srv]]]> Use AWS V4 signature authentication"; exit 0; fi
printf '%s\\n' "$*" >> "$AUDIT_DIR/curl-args"
if [[ " $* " == *" --config - "* ]]; then cat >> "$AUDIT_DIR/curl-stdin"; fi
for ((i = 1; i <= $#; i++)); do
  if [ "\${!i}" = "-T" ]; then j=$((i + 1)); cp "\${!j}" "$AUDIT_DIR/uploaded"; fi
done
if [[ " $* " == *" -fsSI "* ]]; then
  if [ -n "\${FAKE_HEAD_SIZE:-}" ]; then echo "content-length: $FAKE_HEAD_SIZE"; else printf 'HTTP/1.1 200 OK\\r\\ncontent-length: %s\\r\\n' "$(wc -c < "$AUDIT_DIR/uploaded")"; fi
fi
exit 0
`,
    { mode: 0o755 },
  );
  const settingsFile = join(dir, 'settings');
  if (opts.settings !== null)
    writeFileSync(
      settingsFile,
      opts.settings ??
        [
          'BACKUP_OFFSITE_URL=https://account.r2.cloudflarestorage.com/wetop-backups/',
          'BACKUP_OFFSITE_KEY_ID=key-id',
          `BACKUP_OFFSITE_SECRET="${SECRET}"`,
          `BACKUP_OFFSITE_PASSPHRASE='${PASS}'`,
          '',
        ].join('\n'),
    );
  const run = (extra: Record<string, string> = {}, args: string[] = []) => {
    const inherited = { ...process.env };
    for (const k of Object.keys(inherited)) if (k.startsWith('BACKUP_')) delete inherited[k];
    const r = spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        ENV_FILE: settingsFile,
        BACKUP_DIR: backups,
        AUDIT_DIR: dir,
        ...extra,
      },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const audit = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');
  return { dir, backups, run, audit, dump };
}

const decrypt = (file: string, pass: string) =>
  spawnSync(
    'openssl',
    ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-md', 'sha256', '-pass', 'env:P', '-in', file],
    { env: { ...process.env, P: pass } },
  );

describe('scripts/ops/db-backup-offsite.sh', () => {
  it('шифрует последнюю копию, грузит с подписью v4, сверяет размер и пишет статус без ключей', () => {
    const s = sandbox();
    const r = s.run();
    expect(r.out).toContain('в хранилище');
    expect(r.code).toBe(0);
    const uploaded = join(s.dir, 'uploaded');
    expect(existsSync(uploaded)).toBe(true);
    // Не исходник: зашифрованный файл не начинается с заголовка pg_dump и расшифровывается только паролем
    expect(readFileSync(uploaded).subarray(0, 5).toString()).not.toBe('PGDMP');
    expect(decrypt(uploaded, PASS).stdout.equals(s.dump!)).toBe(true);
    expect(decrypt(uploaded, 'wrong-passphrase-value').status).not.toBe(0);
    const args = s.audit('curl-args');
    expect(args).toContain('--aws-sigv4 aws:amz:auto:s3');
    expect(args).toContain('https://account.r2.cloudflarestorage.com/wetop-backups/wetop-20261001T233000Z.dump.enc');
    // Секрет и пароль не в аргументах процессов, ключ ведра только в настройках из stdin
    expect(args).not.toContain(SECRET);
    expect(args).not.toContain(PASS);
    expect(s.audit('curl-stdin')).toContain(`user = "key-id:${SECRET}"`);
    expect(r.out).not.toContain(SECRET);
    expect(r.out).not.toContain(PASS);
    const status = JSON.parse(readFileSync(join(s.backups, 'status', 'offsite.json'), 'utf8'));
    expect(status).toMatchObject({
      name: 'wetop-20261001T233000Z.dump.enc',
      host: 'account.r2.cloudflarestorage.com',
    });
    expect(status.bytes).toBeGreaterThan(0);
    expect(JSON.stringify(status)).not.toContain(SECRET);
  });

  it('размер в хранилище не сошёлся: отказ, статус не пишется', () => {
    const s = sandbox();
    const r = s.run({ FAKE_HEAD_SIZE: '7' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('размер в хранилище');
    expect(existsSync(join(s.backups, 'status', 'offsite.json'))).toBe(false);
  });

  it('без пароля, с коротким паролем или без адреса ведра наружу ничего не уходит', () => {
    const noPass = sandbox({
      settings: 'BACKUP_OFFSITE_URL=https://x.example/b\nBACKUP_OFFSITE_KEY_ID=k\nBACKUP_OFFSITE_SECRET=s\n',
    });
    expect(noPass.run().code).toBe(2);
    expect(noPass.audit('curl-args')).toBe('');
    const short = sandbox();
    expect(short.run({ BACKUP_OFFSITE_PASSPHRASE: 'short' }).out).toContain('короче 16');
    expect(short.audit('curl-args')).toBe('');
    const noUrl = sandbox({
      settings: `BACKUP_OFFSITE_KEY_ID=k\nBACKUP_OFFSITE_SECRET=s\nBACKUP_OFFSITE_PASSPHRASE=${PASS}\n`,
    });
    expect(noUrl.run().code).toBe(2);
    expect(noUrl.audit('curl-args')).toBe('');
  });

  it('копии нет: отказ словами; регион подписи берётся из настроек', () => {
    const none = sandbox({ dump: null });
    const r = none.run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('нет копии');
    const aws = sandbox();
    expect(aws.run({ BACKUP_OFFSITE_REGION: 'eu-central-1' }).code).toBe(0);
    expect(aws.audit('curl-args')).toContain('aws:amz:eu-central-1:s3');
  });
});
