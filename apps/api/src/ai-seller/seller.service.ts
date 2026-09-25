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
  sellerCategoryPrices,
  sellerFactsHash,
  sellerProfilePayload,
  type SellerFactsPayload,
  type SellerFactsSource,
  type SellerProfileInput,
} from '@pms/domain';
import { assistant } from '@pms/integrations';
import {
  actorIsOwner,
  currentOrganizationId,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { ExtensionsService, type AiSellerAccessView } from '../platform/extensions.service';
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
/** Расширение «ИИ-продавец» (DATA_MODEL §16.3, ADR-083, Q-183) */
export const SELLER_EXTENSION_OFF =
  'Расширение «ИИ-продавец» для вашей организации не подключено. Подключает администратор WETOP после оплаты';
export const SELLER_EXTENSION_EXPIRED =
  'Срок расширения «ИИ-продавец» вышел: раздел только для чтения. Продлевает администратор WETOP';
/** Роли в организации (§16.1): настройки, знания и «Применить» — у владельца, диалоги ведут все */
export const SELLER_OWNER_ONLY = 'Настройки продавца меняет владелец организации';

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
/** Как у продавца (`kb_max_file_mb = 10`, `apps/ai-seller/src/config.py`): больше он всё равно не примет */
export const KNOWLEDGE_MAX_BYTES = 10 * 1024 * 1024;
const REPLY_MAX = 4000;
const SANDBOX_MAX = 2000;

/**
 * `extension-off` — расширение не подключено или выключено; `extension-expired` — срок вышел, раздел только для чтения
 * (ADR-083, Q-183); дальше — подключена ли копия продавца к этой организации.
 */
export type SellerState =
  | 'extension-off'
  | 'extension-expired'
  | 'not-configured'
  | 'other-organization'
  | 'ready';

/** Что открывает вызов: читать — и после срока; действовать (ответ гостю, песочница) — при действующем; настраивать — ещё и владельцу */
type SellerUse = 'read' | 'act' | 'configure';

export interface SellerStatus {
  state: SellerState;
  profile: { saved: boolean; updatedAt: string | null; applied: boolean };
  facts: { applied: boolean; appliedAt: string | null };
  lastError: string | null;
  lastErrorAt: string | null;
  /** Отказ временный, платформа повторит отправку сама; `false` — продавец отклонил версию, ждём правки или «Применить» */
  retrying: boolean;
  embedAvailable: boolean;
  /** Расширение организации; `null` — организации нет (служебный ходок без привязанной копии) */
  extension: AiSellerAccessView | null;
  /** Может ли вошедший менять настройки: владелец организации и действующее расширение */
  canConfigure: boolean;
}

export interface SellerProfileView {
  saved: boolean;
  profile: SellerProfileInput;
  updatedAt: string | null;
  applied: boolean;
}

export type SyncResult =
  | { skipped: 'not-configured' | 'no-profile' | 'extension-off' }
  | { failed: string; retry: boolean }
  | { profile: boolean; facts: boolean };

/**
 * Что продавец отклонил по содержанию: профиль — версией (`updated_at` в мс) вместе с названием объекта, которое едет в
 * нём же (переименовали объект — это уже другой профиль); факты — отпечатком
 */
interface Rejected {
  profile: string | null;
  facts: string | null;
}

const profileKey = (row: SellerProfileRow, objectName: string): string =>
  `${row.updatedAt.getTime()}|${objectName}`;

/**
 * Отказ по содержанию: продавец прочёл и не принял (400, 422 — длины, слой 9). Та же версия будет отклонена снова, а
 * повтор раз в минуту — только проверка слоя 9 и, может быть, тревога у продавца каждую минуту. Ключ (401, 403), нет
 * адреса (404 — Б6, Б7 ещё не выложены), тайм-аут и частота (408, 429) — не про содержание: их сверка повторяет.
 */
const NOT_ABOUT_CONTENT: ReadonlySet<number> = new Set([401, 403, 404, 408, 429]);
export function rejectedForContent(error: unknown): boolean {
  return error instanceof assistant.SellerRejectedError && !NOT_ABOUT_CONTENT.has(error.status);
}

// ── ответы продавца: только известные поля и в словах стойки (camelCase) ─────────────────────────
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Поля профиля продавца (имена Б6, `detail.fields` отказа) — названиями полей стойки */
const SELLER_FIELD_LABELS: Readonly<Record<string, string>> = {
  object_name: 'Название объекта',
  bot_name: 'Имя бота',
  greeting: 'Приветствие',
  included_in_price: 'Что входит в цену',
  extra_charges: 'Что за доплату',
  house_rules: 'Правила проживания',
  prohibitions: 'Запреты',
  call_human_when: 'Когда звать человека',
  faq: 'Частые вопросы',
};

/** Текст отказа продавца для человека и для `last_error`: без адреса, ключа и тел запросов */
export function sellerErrorText(error: unknown): string {
  if (error instanceof assistant.SellerUnavailableError) return error.message;
  // отказ самой платформы до вызова продавца («у организации нет объекта») — её же словами
  if (error instanceof HttpException) return redactText(error.message, 500);
  if (error instanceof assistant.SellerRejectedError) {
    const fields = error.fields.map((f) => `«${SELLER_FIELD_LABELS[f] ?? f}»`).join(', ');
    return redactText(`ИИ-продавец отклонил: ${error.detail}${fields ? ` — ${fields}` : ''}`, 500);
  }
  return 'Не удалось связаться с ИИ-продавцом';
}

/** Отказ в доступе (401, 403) — слова продавца с его именем: «Доступ с этого адреса закрыт» без него непонятно чей */
const accessText = (detail: string): string =>
  detail.startsWith('ИИ-продавец') ? detail : `ИИ-продавец: ${detail}`;

/** Отказ продавца → ответ API: недоступен — 503, не нашёл — 404, не принял ключ — 503, отклонил — 422 */
function httpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof assistant.SellerUnavailableError)
    throw new ServiceUnavailableException(error.message);
  if (error instanceof assistant.SellerRejectedError) {
    if (error.status === 404) throw new NotFoundException(error.detail);
    if (error.status === 401 || error.status === 403)
      throw new ServiceUnavailableException(accessText(error.detail));
    throw new UnprocessableEntityException(sellerErrorText(error));
  }
  throw error;
}

