import 'reflect-metadata';
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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
 * **Включается переменной `AUTH_REQUIRED=1` и по умолчанию выключен** — иначе первый же выкат положил бы
 * живую стойку, сторожа, импорт из Exely и скрипты сверки: они ходят в API без токена (ADR-023). Порядок
 * включения и проверки — `plans/slice-13-accounts-saas.md`. Пока выключен, охрану держит Cloudflare Access
 * на периметре (ADR-045).
 *
 * Служебные ходоки (сторож, скрипты, задачи launchd) приходят с `x-wetop-service-key`: это не человек,
 * записи в журнале от него идут без автора.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = process.env.AUTH_REQUIRED === '1';

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
      user?: SignedInUser;
      service?: boolean;
    }>();

    const serviceKey = process.env.SERVICE_API_KEY?.trim();
    const presented = request.headers['x-wetop-service-key'];
    if (typeof presented === 'string' && presented !== '') {
      if (serviceKey && presented === serviceKey) {
        request.service = true;
        return true;
      }
      throw new UnauthorizedException('Служебный ключ не подходит');
    }

    const token = tokenFromHeaders(request.headers);
    const signedIn = token ? await this.auth.whoami(token) : null;
    if (!signedIn) throw new UnauthorizedException('Войдите в систему');

    request.user = signedIn.user;
    return true;
  }
}
