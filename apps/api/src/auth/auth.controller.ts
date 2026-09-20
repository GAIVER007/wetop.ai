import 'reflect-metadata';
import { BadRequestException, Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import { deviceFromUserAgent } from '@pms/domain';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
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
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PasswordResetService) private readonly reset: PasswordResetService,
  ) {}

  @Public()
  @Get('options')
  options() {
    return this.auth.registrationOptions();
  }

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

  /**
   * Регистрация: почта, имя, пароль — и человек сразу внутри (ADR-053, решение владельца 20.09.2026).
   * Без входа по построению, как и вход. Ответ тот же, что у /auth/login: ключ, срок, кто вошёл.
   */
  @Public()
  @Post('register')
  register(@Body() body: Record<string, unknown>, @Headers('user-agent') userAgent?: string) {
    this.auth.assertRegistrationOpen();
    return this.auth.register({
      email: text(body?.email, 'email'),
      name: text(body?.name, 'name'),
      password: text(body?.password, 'password', 200),
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

  /**
   * «Забыли пароль». Ответ всегда одинаковый: по нему нельзя узнать, есть ли такая почта в системе.
   * Без входа по построению — человек как раз не может войти.
   */
  @Public()
  @Post('password-reset/request')
  async requestReset(@Body() body: Record<string, unknown>) {
    await this.reset.request(text(body?.email, 'email'));
    return { ok: true };
  }

  /** Пароль по ссылке из письма: ссылка одноразовая, пароль человек задаёт себе сам. */
  @Public()
  @Post('password-reset/confirm')
  async confirmReset(@Body() body: Record<string, unknown>) {
    await this.reset.confirm({
      token: text(body?.token, 'token', 400),
      password: text(body?.password, 'password', 200),
    });
    return { ok: true };
  }

  @Post('password')
  async password(
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ) {
    const token = tokenFromHeaders(headers);
    await this.auth.changePassword({
      token: token ?? '',
      currentPassword: text(body?.currentPassword, 'currentPassword', 200),
      newPassword: text(body?.newPassword, 'newPassword', 200),
    });
    return { ok: true };
  }
}
