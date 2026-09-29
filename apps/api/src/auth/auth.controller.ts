import 'reflect-metadata';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Ip,
  Post,
} from '@nestjs/common';
import { deviceFromUserAgent } from '@pms/domain';
import { ExtensionsService } from '../platform/extensions.service';
import { RateWindows } from '../rate-window';
import { visitorIp } from '../web-booking/client-ip';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { tokenFromHeaders } from './auth.guard';
import { Public } from './public.decorator';
import { visitorKey } from './attempt-limits';
import { Access } from './access.decorator';
import { scopeView } from './request-context';

const text = (value: unknown, field: string, max = 200): string => {
  if (typeof value !== 'string' || value.trim() === '')
    throw new BadRequestException(`${field}: ожидается непустая строка`);
  if (value.length > max) throw new BadRequestException(`${field}: длиннее ${max} символов`);
  return value;
};

/**
 * Попыток в час с одного адреса (С-5, ТЗ аудита 25.09.2026). Локаут учётки (5 промахов) остаётся первой
 * защитой; лимит по адресу сдерживает перебор МНОГИХ учёток и рассылку писем с одной точки. Вход щедрее
 * остальных: за офисным адресом гостиницы вся смена. Переход по ссылке из письма и пароль по ссылке тоже впускают
 * или меняют пароль — у них свои окна (аудит 26.09, С-5).
 */
