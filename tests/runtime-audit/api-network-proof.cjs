// Preload дочернего API в runtime-аудите (A2, A23, A26): API стартует, только если своя PostgreSQL на loopback
// доступна, а внешний адрес отвергается сразу. Ошибку не подменяем: код берётся из connect() как есть.
// Ожидаемый код по платформе: macOS sandbox-exec запрещает connect() (EPERM); на Linux у сетевого пространства есть
// только lo, внешнего маршрута нет вовсе (ENETUNREACH). Таймаут или соединение означают провал.
// Перенесено из a24-evidence/final/api-network-proof.cjs; каталог доказательств задаёт AUDIT_EVIDENCE_DIR.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

// Харнессы A2/A23 передают API только белый список переменных: тогда доказательства ложатся рядом с этим файлом
const out = path.join(process.env.AUDIT_EVIDENCE_DIR || __dirname, 'network-proofs');
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const localPort = Number(process.env.AUDIT_PG_PORT || '55601');
const refused = process.platform === 'linux' ? 'ENETUNREACH' : 'EPERM';

function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let ended = false;
    const finish = (result) => {
      if (ended) return;
      ended = true;
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish('CONNECTED'));
    socket.once('error', (error) => finish(error.code));
    socket.setTimeout(5000, () => finish('TIMEOUT'));
  });
}

// sandbox-exec на macOS изредка (1–2 из 10 на Darwin 23) отвергает и разрешённый localhost с EPERM: loopback пробуем
// до трёх раз, попытки пишем в доказательство. Внешний адрес проверяется один раз и строго.
async function loopback() {
  const attempts = [];
  while (attempts.length < 3 && attempts.at(-1) !== 'CONNECTED') attempts.push(await probe('127.0.0.1', localPort));
  return attempts;
}

// 192.0.2.1 — TEST-NET-1 (RFC 5737): наружу не маршрутизируется, но запрет должен сработать раньше маршрута
Promise.all([loopback(), probe('192.0.2.1', 443)]).then(([attempts, external]) => {
  const local = attempts.at(-1);
  fs.writeFileSync(
    path.join(out, `${process.pid}.json`),
    JSON.stringify(
      {
        pid: process.pid,
        cwd: process.cwd(),
        local,
        localAttempts: attempts,
        external,
        expected: refused,
        AUTH_REQUIRED: process.env.AUTH_REQUIRED,
        runtimeRole: process.env.DATABASE_URL?.split('://')[1]?.split('@')[0],
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  if (local !== 'CONNECTED' || external !== refused) {
    console.error(`Network isolation proof failed: local=${local} external=${external}`);
    process.exit(72);
  }
});
