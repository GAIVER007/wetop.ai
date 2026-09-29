import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { identityRole, userErrorSection } from '@pms/domain';
import { assistant } from '@pms/integrations';
import { serviceKeyKind } from '../auth/auth.guard';
import type { SignedInUser } from '../auth/auth.service';
import { ExtensionsService } from '../platform/extensions.service';
import { USER_ERRORS_REPOSITORY, type UserErrorsRepository } from './user-errors.repository';
import { Access } from '../auth/access.decorator';
import { RequesterContextService } from './requester-context.service';
import { DiagnosticsService } from './diagnostics.service';

export const IDENTITY_SIGNED_IN_ONLY = 'Подпись помощника выдаётся только вошедшему';
export const IDENTITY_NOT_CONFIGURED = 'Подпись помощника не настроена';
export const ERRORS_KEY_REQUIRED = 'Ошибки человека читает только помощник по своему ключу';
export const REQUESTER_KEY_REQUIRED = 'Контекст обратившегося читает только помощник по своему ключу';
export const ORGANIZATION_KEY_REQUIRED = 'Подписку организации читает только помощник по своему ключу';
export const DIAGNOSTICS_KEY_REQUIRED = 'Диагностику читает только помощник по своему ключу';
export const RESERVATION_NOT_FOUND = 'Брони с таким номером у организации нет';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Номер брони, который назвал человек: буквы, цифры, дефис и подчёркивание — ни пробелов, ни подстановок в запрос
const CONFIRMATION_NUMBER = /^[A-Za-z0-9_-]{1,40}$/;
const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Строка ответа помощнику: только то, что видел человек, — без маршрута, метода и номера запроса */
export interface AssistantErrorRow {
  at: string;
  section: string;
  status: number;
  message: string;
}

const uuidParam = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new BadRequestException(`${name}: ожидается UUID`);
  return value.toLowerCase();
};

/**
 * ИИ-помощник в стойке (ТЗ ред. 1, ADR-079; контракт — docs/assistant/README.md).
 *
 * `GET /assistant/identity` (П1) — подпись вошедшего для тега виджета: сервер стойки берёт её при отрисовке
 * макета и кладёт в `data-identity`. Автор — `request.user`, который ставит замок `SessionGuard` по сессии
 * (`x-wetop-session`, `Bearer`, кука) и при выключенном `AUTH_REQUIRED` тоже. Не `currentActor()`: его
 * заполняет только вход по куке и `Bearer`, а стойка ходит заголовком — для её запросов он пуст.
 *
 * `GET /assistant/errors` (П4) — ошибки, которые API отдал человеку (DATA_MODEL §14), по узкому ключу помощника.
 */
@Controller('assistant')
export class AssistantController {
  constructor(
    @Inject(USER_ERRORS_REPOSITORY) private readonly userErrors: UserErrorsRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Inject(RequesterContextService) private readonly requester: RequesterContextService,
    @Inject(DiagnosticsService) private readonly diagnostics: DiagnosticsService,
  ) {}

  @Access('self')
  @Get('identity')
  @Header('Cache-Control', 'no-store')
  identity(@Req() request: { user?: SignedInUser }): { token: string; expiresAt: string } {
    const user = request.user;
    // Служебный ключ — не человек: подписывать нечего, и чат такого ходока не нужен
    if (!user) throw new UnauthorizedException(IDENTITY_SIGNED_IN_ONLY);
    const secret = process.env.WIDGET_IDENTITY_SECRET?.trim() ?? '';
    if (!secret) throw new ServiceUnavailableException(IDENTITY_NOT_CONFIGURED);

    const issuedAt = Math.floor(Date.now() / 1000);
    return {
      token: assistant.signIdentity(secret, {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        // Роль в организации строчными — `owner` или `staff` (DATA_MODEL §16.1, ADR-083); прав у бота она не даёт
        role: identityRole(user.role),
        issuedAt,
      }),
      expiresAt: new Date((issuedAt + assistant.IDENTITY_TTL_SECONDS) * 1000).toISOString(),
    };
  }

  /**
   * Ключ сверяется здесь, а не только в замке: без `AUTH_REQUIRED=1` замок пускает всех, а вошедший человек
   * проходит его своей сессией — и, подставив чужой `userId`, прочёл бы чужие ошибки. Пускаются ключ помощника
   * и служебный ключ владельца; `userId` и `organizationId` — из подписи, которую помощник проверил сам.
   */
  @Access('service')
  @Get('errors')
  @Header('Cache-Control', 'no-store')
  async errors(
    @Req() request: { headers: Record<string, unknown>; user?: SignedInUser },
    @Query() query: Record<string, unknown>,
  ): Promise<{ items: AssistantErrorRow[] }> {
    const key = serviceKeyKind(request.headers);
    if (key === null && !request.user) throw new UnauthorizedException(ERRORS_KEY_REQUIRED);
    if (key !== 'assistant-read' && key !== 'service') throw new ForbiddenException(ERRORS_KEY_REQUIRED);

    const userId = uuidParam(query.userId, 'userId');
    const organizationId = uuidParam(query.organizationId, 'organizationId');

    let since = new Date(Date.now() - DAY_MS);
    if (query.since !== undefined) {
      const parsed = typeof query.since === 'string' ? new Date(query.since) : new Date(NaN);
      if (Number.isNaN(parsed.getTime()))
        throw new BadRequestException('since: ожидается дата ISO 8601');
      since = parsed;
    }

    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined) {
      const n = typeof query.limit === 'string' ? Number(query.limit) : NaN;
      if (!Number.isInteger(n)) throw new BadRequestException('limit: ожидается целое число');
      limit = Math.min(Math.max(n, 1), MAX_LIMIT);
    }

