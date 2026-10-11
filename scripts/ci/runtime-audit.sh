#!/usr/bin/env bash
# Runtime-аудит денег, входа и схемы (A2, A23, A26, A29) на настоящих API и PostgreSQL, без внешней сети.
#
#   scripts/ci/runtime-audit.sh prepare   — с сетью: PostgreSQL 16.14 из npm, миграции, роли, засев, файлы харнессов
#   scripts/ci/runtime-audit.sh isolated  — закрывает сеть и запускает `run` внутри (Linux: своё сетевое
#                                           пространство и netfilter; macOS: sandbox-exec), затем гасит своё
#   scripts/ci/runtime-audit.sh run       — внутри изоляции: доказательство сети, PostgreSQL, API A26, тесты
#
# База, API и тесты живут в одном сетевом пространстве и видят друг друга через loopback; наружу connect()
# сразу отвергается ядром (macOS: EPERM от sandbox-exec; Linux: ENETUNREACH, у пространства нет внешних интерфейсов
# и маршрутов). Ничего production: вымышленные данные (ADR-010), своя база в AUDIT_WORK.
# Исторический A3 (bar-money-invariants-audit.test.ts, A3_RUNTIME_AUDIT) сюда сознательно не входит:
# он проверял прежние дефекты, часть его ожиданий противоречит D-CUR (reports/wetop-master-2026-10-10).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PARENT="$(dirname "$ROOT")"
WORK="${AUDIT_WORK:-${TMPDIR:-/tmp}/wetop-runtime-audit}"
PORT=55601
DB=pmslocal
EVIDENCE="$ROOT/tests/runs/runtime-audit"

export AUDIT_PG_PORT="$PORT" A28_PG_DATABASE="$DB" A24_DATABASE="$DB" A28_WORK_DIR="$WORK/a26" \
  AUDIT_REPO_ROOT="$ROOT" AUDIT_EVIDENCE_DIR="$EVIDENCE"

local_db() {
  PMS_LOCAL_PG_EMBEDDED=1 PMS_LOCAL_PGPORT="$PORT" PMS_LOCAL_PGDATA="$WORK/pgdata" "$ROOT/scripts/ops/local-db.sh" "$@"
}
pg_bin() { find "$ROOT/.local-pg/node_modules/@embedded-postgres" -path '*/native/bin' -maxdepth 4 -type d | head -1; }

prepare() {
  mkdir -p "$WORK" "$EVIDENCE"
  chmod 700 "$WORK"
  local_db start
  ( cd "$ROOT" && npx tsx tests/runtime-audit/prepare.ts )
  local_db stop
  # Харнессы A2/A23 ищут preload и npm-настройки над репозиторием (как в среде A28): кладём копии из репозитория
  cp "$ROOT/tests/runtime-audit/api-network-proof.cjs" "$PARENT/api-network-proof.cjs"
  : > "$PARENT/npm-user.conf"
  : > "$PARENT/npm-global.conf"
  mkdir -p "$PARENT/npm-cache"
  cp "$ROOT/tests/runtime-audit/a26-restart.cjs" "$WORK/a26/a26-restart.cjs"
  echo "runtime-audit: подготовка готова в $WORK"
}

cleanup() {
  local pid file
  # только свои группы процессов API (A26 4427, A25 4417): пустой pid дал бы kill -0 и погасил бы этот скрипт
  for file in "$WORK"/a26/api-*.pid; do
    pid="$(cat "$file" 2>/dev/null || true)"
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] && kill -- "-$pid" 2>/dev/null || true
  done
  "$1/pg_ctl" -D "$WORK/pgdata" -m fast stop >/dev/null 2>&1 || true
}

