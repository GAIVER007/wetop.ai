import { createRuntime, type Runtime } from './worker';
import type { Env } from './types';

/**
 * Точка входа Cloudflare Worker. Изолят живёт между запросами, поэтому рантайм (и его память контракта) создаётся один
 * раз на изолят и на окружение.
 */
let runtime: Runtime | null = null;
let runtimeKey = '';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // база сайтов в ключе (MKT7): смена SITES_BASE_DOMAIN пересоздаёт рантайм, старый хост превью перестаёт действовать
    const key = `${env.SITES_ENV}|${env.SITES_API_URL}|${env.SITES_BASE_DOMAIN ?? ''}|${env.SITES_RUNTIME_KEY?.length ?? 0}`;
    if (!runtime || runtimeKey !== key) {
      runtime = createRuntime(env);
      runtimeKey = key;
    }
    return runtime.fetch(request);
  },
};
