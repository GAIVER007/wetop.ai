import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/db-backup-offsite.sh: вторая копия рабочей базы вне сервера (Q-073, ADR-137, замечание ментора
 * 02.10.2026). Последняя ночная копия шифруется публичным ключом age владельца и уходит в бакет Cloudflare R2.
 *
 * Держит то, что нельзя проверить глазами: наружу уходит только шифротекст; закрытый ключ на сервер не кладётся;
 * ключи R2 не попадают в аргументы процесса и журнал; сбой виден дежурным, а не только в файле журнала.
 * Здесь `rclone` и `curl` подменены (бакет R2 это папка), `age` подменён в одних тестах и настоящий в последнем.
 */
const SCRIPT = resolve('scripts/ops/db-backup-offsite.sh');
const PLAINTEXT = 'PGDMP настоящая копия с почтами сотрудников';
const RECIPIENT = 'age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs3290gq';
const SECRET = 'r2-secret-value-do-not-print';
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const hasRealAge =
  spawnSync('age', ['--version']).status === 0 && spawnSync('age-keygen', ['--help']).status !== null;

function sandbox(opts: { realAge?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-offsite-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const backups = join(dir, 'backups');
  const bucket = join(dir, 'r2');
  mkdirSync(bin);
  mkdirSync(backups);
  mkdirSync(bucket);
  const stub = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  if (!opts.realAge)
    stub(
      'age',
      [
        'echo "age $*" >> "$AUDIT/calls"',
        // age -r <получатель> -o <выход> <вход>
        'out="$4"; in="$5"',
        'if [ "${AGE_BROKEN:-}" = 1 ]; then cp "$in" "$out"; exit 0; fi',
        'printf "age-encryption.org/v1\\n-> X25519 stub\\n" > "$out"',
        'cksum < "$in" >> "$out"',
      ].join('\n'),
    );
  stub(
    'rclone',
    [
      'echo "rclone $*" >> "$AUDIT/calls"',
      'env | grep "^RCLONE_CONFIG_WETOPR2_" | sed "s/=.*//" | sort > "$AUDIT/rclone-env"',
      'printf "%s" "${RCLONE_CONFIG_WETOPR2_SECRET_ACCESS_KEY:-}" > "$AUDIT/rclone-secret"',
      'printf "%s" "${RCLONE_CONFIG_WETOPR2_ENDPOINT:-}" > "$AUDIT/rclone-endpoint"',
      'case "$1" in',
      '  version) echo "rclone v${RCLONE_STUB_VERSION:-1.60.1}"; exit 0 ;;',
      '  copyto)',
      '    [ "${RCLONE_FAIL:-}" = 1 ] && { echo "AccessDenied: token has no write access" >&2; exit 1; }',
      '    src="$4"; dst="${5#wetopr2:}"',
      '    mkdir -p "$(dirname "$BUCKET/$dst")"; cp "$src" "$BUCKET/$dst"; exit 0 ;;',
      '  lsf)',
      '    dst="${5#wetopr2:}"',
      '    [ -n "${RCLONE_LSF_SIZE:-}" ] && { echo "$RCLONE_LSF_SIZE"; exit 0; }',
      '    [ -f "$BUCKET/$dst" ] && wc -c < "$BUCKET/$dst" | tr -d " "; exit 0 ;;',
      'esac',
      'exit 0',
    ].join('\n'),
  );
  stub(
    'curl',
    [
      'echo "curl $*" >> "$AUDIT/calls"',
      'cat > "$AUDIT/curl-stdin"',
      'exit 0',
    ].join('\n'),
  );
  const dump = (name: string, ageHours = 1) => {
    const file = join(backups, name);
    writeFileSync(file, PLAINTEXT);
    const t = new Date(Date.now() - ageHours * 3_600_000);
    utimesSync(file, t, t);
    return file;
  };
  const env0 = {
    OFFSITE_AGE_RECIPIENT: RECIPIENT,
    OFFSITE_R2_ACCOUNT_ID: 'acc123',
    OFFSITE_R2_BUCKET: 'wetop-backups',
    OFFSITE_R2_ACCESS_KEY_ID: 'r2-key-id',
    OFFSITE_R2_SECRET_ACCESS_KEY: SECRET,
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: '42',
  };
  const run = (env: Record<string, string> = {}, envFile?: string) => {
    const inherited = { ...process.env };
    for (const k of Object.keys(inherited))
      if (/^(OFFSITE_|RCLONE_|TELEGRAM_|BACKUP_|AGE_)/.test(k)) delete inherited[k];
    const file = join(dir, '.env');
    writeFileSync(file, envFile ?? '');
    const r = spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        AUDIT: dir,
        BUCKET: bucket,
        BACKUP_DIR: backups,
        ENV_FILE: file,
        ...env,
      },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const read = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');
  const stored = (name: string) => join(bucket, 'wetop-backups', 'wetop-db', `${name}.age`);
  return { run, dump, env0, read, stored, backups, dir, bin };
}

describe('вторая копия вне сервера: наружу только шифротекст (ADR-137)', () => {
  it('последняя копия шифруется ключом владельца, уходит в R2, размер сверен, статус записан', () => {
    const s = sandbox();
    s.dump('wetop-20261001T233000Z.dump', 25);
    s.dump('wetop-20261002T233000Z.dump', 1);
    const r = s.run(s.env0);
    expect(r.code, r.out).toBe(0);
    const object = s.stored('wetop-20261002T233000Z.dump');
    expect(existsSync(object)).toBe(true);
    const sent = readFileSync(object);
    expect(sent.subarray(0, 21).toString()).toBe('age-encryption.org/v1');
    expect(sent.toString('utf8')).not.toContain('PGDMP');
    expect(s.read('calls')).toContain(`age -r ${RECIPIENT}`);
    const status = JSON.parse(readFileSync(join(s.backups, 'status', 'offsite.json'), 'utf8'));
    expect(status).toMatchObject({
      source: 'wetop-20261002T233000Z.dump',
      object: 'wetop-db/wetop-20261002T233000Z.dump.age',
      bytes: sent.length,
    });
    expect(s.read('calls')).not.toContain('curl');
  });

  it('шифрование без заголовка age (сломанный инструмент): выгрузки нет, дежурным сообщение', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, AGE_BROKEN: '1' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('нет заголовка age');
    expect(s.read('calls')).not.toContain('rclone copyto');
    expect(s.read('calls')).toMatch(/curl .*text=WETOP, вторая копия базы: после шифрования нет заголовка age/);
  });

  it('закрытый ключ age в настройке: отказ до шифрования, закрытому ключу не место на сервере', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, OFFSITE_AGE_RECIPIENT: 'AGE-SECRET-KEY-1QQQQ' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('закрытый ключ age');
    expect(r.out).not.toContain('AGE-SECRET-KEY-1QQQQ');
    expect(s.read('calls')).not.toMatch(/^age /m);
  });
});