export const AUTH_IP_LIMITS = {
  loginPerHour: 30,
  registerPerHour: 10,
  resetPerHour: 10,
  resendPerHour: 10,
  verifyPerHour: 30,
  resetConfirmPerHour: 10,
  // смена пароля вошедшего: каждая попытка занимает общую очередь scrypt (SEC-4, аудит 29.09.2026)
  passwordPerHour: 20,
} as const;
/** Попыток смены пароля одной сессией в час: неверный текущий пароль у вошедшего — перебор из украденной сессии */
export const PASSWORD_CHANGE_PER_SESSION_PER_HOUR = 10;
const HOUR_MS = 3_600_000;

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
  ) {}

  /** Окна лимитов по адресу; адрес нигде не сохраняется — только ключ окна в памяти */
  private readonly windows = new RateWindows(HOUR_MS, 10_000);

  private ipLimit(kind: string, limit: number, socketIp?: string, cfConnectingIp?: string): void {
    const ip = visitorIp(socketIp, cfConnectingIp);
    if (!ip) return; // свои службы с туннеля без заголовка, юнит-тесты и вызовы без сокета
    // IPv6 — по сети /64: иначе перебор адресов одного абонента обходил бы предел (аудит 26.09)
    if (!this.windows.allow(`${kind}:${visitorKey(ip)}`, limit, new Date())) {
      throw new HttpException(
        'слишком много попыток с одного адреса, попробуйте позже',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Public()
  @Get('options')
  options() {
    return this.auth.registrationOptions();
  }

  /** Без входа по построению: этим маршрутом и входят. */
  @Public()
  @Post('login')
  // async: отказ лимита должен прийти отказом промиса, как и отказ сервиса
  async login(
    @Body() body: Record<string, unknown>,
    @Headers('user-agent') userAgent?: string,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('login', AUTH_IP_LIMITS.loginPerHour, socketIp, cfConnectingIp);
    return this.auth.login({
      email: text(body?.email, 'email'),
      password: text(body?.password, 'password', 200),
      // семейство браузера — тем же разбором, что в аналитике сайта; полный User-Agent не храним (ADR-018)
      userAgentFamily: deviceFromUserAgent(userAgent ?? null, null).browser,
    });
  }

  /**
   * Регистрация: почта, имя, название отеля, пароль, телефон и согласие с политикой. Сессии в ответе нет — сначала письмо и подтверждение почты
   * (решение владельца 20.09.2026). Без входа по построению, как и вход.
   */
  @Public()
  @Post('register')
  async register(
    @Body() body: Record<string, unknown>,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('register', AUTH_IP_LIMITS.registerPerHour, socketIp, cfConnectingIp);
    this.auth.assertRegistrationOpen();
    return this.auth.register({
      email: text(body?.email, 'email'),
      name: text(body?.name, 'name'),
      hotelName: text(body?.hotelName, 'hotelName', 200),
      password: text(body?.password, 'password', 200),
      // пустой или чужой телефон отклонит сервис словами для человека («Проверьте телефон…»)
      phoneCountry: typeof body?.phoneCountry === 'string' ? body.phoneCountry.slice(0, 2) : '',
      phone: typeof body?.phone === 'string' ? body.phone.slice(0, 40) : '',
      // только настоящее `true`: строка «true» или пропуск — не согласие
      privacyAccepted: body?.privacyAccepted === true,
    });
  }

  /**
   * Переход по ссылке из письма: подтверждаем почту и сразу впускаем — человек уже назвал пароль
   * при регистрации, спрашивать его второй раз незачем. Ответ тот же, что у /auth/login.
   * Повтор по той же ссылке впускает только 10 минут (ADR-095).
   */
  @Public()
  @Post('email/verify')
  async verifyEmail(
    @Body() body: Record<string, unknown>,
    @Headers('user-agent') userAgent?: string,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('verify', AUTH_IP_LIMITS.verifyPerHour, socketIp, cfConnectingIp);
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
  async resendEmail(
    @Body() body: Record<string, unknown>,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('resend', AUTH_IP_LIMITS.resendPerHour, socketIp, cfConnectingIp);
    await this.verification.resend(text(body?.email, 'email'));
    return { ok: true };
  }

  @Access('self')
  @Get('me')
  async me(@Headers() headers: Record<string, string>) {
    const token = tokenFromHeaders(headers);
    const signedIn = token ? await this.auth.whoami(token) : null;
    if (!signedIn) return { user: null };
    // что открыто организации: пункт меню «ИИ-продавец» и напоминание о сроке расширения (ADR-083, Q-183)
    return {
      ...signedIn,
      access: { aiSeller: await this.extensions.aiSeller(signedIn.user.organizationId) },
      // фактический scope запроса (Platform P2, К1; план P2 §4б): по нему переключатель P3 покажет, что выбрано
      context: scopeView(),
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
  async requestReset(
    @Body() body: Record<string, unknown>,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('reset', AUTH_IP_LIMITS.resetPerHour, socketIp, cfConnectingIp);
    await this.reset.request(text(body?.email, 'email'));
    return { ok: true };
  }

  /** Пароль по ссылке из письма: ссылка одноразовая, пароль человек задаёт себе сам. */
  @Public()
  @Post('password-reset/confirm')
  async confirmReset(
    @Body() body: Record<string, unknown>,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    this.ipLimit('reset-confirm', AUTH_IP_LIMITS.resetConfirmPerHour, socketIp, cfConnectingIp);
    await this.reset.confirm({
      token: text(body?.token, 'token', 400),
      password: text(body?.password, 'password', 200),
    });
    return { ok: true };
  }

  @Access('self')
  @Post('password')
  async password(
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    const token = tokenFromHeaders(headers);
    this.ipLimit('password', AUTH_IP_LIMITS.passwordPerHour, socketIp, cfConnectingIp);
    // по сессии: ключ окна — отпечаток ключа сессии, самого ключа в памяти окон нет
    if (
      token &&
      !this.windows.allow(
        `password-session:${createHash('sha256').update(token).digest('hex')}`,
        PASSWORD_CHANGE_PER_SESSION_PER_HOUR,
        new Date(),
      )
    )
      throw new HttpException(
        'слишком много попыток сменить пароль, попробуйте позже',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    await this.auth.changePassword({
      token: token ?? '',
      currentPassword: text(body?.currentPassword, 'currentPassword', 200),
      newPassword: text(body?.newPassword, 'newPassword', 200),
    });
    return { ok: true };
  }
}
