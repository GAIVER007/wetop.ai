import 'reflect-metadata';
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { redactText } from '@pms/domain';
import { assistant } from '@pms/integrations';
import {
  conversationId,
  conversationQuery,
  conversationView,
  conversationsView,
  knowledgeFile,
  knowledgeView,
  list,
  modeView,
  obj,
  panelHttpError,
  replyText,
  str,
  summaryView,
  uploadedView,
  type UploadedFile,
} from '../bots/panel';
import { currentUserId } from '../auth/request-context';
import { RateWindows } from '../rate-window';
import { requirePlatformAdmin } from './admin';
import { EXTENSIONS_REPOSITORY, type ExtensionsRepository } from './extensions.repository';
import { SUPPORT_AUDIT, type SupportAudit } from './support.audit';
import { SUPPORT_CONNECTION, type SupportConnection, type SupportPort } from './support.connection';
import {
  OPEN_REQUEST,
  categoryCounts,
  filterByCategory,
  queueCounts,
  queueItems,
  queueRequest,
  supportCategoryFilter,
  sortQueue,
  supportQueue,
} from './support.queue';

export const SUPPORT_NOT_CONNECTED =
  'ИИ-помощник не подключён: у платформы нет адреса панели помощника и ключа';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Правила помощника — текст системного промпта; нынешний ~12 тыс. знаков, запас вчетверо */
export const SUPPORT_PROMPT_MAX = 50_000;
/** Как у песочницы продавца: ход длиннее бот всё равно не примет */
const SANDBOX_MAX = 2000;
/** Песочница — ход модели за счёт платформы: предел в час на администратора (аудит 30.09.2026) */
export const SUPPORT_SANDBOX_PER_HOUR = 60;
export const SUPPORT_SANDBOX_TOO_OFTEN = 'Слишком много проверок за час — попробуйте позже';
const HOUR_MS = 60 * 60_000;

/** Кто пишет в техподдержку — из подписи стойки, которую бот хранит в диалоге (`lead_data.platform_user`) */
export interface SupportPlatformUser {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  /** Название организации из базы платформы; организации нет или идентификатор кривой — `null` */
  organizationName: string | null;
  role: 'owner' | 'staff' | null;
}

/** Отказ помощника по содержанию — его словами, без адреса и ключа */
const rejectedText = (error: assistant.BotRejectedError): string =>
  redactText(`${assistant.SUPPORT_BOT.name} отклонил: ${error.detail}`, 500);

function httpError(error: unknown): never {
  return panelHttpError(error, assistant.SUPPORT_BOT, rejectedText);
}

/**
 * «Платформа → Техподдержка» (ADR-083, план Э3): диалоги ИИ-помощника с людьми, которые пишут из стойки и с wetop.ai,
 * его знания и сводка. Только главному администратору — проверка первой, до разбора запроса и вызова помощника.
 * Правила помощника отсюда не меняются: для служебного ключа `PUT /prompt` у бота закрыт намеренно.
 */
@Injectable()
export class SupportService {
  constructor(
    @Inject(SUPPORT_CONNECTION) private readonly connection: SupportConnection,
    @Inject(EXTENSIONS_REPOSITORY)
    private readonly organizations: Pick<ExtensionsRepository, 'organization'>,
    @Inject(SUPPORT_AUDIT) private readonly audit: SupportAudit,
  ) {}

  private readonly sandboxWindows = new RateWindows(HOUR_MS, 10_000);

  status(): { state: 'not-configured' | 'ready' } {
    requirePlatformAdmin();
    return { state: this.connection.client() ? 'ready' : 'not-configured' };
  }

  async conversations(query: { mode?: unknown; limit?: unknown }) {
    requirePlatformAdmin();
    const wanted = conversationQuery(query);
    const client = this.client();
    return conversationsView(await call(() => client.listConversations(wanted)));
  }

  /**
   * Очередь кабинета (S1): без пустых диалогов, открытые или закрытые, отбор — у помощника в SQL. Числа очереди — из
   * одной выборки открытых; «все открытые» отдаются из неё же, без второго вызова.
   */
  async queue(rawQueue: unknown, rawCategory?: unknown) {
    requirePlatformAdmin();
    const queue = supportQueue(rawQueue);
    const category = supportCategoryFilter(rawCategory);
    const client = this.client();
    const open = queueItems(await call(() => client.listConversations(OPEN_REQUEST)));
    const wanted = queueRequest(queue);
    const items = wanted ? queueItems(await call(() => client.listConversations(wanted))) : open;
    // Категорию считает платформа по первому сообщению: помощнику про неё знать нечего
    return {
      queue,
      category,
      items: sortQueue(filterByCategory(items, category)),
      counts: queueCounts(open),
      categoryCounts: categoryCounts(items),
    };
  }

  async conversation(rawId: string) {
    requirePlatformAdmin();
    const id = conversationId(rawId);
    const client = this.client();
    const raw = await call(() => client.conversation(id));
    const card = conversationView(raw, id);
    return {
      ...card,
      closed: obj(raw).closed === true,
      platformUser: await this.platformUser(card.leadData),
    };
  }

  /** «Закрыть обращение»: диалог уходит в «Закрытые» с перепиской; следующее сообщение откроет новый */
  async close(rawId: string) {
    requirePlatformAdmin();
    const id = conversationId(rawId);
    const client = this.client();
    await call(() => client.close(id));
    await this.audit.record({
      entityType: 'SupportConversation',
      entityId: id,
      action: 'support.conversation.close',
      after: { closed: true },
    });
    return { closed: true };
  }