describe('вторая копия вне сервера: ключи R2 не светятся (ADR-137)', () => {
  it('ключи уходят в rclone переменными окружения, не аргументами; в журнале их нет', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run(s.env0);
    expect(r.code, r.out).toBe(0);
    expect(s.read('calls')).not.toContain(SECRET);
    expect(s.read('calls')).not.toContain('r2-key-id');
    expect(s.read('rclone-secret')).toBe(SECRET);
    expect(s.read('rclone-env').split('\n')).toEqual(
      expect.arrayContaining([
        'RCLONE_CONFIG_WETOPR2_ACCESS_KEY_ID',
        'RCLONE_CONFIG_WETOPR2_NO_CHECK_BUCKET',
        'RCLONE_CONFIG_WETOPR2_PROVIDER',
        'RCLONE_CONFIG_WETOPR2_SECRET_ACCESS_KEY',
      ]),
    );
    expect(s.read('rclone-endpoint')).toBe('https://acc123.r2.cloudflarestorage.com');
    expect(r.out).not.toContain(SECRET);
  });

  it('настройки читаются из .env клона, как у db-backup.sh', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const envFile = Object.entries(s.env0)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');
    const r = s.run({}, `${envFile}\n`);
    expect(r.code, r.out).toBe(0);
    expect(existsSync(s.stored('wetop-20261002T233000Z.dump'))).toBe(true);
  });

  it('Telegram: токен в адресе через stdin, а не аргументом', () => {
    const s = sandbox();
    const r = s.run(s.env0); // копий нет: сбой и сообщение
    expect(r.code).toBe(1);
    expect(s.read('calls')).not.toContain('bot-token');
    expect(s.read('curl-stdin')).toContain('botbot-token/sendMessage');
  });
});

