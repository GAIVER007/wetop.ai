import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { hostMatches, normalizeHost } from '@pms/domain';

/**
 * Cloudflare Turnstile перед бронью с сайта (BOOK-SEC1, аудит 29.09.2026, ADR-126). Публичный `POST /w/book` создаёт
 * подтверждённую бронь, а домен сайта проверяется по `Origin`, который вне браузера подделывается. Токен проверяется
 * здесь, на сервере: секрет `TURNSTILE_SECRET_KEY` в браузер не попадает, любая неопределённость — отказ (fail-closed).
 * Пока секрет не задан, проверка выключена и бронь работает как раньше.
 */
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Действие, с которым виджет рисует Turnstile: токен, полученный для другого действия, для брони не годится */
export const TURNSTILE_ACTION = 'booking';
/** Токены Cloudflare — до 2048 знаков; длиннее — не токен, наружу такое не отправляем */
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5_000;

export type TurnstileFailure = 'missing' | 'invalid' | 'expired' | 'unavailable';
export type TurnstileResult = { ok: true } | { ok: false; reason: TurnstileFailure };
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const TURNSTILE_FETCH = Symbol('TURNSTILE_FETCH');

type Env = Record<string, string | undefined>;

export interface TurnstileContext {
  /** Адрес посетителя: Cloudflare учитывает его при оценке; нигде не сохраняется */
  ip?: string | null;
  /** Домены сайта: страница, на которой решили проверку, должна быть одной из них */
  allowedHosts: string[];
  /** Свой хост: демо-страница живёт на адресе API */
  ownHost?: string | null;
}

@Injectable()
export class TurnstileService {
  private readonly fetchImpl: FetchLike;

  constructor(@Optional() @Inject(TURNSTILE_FETCH) fetchImpl?: FetchLike) {
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
  }

  /** Проверка включена, когда задан секрет */
  enabled(env: Env = process.env): boolean {
    return !!env['TURNSTILE_SECRET_KEY']?.trim();
  }

  /** Публичный ключ для виджета; пока проверка выключена — не отдаётся */
  siteKey(env: Env = process.env): string | null {
    if (!this.enabled(env)) return null;
    return env['TURNSTILE_SITE_KEY']?.trim() || null;
  }

  async verify(
    token: unknown,
    ctx: TurnstileContext,
    env: Env = process.env,
  ): Promise<TurnstileResult> {
    if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing' };
    const response = token.trim();
    if (response.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'invalid' };
    const secret = env['TURNSTILE_SECRET_KEY']?.trim();
    if (!secret) return { ok: false, reason: 'unavailable' };

    const body = new URLSearchParams({ secret, response });
    if (ctx.ip) body.set('remoteip', ctx.ip);
    let data: Record<string, unknown>;
    try {
      const res = await this.fetchImpl(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!res.ok) return { ok: false, reason: 'unavailable' };
      const json: unknown = await res.json();
      if (!json || typeof json !== 'object' || Array.isArray(json))
        return { ok: false, reason: 'unavailable' };
      data = json as Record<string, unknown>;
    } catch {
      // сеть, таймаут, не JSON: подтвердить нечем — брони нет
      return { ok: false, reason: 'unavailable' };
    }

    if (data['success'] !== true) {
      const codes = Array.isArray(data['error-codes'])
        ? (data['error-codes'] as unknown[]).filter((c): c is string => typeof c === 'string')
        : [];
      if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
        // ошибка настройки, не вина гостя: в журнал — без секрета и токена
        console.error(
          'Turnstile: Cloudflare отверг секрет, проверьте TURNSTILE_SECRET_KEY (docs/deploy.md)',
        );
        return { ok: false, reason: 'unavailable' };
      }
      if (codes.includes('timeout-or-duplicate')) return { ok: false, reason: 'expired' };
      if (codes.includes('missing-input-response')) return { ok: false, reason: 'missing' };
      return { ok: false, reason: 'invalid' };
    }

    // Токен решён на странице сайта, а не на чужой: хост из ответа Cloudflare — один из доменов сайта
    const hostname = data['hostname'];
    if (typeof hostname === 'string' && hostname) {
      const host = normalizeHost(hostname);
      if (!(ctx.ownHost && host === ctx.ownHost) && !hostMatches(ctx.allowedHosts, host))
        return { ok: false, reason: 'invalid' };
    }
    const action = data['action'];
    if (typeof action === 'string' && action && action !== TURNSTILE_ACTION)
      return { ok: false, reason: 'invalid' };
    return { ok: true };
  }
}

/** Ответ гостю; подробностей Cloudflare в тексте нет */
export function turnstileFailureError(reason: TurnstileFailure): HttpException {
  switch (reason) {
    case 'missing':
      return new BadRequestException('Подтвердите, что вы не робот, и повторите');
    case 'expired':
      return new ForbiddenException('Проверка устарела: пройдите её ещё раз');
    case 'unavailable':
      return new ServiceUnavailableException('Не удалось выполнить проверку, попробуйте позже');
    default:
      return new ForbiddenException('Проверка не пройдена: обновите страницу и повторите');
  }
}

/**
 * Сообщение при старте API в production: ничего не задано — предупреждение (бронь с сайта без капчи); задан только один
 * из двух ключей — ошибка (без публичного ключа виджет не покажет проверку, без секрета сервер её не потребует).
 */
export function turnstileConfigNotice(
  env: Env,
): { level: 'warn' | 'error'; message: string } | null {
  if (env['NODE_ENV'] !== 'production') return null;
  const secret = !!env['TURNSTILE_SECRET_KEY']?.trim();
  const site = !!env['TURNSTILE_SITE_KEY']?.trim();
  if (secret && site) return null;
  if (secret)
    return {
      level: 'error',
      message:
        'TURNSTILE_SECRET_KEY задан без TURNSTILE_SITE_KEY: виджет не покажет проверку, и все брони с сайта будут отклоняться (docs/deploy.md)',
    };
  if (site)
    return {
      level: 'error',
      message:
        'TURNSTILE_SITE_KEY задан без TURNSTILE_SECRET_KEY: сервер не будет проверять токен (docs/deploy.md)',
    };
  return {
    level: 'warn',
    message:
      'TURNSTILE_SECRET_KEY не задан: бронь с сайта (/w/book) не защищена капчей. Задайте TURNSTILE_SITE_KEY и TURNSTILE_SECRET_KEY (docs/deploy.md)',
  };
}
