import 'reflect-metadata';
import { BadRequestException, Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import { deviceFromUserAgent } from '@pms/domain';
import { AuthService } from './auth.service';
import { tokenFromHeaders } from './auth.guard';
import { Public } from './public.decorator';

const text = (value: unknown, field: string, max = 200): string => {
  if (typeof value !== 'string' || value.trim() === '')
    throw new BadRequestException(`${field}: ожидается непустая строка`);
  if (value.length > max) throw new BadRequestException(`${field}: длиннее ${max} символов`);
  return value;
};

/**
 * Вход в стойку (DATA_MODEL §13 шаг 1, ADR-046). Cookie ставит стойка: браузер ходит к Next, а Next — к API,
 * который слушает 127.0.0.1. Поэтому здесь токен только выдаётся и проверяется, а хранит его стойка.
 */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Без входа по построению: этим маршрутом и входят. */
  @Public()
  @Post('login')
  login(@Body() body: Record<string, unknown>, @Headers('user-agent') userAgent?: string) {
    return this.auth.login({
      email: text(body?.email, 'email'),
      password: text(body?.password, 'password', 200),
      // семейство браузера — тем же разбором, что в аналитике сайта; полный User-Agent не храним (ADR-018)
      userAgentFamily: deviceFromUserAgent(userAgent ?? null, null).browser,
    });
  }

  @Get('me')
  async me(@Headers() headers: Record<string, string>) {
    const token = tokenFromHeaders(headers);
    const signedIn = token ? await this.auth.whoami(token) : null;
    return signedIn ?? { user: null };
  }

  @Public()
  @Post('logout')
  async logout(@Headers() headers: Record<string, string>) {
    const token = tokenFromHeaders(headers);
    if (token) await this.auth.logout(token);
    return { ok: true };
  }

  @Post('password')
  async password(@Headers() headers: Record<string, string>, @Body() body: Record<string, unknown>) {
    const token = tokenFromHeaders(headers);
    await this.auth.changePassword({
      token: token ?? '',
      currentPassword: text(body?.currentPassword, 'currentPassword', 200),
      newPassword: text(body?.newPassword, 'newPassword', 200),
    });
    return { ok: true };
  }
}
