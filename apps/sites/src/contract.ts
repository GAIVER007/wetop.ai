import type { Env, RuntimeCurrent, SiteSpec } from './types';

/**
 * Клиент контракта `GET /sites-runtime/current` (план MKT4 §10). Память изолята:
 * - ответ по хосту живёт 60 с, потом перепроверяется: право показа не кэшируется навечно;
 * - документ хранится по `siteId + specHash` (версии неизменяемы), в API уходит `knownSpecHash`;
 * - 404 сразу забывает хост: снятый сайт не держится в кэше;
 * - `spec_invalid` закрывает выдачу без старой копии;
 * - API недоступен (сеть, таймаут, 5xx, ключ отклонён): последняя подтверждённая копия не старше 10 минут с записью
 *   в лог, старше или нет копии: 503.
 */
export const CONTRACT_TTL_MS = 60_000;
export const STALE_LIMIT_MS = 10 * 60_000;
const SPEC_CACHE_LIMIT = 50;
const TIMEOUT_MS = 5_000;

export type ContractResult =
  | { kind: 'ok'; current: RuntimeCurrent; spec: SiteSpec; stale: boolean }
  | { kind: 'not_found' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

type Log = (event: Record<string, unknown>) => void;
const defaultLog: Log = (event) => console.error(JSON.stringify(event));

export class ContractClient {
  private readonly hosts = new Map<string, { current: RuntimeCurrent; fetchedAt: number }>();
  private readonly specs = new Map<string, SiteSpec>();

  constructor(
    private readonly env: Pick<Env, 'SITES_API_URL' | 'SITES_RUNTIME_KEY'>,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = () => Date.now(),
    private readonly log: Log = defaultLog,
  ) {}

  async get(host: string): Promise<ContractResult> {
    const cached = this.hosts.get(host);
    if (cached && this.now() - cached.fetchedAt < CONTRACT_TTL_MS) return this.ok(cached.current, false);
    const known = cached && this.specs.has(specKey(cached.current)) ? cached.current.specHash : undefined;
    const answer = await this.fetchCurrent(host, known);
    if (answer.kind === 'not_found' || answer.kind === 'invalid') {
      this.hosts.delete(host);
      return answer;
    }
    if (answer.kind === 'unavailable') return this.stale(host, cached, answer.reason);
    let current = answer.current;
    if (!current.spec && !this.specs.has(specKey(current))) {
      // документ выпал из памяти между запросами: спросить ещё раз целиком
      const full = await this.fetchCurrent(host, undefined);
      if (full.kind !== 'ok') return full.kind === 'unavailable' ? this.stale(host, cached, full.reason) : full;
      current = full.current;
    }
    // рантайм знает только SiteSpec v0: незнакомая версия схемы закрывает выдачу, «как получится» не рисуем
    if (current.schemaVersion !== 'site-spec/0' || (current.spec && current.spec.schemaVersion !== 'site-spec/0')) {
      this.log({ event: 'sites.schema_unknown', siteId: current.siteId, schemaVersion: current.schemaVersion });
      this.hosts.delete(host);
      return { kind: 'invalid' };
    }
    if (current.spec) this.remember(current);
    const { spec: _drop, ...lean } = current;
    void _drop;
    this.hosts.set(host, { current: lean, fetchedAt: this.now() });
    return this.ok(lean, false);
  }

  private ok(current: RuntimeCurrent, stale: boolean): ContractResult {
    const spec = this.specs.get(specKey(current));
    if (!spec) return { kind: 'unavailable' };
    return { kind: 'ok', current, spec, stale };
  }

  private stale(host: string, cached: { current: RuntimeCurrent; fetchedAt: number } | undefined, reason: string): ContractResult {
    if (cached && this.now() - cached.fetchedAt < STALE_LIMIT_MS && this.specs.has(specKey(cached.current))) {
      this.log({ event: 'sites.stale_served', host, siteId: cached.current.siteId, ageMs: this.now() - cached.fetchedAt, reason });
      return this.ok(cached.current, true);
    }
    this.log({ event: 'sites.api_unavailable', host, reason });
    return { kind: 'unavailable' };
  }

  private remember(current: RuntimeCurrent) {
    const key = specKey(current);
    this.specs.delete(key);
    this.specs.set(key, current.spec!);
    while (this.specs.size > SPEC_CACHE_LIMIT) this.specs.delete(this.specs.keys().next().value!);
  }

  private async fetchCurrent(
    host: string,
    knownSpecHash: string | undefined,
  ): Promise<{ kind: 'ok'; current: RuntimeCurrent } | { kind: 'not_found' } | { kind: 'invalid' } | { kind: 'unavailable'; reason: string }> {
    let url: URL;
    try {
      url = new URL('/sites-runtime/current', this.env.SITES_API_URL);
    } catch {
      return { kind: 'unavailable', reason: 'config:SITES_API_URL' };
    }
    url.searchParams.set('host', host);
    if (knownSpecHash) url.searchParams.set('knownSpecHash', knownSpecHash);
    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        headers: { 'x-wetop-service-key': this.env.SITES_RUNTIME_KEY, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      return { kind: 'unavailable', reason: `network:${(error as Error).name}` };
    }
    if (res.status === 404) return { kind: 'not_found' };
    if (res.status === 503) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === 'spec_invalid') {
        this.log({ event: 'sites.spec_invalid', host });
        return { kind: 'invalid' };
      }
      return { kind: 'unavailable', reason: 'status:503' };
    }
    if (res.status !== 200) return { kind: 'unavailable', reason: `status:${res.status}` };
    const current = (await res.json().catch(() => null)) as RuntimeCurrent | null;
    if (!current || current.state !== 'PUBLISHED' || typeof current.siteId !== 'string' || typeof current.specHash !== 'string')
      return { kind: 'unavailable', reason: 'shape' };
    return { kind: 'ok', current };
  }
}

const specKey = (current: Pick<RuntimeCurrent, 'siteId' | 'specHash'>) => `${current.siteId}:${current.specHash}`;