    const rows = await this.userErrors.list({ userId, organizationId, since, limit });
    // Обёртка `items`, а не голый список и не `errors`: бот считает непустое поле `errors` в теле отказом, и удачный
    // ответ читался бы как сбой (ТЗ ред. 1, П4; `apps/ai-seller/src/integrations/wetop.py`)
    return {
      items: rows.map((r) => ({
        at: r.at.toISOString(),
        section: userErrorSection(r.route),
        status: r.status,
        message: r.message,
      })),
    };
  }

  /**
   * Клиент и подписка для техподдержки (С5, Q-187): название, статус и срок расширения «ИИ-продавец» —
   * без почт, денег и гостей. Второй адрес узкого ключа помощника (`ASSISTANT_READ_ALLOWED`); ключ
   * сверяется и здесь — по той же причине, что у `GET /assistant/errors`.
   */
  @Access('service')
  @Get('organization')
  @Header('Cache-Control', 'no-store')
  async organization(
    @Req() request: { headers: Record<string, unknown>; user?: SignedInUser },
    @Query() query: Record<string, unknown>,
  ) {
    const key = serviceKeyKind(request.headers);
    if (key === null && !request.user) throw new UnauthorizedException(ORGANIZATION_KEY_REQUIRED);
    if (key !== 'assistant-read' && key !== 'service')
      throw new ForbiddenException(ORGANIZATION_KEY_REQUIRED);
    const id = uuidParam(query.id, 'id');
    const card = await this.extensions.organizationCard(id);
    if (!card) throw new NotFoundException('Организация с таким ID не найдена');
    return card;
  }

  /**
   * Контекст обратившегося для помощника поддержки (S4): кто он, в какой организации, состояние аккаунта и права роли.
   * `userId` и `organizationId` — из подписи, которую бот проверил сам; модель их не называет. Пара сверяется с
   * членством: чужая организация — 404, как «нет такого». Почты, телефона, имени и ключей в ответе нет.
   */
  @Access('service')
  @Get('requester')
  @Header('Cache-Control', 'no-store')
  async requesterContext(
    @Req() request: { headers: Record<string, unknown>; user?: SignedInUser },
    @Query() query: Record<string, unknown>,
  ) {
    const key = serviceKeyKind(request.headers);
    if (key === null && !request.user) throw new UnauthorizedException(REQUESTER_KEY_REQUIRED);
    if (key !== 'assistant-read' && key !== 'service')
      throw new ForbiddenException(REQUESTER_KEY_REQUIRED);
    const userId = uuidParam(query.userId, 'userId');
    const organizationId = uuidParam(query.organizationId, 'organizationId');
    const context = await this.requester.resolve(userId, organizationId);
    if (!context) throw new NotFoundException('Обратившегося в этой организации нет');
    return context;
  }

  /**
   * Состояние каналов продаж для помощника поддержки (S5): сопоставления, последнее событие, очередь ARI, webhook —
   * без ключей и адресов, без живого вызова Channex. Организации без подключённых каналов — `channex: null`.
   */
  @Access('service')
  @Get('integrations')
  @Header('Cache-Control', 'no-store')
  async integrations(
    @Req() request: { headers: Record<string, unknown>; user?: SignedInUser },
    @Query() query: Record<string, unknown>,
  ) {
    this.assistantKeyOnly(request, DIAGNOSTICS_KEY_REQUIRED);
    const userId = uuidParam(query.userId, 'userId');
    const organizationId = uuidParam(query.organizationId, 'organizationId');
    const answer = await this.diagnostics.integrationHealth(userId, organizationId);
    if (!answer) throw new NotFoundException('Обратившегося в этой организации нет');
    return answer;
  }

  /**
   * Состояние брони по номеру, который назвал человек (S5): статус, даты, проживания и ячейки, проблемы кодами.
   * Имени, телефона, заметок и сумм в ответе нет по построению. Чужая или несуществующая бронь — 404 без различения.
   */
  @Access('service')
  @Get('reservation')
  @Header('Cache-Control', 'no-store')
  async reservation(
    @Req() request: { headers: Record<string, unknown>; user?: SignedInUser },
    @Query() query: Record<string, unknown>,
  ) {
    this.assistantKeyOnly(request, DIAGNOSTICS_KEY_REQUIRED);
    const userId = uuidParam(query.userId, 'userId');
    const organizationId = uuidParam(query.organizationId, 'organizationId');
    const number = typeof query.number === 'string' ? query.number.trim() : '';
    if (!CONFIRMATION_NUMBER.test(number))
      throw new BadRequestException('number: ожидается номер брони (буквы, цифры, дефис, до 40 знаков)');
    const view = await this.diagnostics.reservation(userId, organizationId, number);
    if (view === undefined) throw new NotFoundException('Обратившегося в этой организации нет');
    if (view === null) throw new NotFoundException(RESERVATION_NOT_FOUND);
    return view;
  }

  /** Ключ сверяется и здесь, а не только в замке — по той же причине, что у `GET /assistant/errors` */
  private assistantKeyOnly(
    request: { headers: Record<string, unknown>; user?: SignedInUser },
    message: string,
  ): void {
    const key = serviceKeyKind(request.headers);
    if (key === null && !request.user) throw new UnauthorizedException(message);
    if (key !== 'assistant-read' && key !== 'service') throw new ForbiddenException(message);
  }
}