run() {
  mkdir -p "$EVIDENCE/a25"
  # 1. Доказательство в этом процессе: loopback открыт, внешний адрес и DNS-сервер закрыты ядром
  PG_BIN="$(pg_bin)"
  "$PG_BIN/pg_ctl" -D "$WORK/pgdata" -l "$WORK/pgdata/server.log" -o "-p $PORT -k $WORK/pgdata" -w start >/dev/null
  trap 'cleanup "$PG_BIN"' EXIT
  ( cd "$ROOT" && node -e '
    const net = require("node:net");
    const probe = (host, port) => new Promise((done) => {
      const s = net.connect({ host, port }); let end = false;
      const f = (r) => { if (end) return; end = true; s.destroy(); done(r); };
      s.once("connect", () => f("CONNECTED")); s.once("error", (e) => f(e.code)); s.setTimeout(5000, () => f("TIMEOUT"));
    });
    (async () => {
      const refused = process.platform === "linux" ? "ENETUNREACH" : "EPERM";
      // loopback до трёх попыток: sandbox-exec изредка отвергает и разрешённый localhost (EPERM); внешнее проверяется один раз
      const localAttempts = [];
      while (localAttempts.length < 3 && localAttempts.at(-1) !== "CONNECTED")
        localAttempts.push(await probe("127.0.0.1", Number(process.env.AUDIT_PG_PORT)));
      const result = { local: localAttempts.at(-1), localAttempts,
        external: await probe("192.0.2.1", 443), dns: await probe("8.8.8.8", 53), expected: refused };
      require("node:fs").writeFileSync(process.env.AUDIT_EVIDENCE_DIR + "/runner-network.json", JSON.stringify(result, null, 2));
      console.log("runtime-audit: сеть", JSON.stringify(result));
      if (result.local !== "CONNECTED" || result.external !== refused || result.dns !== refused) process.exit(72);
    })();
  ' )
  # 2. API для A26 (порт 4427) — тот же старт, что перезапускает сама матрица A26
  node "$WORK/a26/a26-restart.cjs"
  for _ in $(seq 1 150); do curl -fsS http://127.0.0.1:4427/health >/dev/null 2>&1 && break; sleep 0.2; done
  curl -fsS http://127.0.0.1:4427/health >/dev/null
  # 3. Действующие проверки: A29 схема и UTC соединений, A2 bootstrap, A23 деньги, A26 время и сессии
  local url="postgresql://postgres@127.0.0.1:$PORT/$DB"
  ( cd "$ROOT" && DATABASE_URL="$url" \
      A29_SCHEMA_ADMIN_URL="$url" \
      A29_SCHEMA_SERVICE_URL="postgresql://a29_service@127.0.0.1:$PORT/$DB" \
      A29_SCHEMA_TENANT_URL="postgresql://a29_tenant@127.0.0.1:$PORT/$DB" \
      A2_RUNTIME_AUDIT=1 A23_RUNTIME_AUDIT=1 \
      npm run test:record -- integration \
        tests/integration/connection-schema-a29.test.ts \
        tests/integration/bar-api-bootstrap.test.ts \
        tests/integration/bar-money-fixes.test.ts \
        tests/integration/auth-timezone-a26.test.ts \
        tests/integration/auth-timezone-matrix-a26.test.ts \
        tests/integration/auth-date-consumers-a26.test.ts \
        --note "runtime-аудит в изоляции сети: A29, A2, A23, A26" )
  # 4. Браузер Бар-2 (A25): настоящий API на 4417 и стойка на 3127, сверка ожидание/API/SQL/DOM
  AUDIT_API_PORT=4417 node "$WORK/a26/a26-restart.cjs"
  for _ in $(seq 1 150); do curl -fsS http://127.0.0.1:4417/health >/dev/null 2>&1 && break; sleep 0.2; done
  curl -fsS http://127.0.0.1:4417/health >/dev/null
  ( cd "$ROOT" && A25_EVIDENCE_DIR="$EVIDENCE/a25" npm run test:record -- e2e \
      --config tests/runtime-audit/playwright.bar.config.ts --workers=1 \
      --note "runtime-аудит в изоляции сети: браузер Бар-2 (A25) на настоящем API" )
}

isolated() {
  case "$(uname -s)" in
    Linux)
      # Своё сетевое пространство только с lo: база, API и тесты видят друг друга, наружу нет ни интерфейса, ни
      # маршрута, connect() сразу получает ENETUNREACH. (iptables OUTPUT DROP не годится: TCP тогда уходит в таймаут.)
      sudo unshare --net -- bash -euo pipefail -c '
        ip link set lo up
        exec sudo -u "$SUDO_USER" --preserve-env=PATH,HOME,TMPDIR,AUDIT_WORK,CHROMIUM_PATH "$0" run
      ' "$ROOT/scripts/ci/runtime-audit.sh"
      ;;
    Darwin)
      local profile="$WORK/network.sb"
      printf '(version 1)\n(allow default)\n(deny network-outbound (remote ip "*:*"))\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-outbound (remote unix-socket))\n' > "$profile"
      sandbox-exec -f "$profile" "$ROOT/scripts/ci/runtime-audit.sh" run
      ;;
    *) echo "runtime-audit: изоляция для $(uname -s) не описана" >&2; exit 2 ;;
  esac
}

case "${1:-}" in
  prepare) prepare ;;
  run) run ;;
  isolated) isolated ;;
  *) echo "runtime-audit: prepare | isolated | run" >&2; exit 2 ;;
esac
