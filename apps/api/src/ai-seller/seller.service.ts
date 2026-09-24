import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  DEFAULT_SELLER_PROFILE,
  buildSellerFacts,
  parseSellerProfile,
  pickSellerProfile,
  redactText,
  sellerFactsHash,
  sellerProfilePayload,
  type SellerFactsPayload,
  type SellerProfileInput,
} from '@pms/domain';
import { assistant } from '@pms/integrations';
import {
  currentOrganizationId,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { SELLER_CONNECTION, type SellerConnection, type SellerPort } from './seller.connection';
import {
  SELLER_AUDIT,
  SELLER_FACTS,
  SELLER_PROFILES,
  type SellerAudit,
  type SellerFactsRepository,
  type SellerProfileRow,
  type SellerProfilesRepository,
} from './seller.repository';

export const SELLER_NOT_CONNECTED =
  'ИИ-продавец не подключён: у платформы нет адреса и ключа продавца';
export const SELLER_OTHER_ORGANIZATION = 'ИИ-продавец для вашей организации не подключён';
export const SELLER_NO_PROFILE = 'Сначала сохраните настройки продавца';
export const SELLER_NO_ORGANIZATION = 'Не выбрана организация: войдите в систему';
export const SELLER_NO_PROPERTY = 'У организации нет объекта: факты для продавца собрать не из чего';

const CONVERSATION_MODES = ['bot_active', 'needs_human', 'owner_takeover'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Форматы знаний по ТЗ §4.1 и что сообщить продавцу вместо того, что прислал браузер */
const KNOWLEDGE_TYPES: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  txt: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const KNOWLEDGE_MAX_BYTES = 20 * 1024 * 1024;
const REPLY_MAX = 4000;
const SANDBOX_MAX = 2000;

export type SellerState = 'not-configured' | 'other-organization' | 'ready';

export interface SellerStatus {
  state: SellerState;
  profile: { saved: boolean; updatedAt: string | null; applied: boolean };
  facts: { applied: boolean; appliedAt: string | null };
  lastError: string | null;
  lastErrorAt: string | null;
  embedAvailable: boolean;
}

export type SyncResult =
  | { skipped: 'not-configured' | 'no-profile' }
  | { failed: string }
  | { profile: boolean; facts: boolean };

// ── ответы продавца: только известные поля и в словах стойки (camelCase) ─────────────────────────
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Текст отказа продавца для человека и для `last_error`: без адреса, ключа и тел запросов */
export function sellerErrorText(error: unknown): string {
  if (error instanceof assistant.SellerUnavailableError) return error.message;
  if (error instanceof assistant.SellerRejectedError)
    return redactText(`ИИ-продавец отклонил: ${error.detail}`, 500);
  return 'Не удалось связаться с ИИ-продавцом';
}

/** Отказ продавца → ответ API: недоступен — 503, не нашёл — 404, не принял ключ — 503, отклонил — 422 */
function httpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof assistant.SellerUnavailableError)
    throw new ServiceUnavailableException(error.message);
  if (error instanceof assistant.SellerRejectedError) {
    if (error.status === 404) throw new NotFoundException(error.detail);
    if (error.status === 401 || error.status === 403)
      throw new ServiceUnavailableException(error.detail);
    throw new UnprocessableEntityException(sellerErrorText(error));
  }
  throw error;
}

const conversationId = (id: string): string => {
  if (!UUID.test(id)) throw new BadRequestException('Диалог: ожидается идентификатор');
  return id.toLowerCase();
};

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-075). Одна копия продавца — одна организация
 * (`SELLER_ORGANIZATION_ID`): вошедший из другой организации не получает ни одного вызова продавца. Служебные ходоки
 * (скрипты владельца, служба сверки) проходят, как везде в API (ADR-061).
 */
@Injectable()
export class SellerService {
  constructor(
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
    @Inject(SELLER_PROFILES) private readonly profiles: SellerProfilesRepository,
    @Inject(SELLER_FACTS) private readonly facts: SellerFactsRepository,
    @Inject(SELLER_AUDIT) private readonly audit: SellerAudit,
  ) {}

