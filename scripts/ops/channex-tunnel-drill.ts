/**
 * Учения скрипта туннеля без живого webhook: поддельный API PMS + настоящий одноразовый быстрый туннель.
 * Проверяет два отказа, найденных на учениях сторожа 13.09.2026 (журнал ~/Library/Logs/pms-lux/tunnel.log, 16:30–16:41 UTC):
 *
 *   lost-registration — API отвечает, но первые 6 регистраций отвергнуты (как при лежащем API): скрипт обязан
 *                       зарегистрировать webhook, как только сможет. Провал: через время наблюдения webhook не зарегистрирован.
 *   api-down          — API лежит первые 150 с: туннель ни при чём, скрипт не должен его пересоздавать (каждый новый туннель —
 *                       новый адрес). Провал: поднято больше одного туннеля или итоговая регистрация не на текущий адрес.
 *   foreign-registration — всё работает, но через 90 с в Channex оказывается чужой мёртвый адрес (перерегистрация из другого
 *                       места): скрипт обязан вернуть webhook на свой туннель. Провал: к концу наблюдения адрес чужой.
 *
 * Запуск: npx tsx scripts/ops/channex-tunnel-drill.ts <скрипт> <lost-registration|api-down|foreign-registration> [порт] [секунд наблюдения]
 * Печатает журнал скрипта и итог; код выхода 0 — PASS, 1 — FAIL. Живой webhook, API :3001 и launchd не трогает.
 */
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [script, scenario, portArg, watchArg] = process.argv.slice(2);
if (
  !script ||
  !['lost-registration', 'api-down', 'foreign-registration'].includes(scenario ?? '')
) {
  console.error(
    'usage: npx tsx scripts/ops/channex-tunnel-drill.ts <script> <lost-registration|api-down|foreign-registration> [port] [seconds]',
  );
  process.exit(2);
}
const PORT = Number(portArg ?? 3201);
const WATCH_S = Number(watchArg ?? (scenario === 'api-down' ? 330 : 240));
const DOWN_MS = scenario === 'api-down' ? 150_000 : 0;
const REG_FAIL = scenario === 'lost-registration' ? 6 : 0;
const FOREIGN_AT_MS = scenario === 'foreign-registration' ? 90_000 : null;
const FOREIGN_URL = 'https://dead-foreign-address.trycloudflare.com/channels/channex/webhook';

const started = Date.now();
const state: { registerCalls: number; callbackUrl: string | null } = {
  registerCalls: 0,
  callbackUrl: null,
};
const down = () => Date.now() - started < DOWN_MS;
if (FOREIGN_AT_MS !== null)
  setTimeout(() => {
    state.callbackUrl = FOREIGN_URL;
    console.log(`  [drill] в Channex подменён адрес webhook на ${FOREIGN_URL}`);
  }, FOREIGN_AT_MS);
createServer((req, res) => {
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (down()) return send(503, { message: 'api down (drill)' });
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const path = (req.url ?? '').split('?')[0];
    if (path === '/inventory/summary') return send(200, { ok: true });
    if (path === '/channels/channex/webhook/status')
      return send(200, {
        registered: state.callbackUrl !== null,
        callbackUrl: state.callbackUrl,
        active: true,
      });
    if (path === '/channels/channex/webhook/register') {
      state.registerCalls += 1;
      if (state.registerCalls <= REG_FAIL)
        return send(503, { message: 'register refused (drill)' });
      const url = (JSON.parse(raw || '{}') as { callbackUrl?: string }).callbackUrl ?? null;
      state.callbackUrl = url;
      return send(200, {
        id: 'drill',
        callbackUrl: url,
        created: false,
        eventMask: 'booking',
        active: true,
      });
    }
    if (path === '/channels/channex/webhook/test')
      return send(200, { statusCode: 200, verdict: 'drill' });
    send(404, {});
  });
}).listen(PORT, '127.0.0.1');

const stateDir = mkdtempSync(join(tmpdir(), `tunnel-drill-${scenario}-`));
const out: string[] = [];
const child = spawn('/bin/bash', [resolve(script)], {
  env: {
    ...process.env,
    API_URL: `http://127.0.0.1:${PORT}`,
    API_PORT: String(PORT),
    STATE_DIR: stateDir,
    // старая версия скрипта этих переменных не знает и работает на своих константах
    CHECK_EVERY: '20',
    REGISTER_PAUSE: '5',
    VERIFY_EVERY: '3',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const collect = (b: Buffer) => {
  for (const line of String(b).split('\n')) {
    if (!line.trim()) continue;
    out.push(line);
    console.log(`  | ${line}`);
  }
};
child.stdout.on('data', collect);
child.stderr.on('data', collect);

await new Promise((r) => setTimeout(r, WATCH_S * 1000));
child.kill('SIGTERM');
try {
  execSync(`pkill -f "cloudflared tunnel --url http://localhost:${PORT}"`);
} catch {
  /* уже остановлен */
}

let tunnelUrl = '';
try {
  tunnelUrl = readFileSync(join(stateDir, 'url'), 'utf8').trim();
} catch {
  /* нет файла */
}
const tunnels = out.filter((l) => / туннель: https:\/\//.test(l)).length;
const expected = tunnelUrl ? `${tunnelUrl}/channels/channex/webhook` : '(нет туннеля)';
const registeredToCurrent = state.callbackUrl !== null && state.callbackUrl === expected;
const pass = scenario === 'api-down' ? tunnels === 1 && registeredToCurrent : registeredToCurrent;
console.log(
  JSON.stringify(
    {
      scenario,
      script,
      watchedSeconds: WATCH_S,
      tunnelsStarted: tunnels,
      registerCalls: state.registerCalls,
      registeredCallback: state.callbackUrl,
      currentTunnel: tunnelUrl || null,
      result: pass ? 'PASS' : 'FAIL',
    },
    null,
    2,
  ),
);
process.exit(pass ? 0 : 1);
