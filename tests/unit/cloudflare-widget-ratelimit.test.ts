import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Лимит на краю Cloudflare для чата помощника (аудит 30.09.2026 §5, `docs/ops/cloudflare-widget-ratelimit.md`):
 * `scripts/ops/cloudflare-widget-ratelimit.sh` ставит одно правило rate limiting в фазу `http_ratelimit` зоны через
 * Rulesets API. Проверяем главное без сети: подставной `curl` пишет аргументы, stdin и тело запроса в файлы.
 *
 *  1. правило одно и ровно такое: четыре POST-пути виджета, блок по IP, период и порог из умолчаний (план Free:
 *     10 с, одно правило, поля только путь);
 *  2. повтор не плодит правил и не трогает чужие: своё узнаётся по `ref`, чужие остаются на месте;
 *  3. `remove` снимает только своё;
 *  4. токен не светится в аргументах процесса (его видит любой через `ps`) — только через `--config -` на stdin;
 *  5. без токена — отказ словами и ни одного вызова curl; «правил ещё нет» (ответ 10002) — не ошибка, а пустой список.
 */
const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/cloudflare-widget-ratelimit.sh');
const TOKEN = 'cf-token-for-tests-only';
const ZONE = 'zone0000000000000000000000000001';
const REF = 'wetop-widget-ratelimit';

let bin = '';
let dir = '';

const FOREIGN = {
  id: 'rule-foreign-1',
  ref: 'login_rate_limit',
  description: 'Чужое правило: вход в стойку',
  action: 'block',
  expression: '(http.request.uri.path eq "/login")',
  ratelimit: { characteristics: ['cf.colo.id', 'ip.src'], period: 10, requests_per_period: 5, mitigation_timeout: 10 },
};
const OURS_OLD = {
  id: 'rule-ours-old',
  ref: REF,
  description: 'старая редакция',
  action: 'block',
  expression: '(http.request.uri.path in {"/widget/message"})',
  ratelimit: { characteristics: ['cf.colo.id', 'ip.src'], period: 10, requests_per_period: 99, mitigation_timeout: 10 },
};

const entrypoint = (rules: unknown[]) => JSON.stringify({ success: true, errors: [], result: { id: 'rs1', rules } });
const NO_RULESET = JSON.stringify({ success: false, errors: [{ code: 10002, message: 'could not find ruleset' }], result: null });

beforeAll(() => {
  bin = mkdtempSync(join(tmpdir(), 'cf-rl-bin-'));
  // Подставной curl: аргументы — в FAKE_ARGS, stdin (конфиг с токеном) — в FAKE_STDIN, тело из `--data-binary @файл` — в
  // FAKE_BODY. GET entrypoint отвечает тем, что лежит в FAKE_GET_BODY; PUT — успехом; поиск зоны — её номером.
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_ARGS"
url=""; method=GET; body=""
while [ $# -gt 0 ]; do
  case "$1" in
    --config) shift; [ "$1" = - ] && cat >> "$FAKE_STDIN" ;;
    -X|--request) shift; method="$1" ;;
    --data-binary|--data|-d) shift; body="\${1#@}" ;;
    http*) url="$1" ;;
  esac
  shift
done
[ -n "$body" ] && cat "$body" >> "$FAKE_BODY"
case "$url" in
  *"/zones?name="*) printf '{"success":true,"errors":[],"result":[{"id":"${ZONE}","name":"wetop.ai"}]}' ;;
  *"/rulesets/phases/http_ratelimit/entrypoint")
    if [ "$method" = PUT ]; then printf '{"success":true,"errors":[],"result":{"id":"rs1","rules":[]}}'; else cat "$FAKE_GET_BODY"; fi ;;
  *) printf '{"success":false,"errors":[{"code":1,"message":"unexpected url %s"}]}' "$url"; exit 22 ;;