  async switchMode(rawId: string, action: 'takeover' | 'release') {
    requirePlatformAdmin();
    const id = conversationId(rawId);
    const client = this.client();
    const result = modeView(
      await call(() => (action === 'takeover' ? client.takeover(id) : client.release(id))),
    );
    await this.audit.record({
      entityType: 'SupportConversation',
      entityId: id,
      action: `support.conversation.${action}`,
      after: result,
    });
    return result;
  }

  async reply(rawId: string, rawText: unknown) {
    requirePlatformAdmin();
    const id = conversationId(rawId);
    const text = replyText(rawText);
    const client = this.client();
    await call(() => client.reply(id, text));
    // Текст ответа — переписка: в журнал платформы идёт только факт и длина
    await this.audit.record({
      entityType: 'SupportConversation',
      entityId: id,
      action: 'support.conversation.reply',
      after: { length: text.length },
    });
    return { ok: true };
  }

  async knowledge() {
    requirePlatformAdmin();
    const client = this.client();
    return knowledgeView(await call(() => client.knowledge()));
  }

  async uploadKnowledge(upload: UploadedFile | undefined) {
    requirePlatformAdmin();
    const { name, type, data, size } = knowledgeFile(upload);
    const client = this.client();
    const body = await call(() => client.uploadKnowledge({ name, type, data }));
    // помощник один на всю платформу — у знаний нет организации
    await this.audit.record({
      entityType: 'SupportKnowledge',
      entityId: 'assistant',
      action: 'support.knowledge.uploaded',
      after: { name, size },
    });
    return uploadedView(body, name);
  }

  async summary() {
    requirePlatformAdmin();
    const client = this.client();
    return summaryView(await call(() => client.summary()));
  }

  // ── настройка помощника (ADR-084): правила, модель, песочница ─────────────────────────────────

  /** Правила помощника — текст его системного промпта, как он лежит у бота */
  async prompt(): Promise<{ text: string }> {
    requirePlatformAdmin();
    const client = this.client();
    return { text: str(obj(await call(() => client.prompt())).text) ?? '' };
  }

  async savePrompt(raw: unknown): Promise<{ length: number }> {
    requirePlatformAdmin();
    const text = typeof raw === 'string' ? raw.trim() : '';
    // пустые правила бот считает ошибкой настройки и перестаёт отвечать — такое не отправляем
    if (text === '') throw new BadRequestException('Правила: пустой текст');
    if (text.length > SUPPORT_PROMPT_MAX)
      throw new BadRequestException(`Правила: не длиннее ${SUPPORT_PROMPT_MAX} знаков`);
    const client = this.client();
    await call(() => client.putPrompt(text));
    // В журнал — длина, а не текст: правила большие, журнал не хранилище их версий (так же пишет и бот)
    await this.audit.record({
      entityType: 'SupportAssistant',
      entityId: 'assistant',
      action: 'support.prompt.updated',
      after: { length: text.length },
    });
    return { length: text.length };
  }

  /** Модель помощника и разрешённые: прочие настройки бота стойке не нужны и не отдаются */
  async settings(): Promise<{ models: string[]; model: string | null }> {
    requirePlatformAdmin();
    const client = this.client();
    const body = obj(await call(() => client.settings()));
    return {
      models: list(body.models).filter((m): m is string => typeof m === 'string'),
      model: str(body.model),
    };
  }

  async saveModel(raw: unknown): Promise<{ model: string | null; previous: string | null }> {
    requirePlatformAdmin();
    const model = typeof raw === 'string' ? raw.trim() : '';
    if (model === '') throw new BadRequestException('Модель: выберите из списка');
    const client = this.client();
    const body = obj(await call(() => client.putModel(model)));
    const result = { model: str(body.model), previous: str(body.previous) };
    await this.audit.record({
      entityType: 'SupportAssistant',
      entityId: 'assistant',
      action: 'support.model.changed',
      after: result,
    });
    return result;
  }

  /** «Проверка»: свой разговор в песочнице помощника — гости и «Диалоги» его не видят */
  async sandbox(raw: unknown, now: Date = new Date()) {
    requirePlatformAdmin();
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text === '') throw new BadRequestException('Проверка: пустое сообщение');
    if (text.length > SANDBOX_MAX)
      throw new BadRequestException(`Проверка: не длиннее ${SANDBOX_MAX} знаков`);
    const client = this.client();
    if (!this.sandboxWindows.allow(currentUserId() ?? 'service', SUPPORT_SANDBOX_PER_HOUR, now))
      throw new HttpException(SUPPORT_SANDBOX_TOO_OFTEN, 429);
    const externalId = `wetop-support-check-${currentUserId() ?? 'service'}`;
    const body = obj(await call(() => client.sandbox({ externalId, text })));
    return {
      reply: str(body.reply),
      needsHuman: body.needs_human === true,
      reasons: list(body.reasons).filter((r): r is string => typeof r === 'string'),
    };
  }

  private client(): SupportPort {
    const client = this.connection.client();
    if (!client) throw new ServiceUnavailableException(SUPPORT_NOT_CONNECTED);
    return client;
  }

  /** Подпись вошедшего из диалога и название его организации; анонимный посетитель wetop.ai — `null` */
  private async platformUser(
    leadData: Record<string, unknown>,
  ): Promise<SupportPlatformUser | null> {
    const signed = obj(leadData.platform_user);
    const userId = str(signed.user_id);
    const email = str(signed.email);
    if (!userId && !email) return null;
    const raw = str(signed.org_id);
    const organizationId = raw && UUID.test(raw) ? raw.toLowerCase() : null;
    const organization = organizationId
      ? await this.organizations.organization(organizationId)
      : null;
    const role = str(signed.role);
    return {
      userId,
      email,
      organizationId,
      organizationName: organization?.name ?? null,
      role: role === 'owner' || role === 'staff' ? role : null,
    };
  }
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    httpError(error);
  }
}
