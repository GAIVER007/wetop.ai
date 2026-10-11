/**
 * Порты изолированных UI-стендов: роль × worker. Шаг сам по себе ничего не гарантирует (переопределение базы через
 * окружение легко сажает worker на чужой порт), поэтому каждое назначение проверяется до запуска серверов:
 * все порты стенда попарно различны и ни один не попадает в зарезервированные.
 */
export const RESERVED_PORTS: ReadonlyMap<number, string> = new Map([
  // apps/web/src/lib/api.ts отвечает 503 на этот адрес без APP_DEMO_MODE: все тесты worker молча падали (e2e-8135)
  [4312, 'демо-источник стойки'],
  [3001, 'рабочий API по умолчанию'],
]);

export function workerPorts<Role extends string>(
  bases: Record<Role, number>,
  workers: number,
  steps: Partial<Record<Role, number>> = {},
): Array<Record<Role, number>> {
  const owner = new Map<number, string>();
  const result: Array<Record<Role, number>> = [];
  for (let worker = 0; worker < workers; worker += 1) {
    const ports = {} as Record<Role, number>;
    for (const role of Object.keys(bases) as Role[]) {
      const port = bases[role] + worker * (steps[role] ?? 1);
      const label = `${role} worker ${worker}`;
      if (!Number.isInteger(port) || port < 1 || port > 65_534)
        throw new Error(`${label}: порт ${port} вне диапазона 1…65534`);
      const reserved = RESERVED_PORTS.get(port);
      if (reserved) throw new Error(`${label}: порт ${port} зарезервирован (${reserved})`);
      const taken = owner.get(port);
      if (taken) throw new Error(`${label}: порт ${port} уже назначен (${taken})`);
      owner.set(port, label);
      ports[role] = port;
    }
    result.push(ports);
  }
  return result;
}

/** Канонический auth-стенд (playwright.auth.config.ts и его спеки): одно назначение на конфиг и спеки */
export function authPorts(env: NodeJS.ProcessEnv = process.env) {
  return workerPorts(
    {
      api: Number(env.AUTH_API_PORT || '4313'),
      proxy: Number(env.AUTH_PROXY_PORT || '4323'),
      web: Number(env.AUTH_WEB_PORT || '3102'),
      site: Number(env.AUTH_SITE_PORT || '3002'),
    },
    2,
  );
}