describe('вторая копия вне сервера: сбой виден (ADR-137)', () => {
  it('не настроено: перечислены недостающие переменные, код 2', () => {
    const s = sandbox();
    const r = s.run({ OFFSITE_R2_BUCKET: 'b' });
    expect(r.code).toBe(2);
    for (const name of [
      'OFFSITE_AGE_RECIPIENT',
      'OFFSITE_R2_ACCESS_KEY_ID',
      'OFFSITE_R2_SECRET_ACCESS_KEY',
      'OFFSITE_R2_ACCOUNT_ID',
    ])
      expect(r.out).toContain(name);
  });

  it('ночная копия старше 26 часов: наружу не несём, сообщаем', () => {
    const s = sandbox();
    s.dump('wetop-20260930T233000Z.dump', 30);
    const r = s.run(s.env0);
    expect(r.code).toBe(1);
    expect(r.out).toContain('старше 26 ч');
    expect(s.read('calls')).not.toContain('rclone copyto');
  });

  it('R2 отказал: код 1, текст ошибки в сообщении, статус не тронут', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, RCLONE_FAIL: '1' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('AccessDenied');
    expect(existsSync(join(s.backups, 'status', 'offsite.json'))).toBe(false);
  });

  it('размер в R2 не совпал: сбой, статус не тронут', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, RCLONE_LSF_SIZE: '7' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('размер «7»');
    expect(existsSync(join(s.backups, 'status', 'offsite.json'))).toBe(false);
  });

  it('rclone старше 1.59: отказ с подсказкой (Cloudflare: иначе 401)', () => {
    const s = sandbox();
    s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, RCLONE_STUB_VERSION: '1.53.3' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('rclone 1.53 старше 1.59');
  });
});

/** Настоящий age: зашифрованное скриптом расшифровывается только закрытым ключом владельца и совпадает байт в байт */
describe.skipIf(!hasRealAge)('вторая копия вне сервера: настоящий age, круг до расшифровки', () => {
  it('копия из R2 расшифровывается закрытым ключом и совпадает с ночной', () => {
    const s = sandbox({ realAge: true });
    const keyFile = join(s.dir, 'owner-key.txt');
    const keygen = spawnSync('age-keygen', ['-o', keyFile], { encoding: 'utf8' });
    expect(keygen.status, keygen.stderr).toBe(0);
    const recipient = /public key: (age1\w+)/i.exec(keygen.stderr + keygen.stdout)?.[1];
    expect(recipient).toBeTruthy();
    const original = s.dump('wetop-20261002T233000Z.dump');
    const r = s.run({ ...s.env0, OFFSITE_AGE_RECIPIENT: recipient! });
    expect(r.code, r.out).toBe(0);
    const restored = join(s.dir, 'restored.dump');
    const dec = spawnSync(
      'age',
      ['-d', '-i', keyFile, '-o', restored, s.stored('wetop-20261002T233000Z.dump')],
      { encoding: 'utf8' },
    );
    expect(dec.status, dec.stderr).toBe(0);
    expect(readFileSync(restored)).toEqual(readFileSync(original));
  });
});