  /** Организация профиля: своя у вошедшего; у служебного ходока — та, к которой привязан продавец */
  private profileOrganization(): string {
    if (hasSignedInActor()) {
      const organizationId = currentOrganizationId();
      if (!organizationId) throw new ForbiddenException(SELLER_NO_ORGANIZATION);
      return organizationId;
    }
    const bound = this.connection.config().organizationId;
    if (!bound) throw new BadRequestException(SELLER_NO_ORGANIZATION);
    return bound;
  }

  private state(): SellerState {
    const config = this.connection.config();
    if (!config.baseUrl || !config.serviceKey || !config.organizationId) return 'not-configured';
    if (hasSignedInActor() && currentOrganizationId() !== config.organizationId)
      return 'other-organization';
    return 'ready';
  }

  /** Продавец подключён и это его организация — иначе отказ до любого вызова продавца */
  private bound(): { client: SellerPort; organizationId: string } {
    const state = this.state();
    if (state === 'not-configured') throw new ServiceUnavailableException(SELLER_NOT_CONNECTED);
    if (state === 'other-organization') throw new ForbiddenException(SELLER_OTHER_ORGANIZATION);
    const client = this.connection.client();
    const organizationId = this.connection.config().organizationId;
    if (!client || !organizationId) throw new ServiceUnavailableException(SELLER_NOT_CONNECTED);
    return { client, organizationId };
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      httpError(error);
    }
  }

  private async currentFacts(
    organizationId: string,
    now: Date,
  ): Promise<{ payload: SellerFactsPayload; hash: string } | null> {
    const source = await this.facts.load(organizationId, now);
    if (!source) return null;
    const payload = buildSellerFacts(source, now);
    return { payload, hash: sellerFactsHash(payload) };
  }

  // ── состояние и профиль (П5) ───────────────────────────────────────────────────────────────

  async status(now: Date = new Date()): Promise<SellerStatus> {
    const state = this.state();
    // служебный ходок без привязанной копии: организации нет — и профиля, значит, тоже
    const organizationId = hasSignedInActor()
      ? this.profileOrganization()
      : this.connection.config().organizationId;
    const row = organizationId ? await this.profiles.get(organizationId) : null;
    const facts =
      organizationId && row?.factsHash ? await this.currentFacts(organizationId, now) : null;
    return {
      state,
      profile: {
        saved: row !== null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        applied: row !== null && profileApplied(row),
      },
      facts: {
        applied: !!row?.factsHash && facts?.hash === row.factsHash,
        appliedAt: row?.factsAppliedAt?.toISOString() ?? null,
      },
      lastError: row?.lastError ?? null,
      lastErrorAt: row?.lastErrorAt?.toISOString() ?? null,
      embedAvailable: this.connection.config().publicUrl !== null,
    };
  }

  async profile(): Promise<{
    saved: boolean;
    profile: SellerProfileInput;
    updatedAt: string | null;
    applied: boolean;
  }> {
    const row = await this.profiles.get(this.profileOrganization());
    return {
      saved: row !== null,
      profile: row ? pickSellerProfile(row) : DEFAULT_SELLER_PROFILE,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      applied: row !== null && profileApplied(row),
    };
  }

  async saveProfile(raw: unknown, now: Date = new Date()) {
    const parsed = parseSellerProfile(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
    await this.profiles.save(this.profileOrganization(), parsed.value, currentUserId(), now);
    return this.profile();
  }

  // ── применение (П8) ────────────────────────────────────────────────────────────────────────

  /** «Применить»: профиль и факты уходят продавцу сейчас; отказ — понятные слова и повтор службой сверки */
  async apply(now: Date = new Date()): Promise<{ profileApplied: boolean; factsApplied: boolean }> {
    const { client, organizationId } = this.bound();
    const row = await this.profiles.get(organizationId);
    if (!row) throw new ConflictException(SELLER_NO_PROFILE);
    try {
      const pushed = await this.push(client, organizationId, row, now, true);
      return { profileApplied: pushed.profile, factsApplied: pushed.facts };
    } catch (error) {
      httpError(error);
    }
  }

  /**
   * Сверка раз в минуту (служба `SellerSyncService`): профиль новее принятого — отправить; отпечаток фактов другой —
   * отправить. Так цена, поправленная в «Тарифах», доходит до продавца без действий в разделе (ТЗ §4.4), а отказ
   * продавца повторяется, а не теряется.
   */
  async syncOnce(now: Date = new Date()): Promise<SyncResult> {
    const config = this.connection.config();
    const client = this.connection.client();
    if (!client || !config.organizationId) return { skipped: 'not-configured' };
    const row = await this.profiles.get(config.organizationId);
    if (!row) return { skipped: 'no-profile' };
    try {
      return await this.push(client, config.organizationId, row, now, false);
    } catch (error) {
      return { failed: sellerErrorText(error) };
    }
  }

  private async push(
    client: SellerPort,
    organizationId: string,
    row: SellerProfileRow,
    now: Date,
    force: boolean,
  ): Promise<{ profile: boolean; facts: boolean }> {
    const pushed = { profile: false, facts: false };
    try {
      if (force || !profileApplied(row)) {
        await client.putProfile(sellerProfilePayload(pickSellerProfile(row), row.updatedAt));
        // принятой считается ровно отправленная версия: правка во время отправки уйдёт следующей сверкой
        await this.profiles.markProfileApplied(organizationId, row.updatedAt);
        pushed.profile = true;
      }
      const facts = await this.currentFacts(organizationId, now);
      if (facts && (force || facts.hash !== row.factsHash)) {
        await client.putFacts(facts.payload);
        await this.profiles.markFactsApplied(organizationId, facts.hash, now);
        pushed.facts = true;
      }
    } catch (error) {
      await this.profiles.markError(organizationId, sellerErrorText(error), now);
      throw error;
    }
    if (row.lastError !== null) await this.profiles.clearError(organizationId);
    return pushed;
  }

  async factsPreview(now: Date = new Date()) {
    const organizationId = this.profileOrganization();
    const facts = await this.currentFacts(organizationId, now);
    if (!facts) throw new NotFoundException(SELLER_NO_PROPERTY);
    const row = await this.profiles.get(organizationId);
    return { facts: facts.payload, hash: facts.hash, applied: row?.factsHash === facts.hash };
  }

  // ── диалоги, знания, сводка, песочница (П7) ────────────────────────────────────────────────

  async conversations(query: { mode?: unknown; limit?: unknown }) {
    const mode = query.mode === undefined || query.mode === '' ? undefined : String(query.mode);
    if (mode !== undefined && !(CONVERSATION_MODES as readonly string[]).includes(mode))
      throw new BadRequestException('Режим диалога: bot_active, needs_human или owner_takeover');
    let limit: number | undefined;
    if (query.limit !== undefined) {
      const n = Number(query.limit);
      if (!Number.isInteger(n)) throw new BadRequestException('limit: ожидается целое число');
      limit = Math.min(Math.max(n, 1), 200);
    }
    const { client } = this.bound();
    const body = obj(
      await this.call(() =>
        client.listConversations({ ...(mode ? { mode } : {}), ...(limit ? { limit } : {}) }),
      ),
    );
    return {
      items: list(body.items).map((item) => {
        const i = obj(item);
        return {
          id: str(i.id) ?? '',
          channel: str(i.channel) ?? '',
          clientName: str(i.client_name),
          mode: str(i.mode) ?? '',
          stage: str(i.stage) ?? '',
          lastActivityAt: str(i.last_activity_at),
          messages: num(i.messages),
          hasContact: i.has_contact === true,
        };
      }),
    };
  }

  async conversation(rawId: string) {
    const id = conversationId(rawId);
    const { client } = this.bound();
    const body = obj(await this.call(() => client.conversation(id)));
    const contact = obj(body.contact);
    return {
      id: str(body.id) ?? id,
      mode: str(body.mode) ?? '',
      stage: str(body.stage) ?? '',
      leadData: obj(body.lead_data),
      contact: {
        name: str(contact.name),
        phone: str(contact.phone),
        email: str(contact.email),
        channel: str(contact.channel),
        externalId: str(contact.external_id),
      },
      messages: list(body.messages).map((m) => {
        const x = obj(m);
        return {
          role: str(x.role) ?? '',
          text: str(x.text) ?? '',
          at: str(x.at),
          sentByUs: x.sent_by_us === true,
        };
      }),
    };
  }

  async switchMode(rawId: string, action: 'takeover' | 'release') {
    const id = conversationId(rawId);
    const { client } = this.bound();
    const body = obj(
      await this.call(() => (action === 'takeover' ? client.takeover(id) : client.release(id))),
    );
    const result = { mode: str(body.mode), previousMode: str(body.previous_mode) };
    await this.audit.record({
      entityType: 'SellerConversation',
      entityId: id,
      action: `seller.conversation.${action}`,
      after: result,
    });
    return result;
  }

  async reply(rawId: string, rawText: unknown) {
    const id = conversationId(rawId);
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (text === '') throw new BadRequestException('Ответ: пустое сообщение');
    if (text.length > REPLY_MAX)
      throw new BadRequestException(`Ответ: не длиннее ${REPLY_MAX} знаков`);
    const { client } = this.bound();
    await this.call(() => client.reply(id, text));
    // Текст ответа — переписка с гостем: в журнал платформы идёт только факт и длина
    await this.audit.record({
      entityType: 'SellerConversation',
      entityId: id,
      action: 'seller.conversation.reply',
      after: { length: text.length },
    });
    return { ok: true };
  }

  async knowledge() {
    const { client } = this.bound();
    const body = obj(await this.call(() => client.knowledge()));
    return {
      items: list(body.items).map((item) => {
        const i = obj(item);
        return { source: str(i.source) ?? '', chunks: num(i.chunks), createdAt: str(i.created_at) };
      }),
    };
  }

  async uploadKnowledge(file: { originalname: string; size: number; buffer: Buffer } | undefined) {
    if (!file) throw new BadRequestException('Знания: приложите файл');
    const name = file.originalname.trim() || 'документ';
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    const type = KNOWLEDGE_TYPES[ext];
    if (!type) throw new UnsupportedMediaTypeException('Знания: md, txt, pdf, docx или xlsx');
    const { client, organizationId } = this.bound();
    const body = obj(
      await this.call(() =>
        client.uploadKnowledge({ name, type, data: new Uint8Array(file.buffer) }),
      ),
    );
    await this.audit.record({
      entityType: 'SellerKnowledge',
      entityId: organizationId,
      action: 'seller.knowledge.uploaded',
      after: { name, size: file.size },
    });
    return { source: str(body.source) ?? name, created: body.created === true, chunks: num(body.chunks) };
  }

  async summary() {
    const { client } = this.bound();
    const body = obj(await this.call(() => client.summary()));
    return {
      hours: num(body.hours),
      dialogs: num(body.dialogs),
      replies: num(body.replies),
      leads: num(body.leads),
      slaBreaches: num(body.sla_breaches),
    };
  }

  /** «Проверка»: у каждого сотрудника свой разговор в песочнице продавца */
  async sandbox(rawText: unknown) {
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (text === '') throw new BadRequestException('Проверка: пустое сообщение');
    if (text.length > SANDBOX_MAX)
      throw new BadRequestException(`Проверка: не длиннее ${SANDBOX_MAX} знаков`);
    const { client } = this.bound();
    const externalId = `wetop-check-${currentUserId() ?? 'service'}`;
    const body = obj(await this.call(() => client.sandbox({ externalId, text })));
    return {
      reply: str(body.reply),
      needsHuman: body.needs_human === true,
      reasons: list(body.reasons).filter((r): r is string => typeof r === 'string'),
    };
  }

  /** Код чата продавца для сайта объекта: публичный адрес, без подписи и без ключей */
  embed(): { snippet: string | null } {
    const publicUrl = this.connection.config().publicUrl;
    return {
      snippet: publicUrl ? `<script async src="${publicUrl}/widget/widget.js"></script>` : null,
    };
  }
}

/** Продавец принял текущую версию профиля */
function profileApplied(row: SellerProfileRow): boolean {
  return row.profileAppliedAt !== null && row.profileAppliedAt.getTime() >= row.updatedAt.getTime();
}
