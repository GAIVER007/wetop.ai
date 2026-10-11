// Preload дочернего API в runtime-аудите (A2, A23, A26): API стартует, только если своя PostgreSQL на loopback
// доступна, а внешний адрес отвергается ядром с EPERM. Ошибку не подменяем: код берётся из connect() как есть.
// Перенесено из a24-evidence/final/api-network-proof.cjs; каталог доказательств задаёт AUDIT_EVIDENCE_DIR.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

// Харнессы A2/A23 передают API только белый список переменных: тогда доказательства ложатся рядом с этим файлом
const out = path.join(process.env.AUDIT_EVIDENCE_DIR || __dirname, 'network-proofs');
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const localPort = Number(process.env.AUDIT_PG_PORT || '55601');

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

// 192.0.2.1 — TEST-NET-1 (RFC 5737): наружу не маршрутизируется, но запрет должен сработать раньше маршрута
Promise.all([probe('127.0.0.1', localPort), probe('192.0.2.1', 443)]).then(([local, external]) => {
  fs.writeFileSync(
    path.join(out, `${process.pid}.json`),
    JSON.stringify(
      {
        pid: process.pid,
        cwd: process.cwd(),
        local,
        external,
        AUTH_REQUIRED: process.env.AUTH_REQUIRED,
        runtimeRole: process.env.DATABASE_URL?.split('://')[1]?.split('@')[0],
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  if (local !== 'CONNECTED' || external !== 'EPERM') {
    console.error(`Network isolation proof failed: local=${local} external=${external}`);
    process.exit(72);
  }
});
