import 'reflect-metadata';
import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, type SignedInUser } from './auth.service';
import { PUBLIC_ROUTE } from './public.decorator';

/** Токен сессии: `Authorization: Bearer …` или `x-wetop-session` (так его шлёт стойка со своего сервера). */
export function tokenFromHeaders(headers: Record<string, unknown>): string | null {
  const header = headers['authorization'];
  if (typeof header === 'string') {
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && value) return value.trim();
  }
  const direct = headers['x-wetop-session'];
  return typeof direct === 'string' && direct.trim() !== '' ? direct.trim() : null;
}

/**
 * Замок на непубличных маршрутах API (DATA_MODEL §13 шаг 1, ADR-046).
 *
 * **В боевом образе включён всегда, пока не выключен явным `AUTH_REQUIRED=0`** (ADR-085, `authRequired` ниже). В
 * разработке без переменной выключен: сквозные тесты, сторож и скрипты сверки на Mac ходят в API без токена.
 *
 * Служебные ходоки (сторож, скрипты, задачи launchd) приходят с `x-wetop-service-key`: это не человек,
 * записи в журнале от него идут без автора.
 */
/**
 * Сравнение служебного ключа за постоянное время (сверка 20.09.2026). Обычное `===` выходит на
 * первом несовпавшем знаке, и по времени ответа ключ подбирается знак за знаком. Длину сравниваем
 * отдельно — `timingSafeEqual` на строках разной длины бросает, и это само по себе подсказка,
 * поэтому разную длину гасим заранее общим отказом.
 */
function sameKey(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Ключ только на чтение сторожа (`GUARD_READ_KEY`, срез 12 шаг 12.3). Дежурный агент на сервере должен
 * видеть неисправности, но не должен уметь ничего больше: служебный ключ `SERVICE_API_KEY` открывает
 * весь API, включая переселения и платежи, и класть его в контейнер с ИИ нельзя. Этот ключ пускает
 * только читать сторожа — GET /guard/status и GET /guard/incidents. Всё остальное, включая «принято»,
 * «решено» и /guard/tick, для него закрыто: закрывать неисправность класса Б обязан человек
 * (plans/slice-11-guardian.md §7).
 */
const GUARD_READ_ALLOWED = ['/guard/status', '/guard/incidents'];

/**
 * Узкий ключ ИИ-помощника (`ASSISTANT_READ_KEY`, ТЗ ред. 1 П4, ADR-079) — по тому же образцу: помощник видит ошибки,
 * которые API отдал человеку (DATA_MODEL §14), и состояние системы — и больше ничего. Неисправности, запись, брони,
 * гости, деньги — отказ. Сам `GET /assistant/errors` сверяет ключ ещё раз: замок молчит без `AUTH_REQUIRED=1`.
 */
const ASSISTANT_READ_ALLOWED = ['/assistant/errors', '/guard/status'];

function readAllowed(allowed: readonly string[], method: unknown, url: unknown): boolean {
  if (method !== 'GET') return false;
  if (typeof url !== 'string') return false;
  const path = url.split('?')[0]!.replace(/\/+$/, '');
  return allowed.includes(path);
}

/** Какой служебный ключ пришёл в `x-wetop-service-key`: `null` — никакого, `unknown` — ни один не подошёл */
export type ServiceKeyKind = 'service' | 'guard-read' | 'assistant-read' | 'unknown';

export function serviceKeyKind(headers: Record<string, unknown>): ServiceKeyKind | null {
  const presented = headers['x-wetop-service-key'];
  if (typeof presented !== 'string' || presented === '') return null;
  const serviceKey = process.env.SERVICE_API_KEY?.trim();
  if (serviceKey && sameKey(presented, serviceKey)) return 'service';
  const readKey = process.env.GUARD_READ_KEY?.trim();
  if (readKey && sameKey(presented, readKey)) return 'guard-read';
  const assistantKey = process.env.ASSISTANT_READ_KEY?.trim();
  if (assistantKey && sameKey(presented, assistantKey)) return 'assistant-read';
  return 'unknown';
}

/**
 * Включён ли замок (ADR-085). В боевом образе (`NODE_ENV=production`, deploy/Dockerfile) — всегда, пока его не выключили
 * явным `AUTH_REQUIRED=0`. Непонятное значение («true», «yes», опечатка) замок включает, а не снимает: до 26.09 любое
 * значение, кроме строки «1», молча открывало весь API (аудит 25.09, В-2). В разработке без переменной — выключен, как
 * раньше: сквозные тесты и сторож на Mac ходят без входа.
 */
export function authRequired(env: Record<string, string | undefined> = process.env): boolean {
  const setting = env.AUTH_REQUIRED?.trim().toLowerCase();
  if (setting === '0' || setting === 'false') return false;
  if (!setting) return env.NODE_ENV === 'production';
  return true;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = authRequired();

    if (!required) {
      // Замок молчит, но токен, если он пришёл, всё равно опознаём: журналу нужен автор действия.
      const request = context.switchToHttp().getRequest<{
        headers: Record<string, unknown>;
        user?: SignedInUser;
      }>();
      const token = tokenFromHeaders(request.headers);
      if (token) {
        const signedIn = await this.auth.whoami(token);
        if (signedIn) request.user = signedIn.user;
      }
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
      method?: unknown;
      url?: unknown;
      user?: SignedInUser;
      service?: boolean;
    }>();

    const key = serviceKeyKind(request.headers);
    if (key === 'service') {
      request.service = true;
      return true;
    }
    if (key === 'guard-read') {
      if (readAllowed(GUARD_READ_ALLOWED, request.method, request.url)) {
        request.service = true;
        return true;
      }
      throw new ForbiddenException('Ключ дежурного агента читает только неисправности сторожа');
    }
    if (key === 'assistant-read') {
      if (readAllowed(ASSISTANT_READ_ALLOWED, request.method, request.url)) {
        request.service = true;
        return true;
      }
      throw new ForbiddenException(
        'Ключ помощника читает только ошибки человека и состояние системы',
      );
    }
    if (key === 'unknown') throw new UnauthorizedException('Служебный ключ не подходит');

    const token = tokenFromHeaders(request.headers);
    const signedIn = token ? await this.auth.whoami(token) : null;
    if (!signedIn) throw new UnauthorizedException('Войдите в систему');

    request.user = signedIn.user;
    return true;
  }
}