const conversationId = (id: string): string => {
  if (!UUID.test(id)) throw new BadRequestException('Диалог: ожидается идентификатор');
  return id.toLowerCase();
};

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-079). Одна копия продавца — одна организация
 * (`SELLER_ORGANIZATION_ID`): вошедший из другой организации не получает ни одного вызова продавца. Служебные ходоки
 * (скрипты владельца, служба сверки) проходят, как везде в API (ADR-061).
 */
@Injectable()
export class SellerService {
  /**
   * Отклонённое по содержанию, по организациям: сверка это не шлёт, пока не поправят (новая версия, другой отпечаток)
   * или не нажмут «Применить» (контракт, `docs/assistant/README.md` §4). Память процесса: после перезапуска API отказ
   * повторится один раз и запомнится снова.
   */
  private readonly rejected = new Map<string, Rejected>();
  /**
   * Название объекта, с которым профиль последний раз ушёл продавцу: оно едет в профиле (`object_name`), и после
   * переименования объекта в карточке профиль уходит заново. Память процесса: после перезапуска API профиль уйдёт
   * один лишний раз.
   */
  private readonly sentObjectName = new Map<string, string>();

  constructor(
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
    @Inject(SELLER_PROFILES) private readonly profiles: SellerProfilesRepository,
    @Inject(SELLER_FACTS) private readonly facts: SellerFactsRepository,
    @Inject(SELLER_AUDIT) private readonly audit: SellerAudit,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
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

  /**
   * Расширение организации, которой служит запрос (своя у вошедшего, привязанная — у служебного ходока), и подключена ли
   * к ней копия продавца. Срок расширения проверяется при каждом вызове: вышедший действует сразу.
   */
  private async gate(now: Date): Promise<{
    extension: AiSellerAccessView | null;
    connection: 'not-configured' | 'other-organization' | 'ready';
  }> {
    const config = this.connection.config();
    const organizationId = hasSignedInActor() ? currentOrganizationId() : config.organizationId;
    const extension = organizationId ? await this.extensions.aiSeller(organizationId, now) : null;
    const connection =
      !config.baseUrl || !config.serviceKey || !config.organizationId
        ? 'not-configured'
        : hasSignedInActor() && currentOrganizationId() !== config.organizationId
          ? 'other-organization'
          : 'ready';
    return { extension, connection };
  }

  /** Отказ по расширению и роли — до любого вызова продавца и до записи в базу */
  private checkUse(extension: AiSellerAccessView | null, use: SellerUse): void {
    if (use === 'configure' && !actorIsOwner()) throw new ForbiddenException(SELLER_OWNER_ONLY);
    if (extension?.access === 'off') throw new ForbiddenException(SELLER_EXTENSION_OFF);
    if (extension?.access === 'expired' && use !== 'read')
      throw new ForbiddenException(SELLER_EXTENSION_EXPIRED);
  }

  /** Расширение и роль позволяют, продавец подключён и это его организация — иначе отказ до любого вызова продавца */
  private async bound(
    use: SellerUse,
    now: Date = new Date(),
  ): Promise<{ client: SellerPort; organizationId: string }> {
    const { extension, connection } = await this.gate(now);
    this.checkUse(extension, use);
    if (connection === 'not-configured') throw new ServiceUnavailableException(SELLER_NOT_CONNECTED);
    if (connection === 'other-organization') throw new ForbiddenException(SELLER_OTHER_ORGANIZATION);
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
  ): Promise<{ source: SellerFactsSource; payload: SellerFactsPayload; hash: string } | null> {
    const source = await this.facts.load(organizationId, now);
    if (!source) return null;
    const payload = buildSellerFacts(source);
    return { source, payload, hash: sellerFactsHash(payload) };
  }

  // ── состояние и профиль (П5) ───────────────────────────────────────────────────────────────

  async status(now: Date = new Date()): Promise<SellerStatus> {
    const { extension, connection } = await this.gate(now);
    const state: SellerState =
      extension?.access === 'off'
        ? 'extension-off'
        : extension?.access === 'expired'
          ? 'extension-expired'
          : connection;
    // служебный ходок без привязанной копии: организации нет — и профиля, значит, тоже
    const organizationId = hasSignedInActor()
      ? this.profileOrganization()
      : this.connection.config().organizationId;
    const row = organizationId ? await this.profiles.get(organizationId) : null;
    const held = organizationId ? this.rejected.get(organizationId) : undefined;
    const facts = organizationId && row ? await this.currentFacts(organizationId, now) : null;
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
      retrying:
        !!row?.lastError &&
        !stillRejected(held, row, facts?.hash ?? null, facts?.payload.object_name ?? null, {
          profile: false,
          facts: false,
        }),
      embedAvailable: this.connection.config().publicUrl !== null,
      extension,
      canConfigure: actorIsOwner() && extension?.access === 'active',
    };
  }