esac
exit 0
`,
  );
  chmodSync(join(bin, 'curl'), 0o755);
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cf-rl-'));
});

function run(command: string, getBody: string, env: Record<string, string> = {}) {
  writeFileSync(join(dir, 'get.json'), getBody);
  const r = spawnSync('bash', [SCRIPT, command], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FAKE_ARGS: join(dir, 'args.log'),
      FAKE_STDIN: join(dir, 'stdin.log'),
      FAKE_BODY: join(dir, 'body.json'),
      FAKE_GET_BODY: join(dir, 'get.json'),
      ENV_FILE: join(dir, 'no-such-env-file'),
      CLOUDFLARE_API_TOKEN: TOKEN,
      CLOUDFLARE_ZONE_ID: ZONE,
      ...env,
    },
  });
  const read = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');
  const body = read('body.json');
  return {
    code: r.status,
    out: `${r.stdout}${r.stderr}`,
    args: read('args.log'),
    stdin: read('stdin.log'),
    body,
    rules: body ? (JSON.parse(body) as { rules: Array<Record<string, unknown>> }).rules : [],
  };
}

describe('scripts/ops/cloudflare-widget-ratelimit.sh — лимит на краю для /widget/*', () => {
  it('apply на пустой фазе ставит одно правило: четыре POST-пути виджета, блок по IP, 20 запросов за 10 с', () => {
    const r = run('apply', entrypoint([]));
    expect(r.code, r.out).toBe(0);
    expect(r.rules).toHaveLength(1);
    const rule = r.rules[0]!;
    expect(rule.ref).toBe(REF);
    expect(rule.action).toBe('block');
    expect(rule.expression).toBe(
      '(http.request.uri.path in {"/widget/session" "/widget/consent" "/widget/message" "/widget/attachment"})',
    );
    expect(rule.ratelimit).toEqual({
      characteristics: ['cf.colo.id', 'ip.src'],
      period: 10,
      requests_per_period: 20,
      mitigation_timeout: 10,
    });
    // Правила rate limiting должны стоять последними в фазе, а GET-пути виджета (widget.js, опрос сообщений) в правило
    // не входят: их частота — дело кэша и опроса, а не защиты от потока сообщений в модель
    expect(rule.expression as string).not.toContain('/widget/messages');
    expect(rule.expression as string).not.toContain('widget.js');
    expect(r.out).toContain('применено');
  });

  it('повтор не плодит правил и не трогает чужие: своё узнаётся по ref и заменяется, чужое остаётся первым', () => {
    const r = run('apply', entrypoint([FOREIGN, OURS_OLD]));
    expect(r.code, r.out).toBe(0);
    expect(r.rules.map((x) => x.ref)).toEqual(['login_rate_limit', REF]);
    expect(r.rules[0]).toMatchObject({ id: 'rule-foreign-1', expression: FOREIGN.expression });
    expect((r.rules[1]!.ratelimit as { requests_per_period: number }).requests_per_period).toBe(20);
    expect(r.rules.filter((x) => x.ref === REF)).toHaveLength(1);
  });

  it('remove снимает только своё правило', () => {
    const r = run('remove', entrypoint([FOREIGN, OURS_OLD]));
    expect(r.code, r.out).toBe(0);
    expect(r.rules.map((x) => x.ref)).toEqual(['login_rate_limit']);
    expect(r.out).toContain('снято');
  });

  it('status только читает: печатает правила фазы и ничего не отправляет', () => {
    const r = run('status', entrypoint([FOREIGN, OURS_OLD]));
    expect(r.code, r.out).toBe(0);
    expect(r.body).toBe('');
    expect(r.args).not.toMatch(/PUT/);
    expect(r.out).toContain(REF);
    expect(r.out).toContain('99');
  });

  it('порог, период и хост берутся из окружения (план Pro и выше: Host в выражении)', () => {
    const r = run('apply', entrypoint([]), {
      CF_RL_REQUESTS: '40',
      CF_RL_PERIOD: '60',
      CF_RL_TIMEOUT: '600',
      CF_RL_HOST: 'assistant.wetop.ai',
    });
    expect(r.code, r.out).toBe(0);
    const rule = r.rules[0]!;
    expect(rule.expression).toBe(
      '(http.host eq "assistant.wetop.ai" and http.request.uri.path in {"/widget/session" "/widget/consent" "/widget/message" "/widget/attachment"})',
    );
    expect(rule.ratelimit).toMatchObject({ period: 60, requests_per_period: 40, mitigation_timeout: 600 });
  });

  it('токен уходит в curl только через stdin (--config -), в аргументах процесса его нет', () => {
    const r = run('apply', entrypoint([]));
    expect(r.code, r.out).toBe(0);
    expect(r.args).not.toContain(TOKEN);
    expect(r.args).toContain('--config -');
    expect(r.stdin).toContain(`Authorization: Bearer ${TOKEN}`);
    expect(r.out).not.toContain(TOKEN);
  });

  it('«правил ещё нет» (ошибка 10002 на GET) — не отказ: apply ставит первое правило', () => {
    const r = run('apply', NO_RULESET);
    expect(r.code, r.out).toBe(0);
    expect(r.rules.map((x) => x.ref)).toEqual([REF]);
  });

  it('без токена — отказ словами и ни одного вызова curl', () => {
    const r = run('apply', entrypoint([]), { CLOUDFLARE_API_TOKEN: '' });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('CLOUDFLARE_API_TOKEN');
    expect(r.args).toBe('');
  });

  it('без номера зоны скрипт находит её по имени (wetop.ai) и дальше работает как обычно', () => {
    const r = run('status', entrypoint([]), { CLOUDFLARE_ZONE_ID: '' });
    expect(r.code, r.out).toBe(0);
    expect(r.args).toContain('/zones?name=wetop.ai');
    expect(r.args).toContain(`/zones/${ZONE}/rulesets/phases/http_ratelimit/entrypoint`);
  });
});
