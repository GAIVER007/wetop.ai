import 'reflect-metadata';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { redactText } from '@pms/domain';
import { assistant } from '@pms/integrations';
import {
  conversationId,
  conversationQuery,
  conversationView,
  conversationsView,
  knowledgeFile,
  knowledgeView,
  modeView,
  obj,
  panelHttpError,
  replyText,
  str,
  summaryView,
  uploadedView,
  type UploadedFile,
} from '../bots/panel';
import { requirePlatformAdmin } from './admin';
import { EXTENSIONS_REPOSITORY, type ExtensionsRepository } from './extensions.repository';
import { SUPPORT_AUDIT, type SupportAudit } from './support.audit';
import { SUPPORT_CONNECTION, type SupportConnection, type SupportPort } from './support.connection';

export const SUPPORT_NOT_CONNECTED =
  'ИИ-помощник не подключён: у платформы нет адреса панели помощника и ключа';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  async conversation(rawId: string) {
    requirePlatformAdmin();
    const id = conversationId(rawId);
    const client = this.client();
    const card = conversationView(await call(() => client.conversation(id)), id);
    return { ...card, platformUser: await this.platformUser(card.leadData) };
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