  /** Настройки продавца: читать — и после срока расширения, без расширения — отказ, как у всего раздела (§4.1 плана) */
  async profile(now: Date = new Date()): Promise<SellerProfileView> {
    this.checkUse((await this.gate(now)).extension, 'read');
    return this.savedProfile();
  }

  private async savedProfile(): Promise<SellerProfileView> {
    const row = await this.profiles.get(this.profileOrganization());
    return {
      saved: row !== null,
      profile: row ? pickSellerProfile(row) : DEFAULT_SELLER_PROFILE,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      applied: row !== null && profileApplied(row),
    };
  }

  async saveProfile(raw: unknown, now: Date = new Date()) {
    // сохранить заранее можно и без подключённой копии продавца, но не без расширения и не сотруднику (ADR-083)
    this.checkUse((await this.gate(now)).extension, 'configure');
    const parsed = parseSellerProfile(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
    await this.profiles.save(this.profileOrganization(), parsed.value, currentUserId(), now);
    return this.savedProfile();
  }

  // ── применение (П8) ────────────────────────────────────────────────────────────────────────

  /** «Применить»: профиль и факты уходят продавцу сейчас; отказ — понятные слова и повтор службой сверки */
  async apply(now: Date = new Date()): Promise<{ profileApplied: boolean; factsApplied: boolean }> {
    const { client, organizationId } = await this.bound('configure', now);
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
    // расширение не действует — продавцу ничего не шлём: после срока раздел только для чтения (Q-183)
    const extension = await this.extensions.aiSeller(config.organizationId, now);
    if (extension.access !== 'active') return { skipped: 'extension-off' };
    const row = await this.profiles.get(config.organizationId);
    if (!row) return { skipped: 'no-profile' };
    try {
      return await this.push(client, config.organizationId, row, now, false);
    } catch (error) {
      return { failed: sellerErrorText(error), retry: !rejectedForContent(error) };
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
    // Факты — первыми: из той же карточки профилю нужно название объекта, а без объекта продавцу сказать нечего
    const facts = await this.currentFacts(organizationId, now);
    if (!facts) {
      await this.profiles.markError(organizationId, SELLER_NO_PROPERTY, now);
      throw new NotFoundException(SELLER_NO_PROPERTY);
    }
    const objectName = facts.payload.object_name;
    const key = profileKey(row, objectName);
    // «Применить» шлёт всё: отклонённую версию отправляет человек, а не сверка
    if (force) this.rejected.delete(organizationId);
    const held: Rejected = this.rejected.get(organizationId) ?? { profile: null, facts: null };
    let part: keyof Rejected = 'profile';
    try {
      const renamed = this.sentObjectName.get(organizationId) !== objectName;
      if (force || ((!profileApplied(row) || renamed) && held.profile !== key)) {
        await client.putProfile(sellerProfilePayload(pickSellerProfile(row), objectName));
        // принятой считается ровно отправленная версия: правка во время отправки уйдёт следующей сверкой
        await this.profiles.markProfileApplied(organizationId, row.updatedAt);
        this.sentObjectName.set(organizationId, objectName);
        pushed.profile = true;
      }
      part = 'facts';
      if (force || (facts.hash !== row.factsHash && held.facts !== facts.hash)) {
        await client.putFacts(facts.payload);
        await this.profiles.markFactsApplied(organizationId, facts.hash, now);
        pushed.facts = true;
      }
    } catch (error) {
      if (rejectedForContent(error))
        this.rejected.set(organizationId, {
          ...held,
          ...(pushed.profile ? { profile: null } : {}),
          [part]: part === 'profile' ? key : facts.hash,
        });
      await this.profiles.markError(organizationId, sellerErrorText(error), now);
      throw error;
    }
    const left: Rejected = {
      profile: pushed.profile ? null : held.profile,
      facts: pushed.facts ? null : held.facts,
    };
    if (left.profile === null && left.facts === null) this.rejected.delete(organizationId);
    else this.rejected.set(organizationId, left);
    // отказ снимается, когда отклонённого больше нет: иначе раздел потерял бы причину, а сверка её не повторит
    if (row.lastError !== null && !stillRejected(left, row, facts.hash, objectName, pushed))
      await this.profiles.clearError(organizationId);
    return pushed;
  }

  async factsPreview(now: Date = new Date()) {
    this.checkUse((await this.gate(now)).extension, 'read');
    const organizationId = this.profileOrganization();
    const facts = await this.currentFacts(organizationId, now);
    if (!facts) throw new NotFoundException(SELLER_NO_PROPERTY);
    const row = await this.profiles.get(organizationId);
    return {
      facts: facts.payload,
      hash: facts.hash,
      applied: row?.factsHash === facts.hash,
      // для экрана «Данные объекта»: тариф сайта, окно цен и почему у категории цена ушла или нет (ADR-081)
      ratePlan: facts.source.ratePlan,
      window: facts.source.window,
      prices: sellerCategoryPrices(facts.source),
    };
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
    const { client } = await this.bound('read');
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
    const { client } = await this.bound('read');
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
    const { client } = await this.bound('act');
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
    const { client } = await this.bound('act');
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
    const { client } = await this.bound('read');
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
    const { client, organizationId } = await this.bound('configure');
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
    const { client } = await this.bound('read');
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
    const { client } = await this.bound('act');
    const externalId = `wetop-check-${currentUserId() ?? 'service'}`;
    const body = obj(await this.call(() => client.sandbox({ externalId, text })));
    return {
      reply: str(body.reply),
      needsHuman: body.needs_human === true,
      reasons: list(body.reasons).filter((r): r is string => typeof r === 'string'),
    };
  }

  /** Код чата продавца для сайта объекта: публичный адрес, без подписи и без ключей; только при действующем расширении */
  async embed(now: Date = new Date()): Promise<{ snippet: string | null }> {
    this.checkUse((await this.gate(now)).extension, 'act');
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

/** Отклонённое продавцом всё ещё текущее: та же версия профиля с тем же названием объекта или тот же отпечаток фактов */
function stillRejected(
  held: Rejected | undefined,
  row: SellerProfileRow,
  factsHash: string | null,
  objectName: string | null,
  pushed: { profile: boolean; facts: boolean },
): boolean {
  if (!held) return false;
  const profile =
    !pushed.profile && objectName !== null && held.profile === profileKey(row, objectName);
  const facts = !pushed.facts && factsHash !== null && held.facts === factsHash;
  return profile || facts;
}
