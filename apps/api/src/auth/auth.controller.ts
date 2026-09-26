import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Optional,
  Post,
  Req,
} from '@nestjs/common';
import { deviceFromUserAgent } from '@pms/domain';
import { ExtensionsService } from '../platform/extensions.service';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { tokenFromHeaders } from './auth.guard';
import { Public } from './public.decorator';
import { clientIp } from '../web-booking/client-ip';
import { AuthAttemptLimits } from './attempt-limits';

/** Запрос в той мере, в какой он нужен для адреса посетителя */
interface PeerRequest {
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Адрес посетителя: стойка передаёт его заголовком `cf-connecting-ip`, и учитывается он только от своих служб (loopback
 * и частная сеть compose, `clientIp`) — снаружи до этих маршрутов не достать, туннель их не пропускает.
 */
const visitorIp = (req: PeerRequest): string | null => {
  const header = req.headers?.['cf-connecting-ip'];
  return clientIp(req.socket?.remoteAddress, Array.isArray(header) ? header[0] : header);
};

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
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Optional()
    @Inject(AuthAttemptLimits)
    private readonly limits: AuthAttemptLimits = new AuthAttemptLimits(),
  ) {}

  @Public()
  @Get('options')
  options() {
    return this.auth.registrationOptions();
  }

  /** Без входа по построению: этим маршрутом и входят. */
  @Public()
  @Post('login')
  login(
    @Body() body: Record<string, unknown>,
    @Req() req: PeerRequest,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.limits.check(this.limits.login, visitorIp(req));
    return this.auth.login({
      email: text(body?.email, 'email'),
      password: text(body?.password, 'password', 200),
      // семейство браузера — тем же разбором, что в аналитике сайта; полный User-Agent не храним (ADR-018)
      userAgentFamily: deviceFromUserAgent(userAgent ?? null, null).browser,
    });
  }

  /**
   * Регистрация: почта, имя, пароль. Сессии в ответе нет — сначала письмо и подтверждение почты
   * (решение владельца 20.09.2026). Без входа по построению, как и вход.
   */
  @Public()
  @Post('register')
  register(@Body() body: Record<string, unknown>, @Req() req: PeerRequest) {
    this.auth.assertRegistrationOpen();
    this.limits.check(this.limits.register, visitorIp(req));
    return this.auth.register({
      email: text(body?.email, 'email'),
      name: text(body?.name, 'name'),
      hotelName: text(body?.hotelName, 'hotelName', 200),
      password: text(body?.password, 'password', 200),
    });
  }

  /**
   * Переход по ссылке из письма: подтверждаем почту и сразу впускаем — человек уже назвал пароль
   * при регистрации, спрашивать его второй раз незачем. Ответ тот же, что у /auth/login.
   * Повтор по той же ссылке впускает только 10 минут (ADR-085).
   */
  @Public()
  @Post('email/verify')
  async verifyEmail(
    @Body() body: Record<string, unknown>,
    @Req() req: PeerRequest,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.limits.check(this.limits.login, visitorIp(req));
    const confirmed = await this.verification.confirm(text(body?.token, 'token', 200));
    return this.auth.startSession({
      userId: confirmed.userId,
      organizationId: confirmed.organizationId,
      userAgentFamily: deviceFromUserAgent(userAgent ?? null, null).browser,
    });
  }

  /** «Выслать письмо заново». Ответ всегда одинаковый: по нему не узнать, есть ли такая почта. */
  @Public()
  @Post('email/resend')
  async resendEmail(@Body() body: Record<string, unknown>, @Req() req: PeerRequest) {
    this.limits.check(this.limits.mail, visitorIp(req));
    await this.verification.resend(text(body?.email, 'email'));
    return { ok: true };
  }

  @Get('me')
  async me(@Headers() headers: Record<string, string>) {
    const token = tokenFromHeaders(headers);
    const signedIn = token ? await this.auth.whoami(token) : null;
    if (!signedIn) return { user: null };
    // что открыто организации: пункт меню «ИИ-продавец» и напоминание о сроке расширения (ADR-083, Q-183)
    return {
      ...signedIn,
      access: { aiSeller: await this.extensions.aiSeller(signedIn.user.organizationId) },
    };
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
  async requestReset(@Body() body: Record<string, unknown>, @Req() req: PeerRequest) {
    this.limits.check(this.limits.mail, visitorIp(req));
    await this.reset.request(text(body?.email, 'email'));
    return { ok: true };
  }

  /** Пароль по ссылке из письма: ссылка одноразовая, пароль человек задаёт себе сам. */
  @Public()
  @Post('password-reset/confirm')
  async confirmReset(@Body() body: Record<string, unknown>, @Req() req: PeerRequest) {
    this.limits.check(this.limits.login, visitorIp(req));
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
