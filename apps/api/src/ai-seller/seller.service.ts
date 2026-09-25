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
import {
  conversationId,
  conversationQuery,
  conversationView,
  conversationsView,
  knowledgeFile,
  knowledgeView,
  list,
  modeView,
  num,
  obj,
  panelHttpError,
  replyText,
  str,
  summaryView,
  uploadedView,
  type UploadedFile,
} from '../bots/panel';
import { ExtensionsService, type AiSellerAccessView } from '../platform/extensions.service';
import { SELLER_CONNECTION, type SellerConnection, type SellerPort } from './seller.connection';
import {
  SELLER_AUDIT,
  SELLER_FACTS,
  SELLER_ORGS,
  SELLER_PROFILES,
  type SellerAudit,
  type SellerFactsRepository,
  type SellerOrganizationRow,
  type SellerOrgsRepository,
  type SellerProfileRow,
  type SellerProfilesRepository,
} from './seller.repository';

export const SELLER_NOT_CONNECTED =
  'ИИ-продавец не подключён: у платформы нет адреса и ключа продавца';
export const SELLER_NO_PROFILE = 'Сначала сохраните настройки продавца';
export const SELLER_NO_ORGANIZATION = 'Не выбрана организация: войдите в систему';
export const SELLER_NO_PROPERTY =
  'У организации нет объекта: факты для продавца собрать не из чего';
/** Расширение «ИИ-продавец» (DATA_MODEL §16.3, ADR-083, Q-183) */
export const SELLER_EXTENSION_OFF =
  'Расширение «ИИ-продавец» для вашей организации не подключено. Подключает администратор WETOP после оплаты';
export const SELLER_EXTENSION_EXPIRED =
  'Срок расширения «ИИ-продавец» вышел: раздел только для чтения. Продлевает администратор WETOP';
/** Роли в организации (§16.1): настройки, знания и «Применить» — у владельца, диалоги ведут все */
export const SELLER_OWNER_ONLY = 'Настройки продавца меняет владелец организации';

/** Предел файла знаний — общий для обоих ботов (`bots/panel.ts`); контроллер раздела берёт его отсюда */
export { KNOWLEDGE_MAX_BYTES } from '../bots/panel';
const SANDBOX_MAX = 2000;
// Рассказ владельца (С1): границы — как у двери бота `/extract-profile`
const STORY_MIN = 10;
const STORY_MAX = 4000;
// Ключ модели партнёра (С2): предел — как у двери бота
const LLM_KEY_MAX = 200;

/** Поля профиля, которые рассказ вправе заполнить; манера (обращение, эмодзи, длина) — выбор партнёра в мастере */
const STORY_FIELDS: ReadonlyArray<readonly [botField: string, field: string]> = [
  ['bot_name', 'botName'],
  ['greeting', 'greeting'],
  ['included_in_price', 'includedInPrice'],
  ['extra_charges', 'extraCharges'],
  ['house_rules', 'houseRules'],
  ['prohibitions', 'prohibitions'],
  ['call_human_when', 'callHumanWhen'],
  ['faq', 'faq'],
];

/** Имена полей бота → имена экрана: ими же бот называет отброшенное защитой */
const STORY_FIELD_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  [...STORY_FIELDS, ['object_name', 'objectName'] as const].map(([b, f]) => [b, f]),
);

export interface SellerExtractView {
  filled: string[];
  skipped: string[];
  rejected: string[];
  unparsed: string[];
  /** Не пишется никуда: адрес, заезд и цены живут в «Настройках гостиницы» и «Тарифах» — это сверить глазами */
  aside: {
    objectName: string | null;
    address: string | null;
    checkIn: string | null;
    checkOut: string | null;
    categories: Array<{ name: string; kind: string; capacity: number; priceMinor: number | null }>;
  };
  profile: SellerProfileView;
}

/** Значение поля из ответа бота в форме экрана; пустое или кривое — null, поле не трогается */
function storyValue(field: string, raw: unknown): unknown | null {
  if (field === 'prohibitions' || field === 'callHumanWhen') {
    const items = list(raw)
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => v.trim());
    return items.length > 0 ? items : null;
  }
  if (field === 'faq') {
    const items = list(raw).flatMap((v) => {
      const q = str(obj(v).q)?.trim() ?? '';
      const a = str(obj(v).a)?.trim() ?? '';
      return q !== '' && a !== '' ? [{ question: q, answer: a }] : [];
    });
    return items.length > 0 ? items : null;
  }
  const text = str(raw)?.trim() ?? '';
  return text === '' ? null : text;
}

/** Поле черновика занято — рассказ его не трогает */
function storyOccupied(base: SellerProfileInput, field: string): boolean {
  const value = base[field as keyof SellerProfileInput];
  if (value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Адрес, заезд и категории из рассказа — сверить с данными платформы, а не записать поверх */
function storyAside(
  profile: Record<string, unknown>,
  facts: Record<string, unknown>,
): SellerExtractView['aside'] {
  return {
    objectName: str(profile.object_name),
    address: str(facts.address),
    checkIn: str(facts.check_in),
    checkOut: str(facts.check_out),
    categories: list(facts.categories).flatMap((item) => {
      const row = obj(item);
      const name = str(row.name)?.trim() ?? '';
      const kind = str(row.kind) ?? '';
      const capacity = num(row.capacity);
      if (name === '' || kind === '' || capacity < 1) return [];
      const priceMinor =
        typeof row.price_minor === 'number' && Number.isFinite(row.price_minor)
          ? Math.trunc(row.price_minor)
          : null;
      return [{ name, kind, capacity, priceMinor }];
    }),
  };
}

/**
 * `extension-off` — расширение не подключено или выключено; `extension-expired` — срок вышел, раздел только для чтения
 * (ADR-083, Q-183); дальше — подключён ли продавец к платформе. Состояния `other-organization` больше нет (Э4):
 * один продавец обслуживает все гостиницы, вызовы идут с организацией вошедшего.
 */
export type SellerState = 'extension-off' | 'extension-expired' | 'not-configured' | 'ready';

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
  /** Расширение организации; `null` — организации нет (служебный ходок) */
  extension: AiSellerAccessView | null;
  /** Подключён ли продавец к платформе — отдельно от расширения: после срока диалоги читаются, если он есть */
  connection: 'not-configured' | 'ready';
  /** Может ли вошедший менять настройки: владелец организации и действующее расширение */
  canConfigure: boolean;
}

export interface SellerProfileView {
  saved: boolean;
  profile: SellerProfileInput;
  updatedAt: string | null;
  applied: boolean;
}

/** Итог одного прохода сверки (Э4): сколько гостиниц обошли и скольким ушли профиль и факты */
export type SyncResult =
  | { skipped: 'not-configured' }
  | { organizations: number; profile: number; facts: number; failed: string[] };

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

/** Отказ продавца → ответ API (`bots/panel.ts`): по содержанию — его причина с названиями полей стойки */
function httpError(error: unknown): never {
  return panelHttpError(error, assistant.SELLER_BOT, sellerErrorText);
}

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-079; Э4 — ADR-083). Один продавец обслуживает все гостиницы:
 * каждый вызов идёт с организацией вошедшего (`X-Organization` в клиенте панели), сверка обходит организации со
 * строкой расширения и заводит их у продавца. Служебные ходоки без организации к путям раздела не ходят — им
 * не с чем: продавец без организации отвечает 400.
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
    @Inject(SELLER_ORGS) private readonly orgs: SellerOrgsRepository,
  ) {}

  /** Организация вызова — вошедшего: продавец общий, и «чьи строки отдавать» решает только она (Э4) */
  private profileOrganization(): string {
    if (!hasSignedInActor()) throw new BadRequestException(SELLER_NO_ORGANIZATION);
    const organizationId = currentOrganizationId();
    if (!organizationId) throw new ForbiddenException(SELLER_NO_ORGANIZATION);
    return organizationId;
  }

  /**
   * Расширение организации вошедшего и подключён ли продавец к платформе. Срок расширения проверяется при каждом
   * вызове: вышедший действует сразу.
   */
  private async gate(now: Date): Promise<{
    extension: AiSellerAccessView | null;
    connection: 'not-configured' | 'ready';
  }> {
    const config = this.connection.config();
    const organizationId = hasSignedInActor() ? currentOrganizationId() : null;
    const extension = organizationId ? await this.extensions.aiSeller(organizationId, now) : null;
    const connection = !config.baseUrl || !config.serviceKey ? 'not-configured' : 'ready';
    return { extension, connection };
  }

  /** Отказ по расширению и роли — до любого вызова продавца и до записи в базу */
  private checkUse(extension: AiSellerAccessView | null, use: SellerUse): void {
    if (use === 'configure' && !actorIsOwner()) throw new ForbiddenException(SELLER_OWNER_ONLY);
    if (extension?.access === 'off') throw new ForbiddenException(SELLER_EXTENSION_OFF);
    if (extension?.access === 'expired' && use !== 'read')
      throw new ForbiddenException(SELLER_EXTENSION_EXPIRED);
  }

  /** Расширение и роль позволяют и продавец подключён — иначе отказ до любого вызова; клиент — с организацией вошедшего */
  private async bound(
    use: SellerUse,
    now: Date = new Date(),
  ): Promise<{ client: SellerPort; organizationId: string }> {
    const { extension, connection } = await this.gate(now);
    this.checkUse(extension, use);
    if (connection === 'not-configured')
      throw new ServiceUnavailableException(SELLER_NOT_CONNECTED);
    const organizationId = this.profileOrganization();
    const client = this.connection.client(organizationId);
    if (!client) throw new ServiceUnavailableException(SELLER_NOT_CONNECTED);
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
    // служебный ходок: организации нет — и профиля, значит, тоже
    const organizationId = hasSignedInActor() ? this.profileOrganization() : null;
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
      connection,
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

  // ── рассказ владельца (С1 «под ключ», план `plans/seller-partner-bot-2026-09-25.md`) ──────

  /** Извлечённое ложится только в пустые поля черновика: занятое рукой партнёра рассказ не затирает */
  async extract(rawStory: unknown, now: Date = new Date()): Promise<SellerExtractView> {
    const story = typeof rawStory === 'string' ? rawStory.trim() : '';
    if (story.length < STORY_MIN)
      throw new BadRequestException(`Рассказ короче ${STORY_MIN} знаков — расскажите подробнее`);
    if (story.length > STORY_MAX)
      throw new BadRequestException(`Рассказ длиннее ${STORY_MAX} знаков — сократите`);
    const { client, organizationId } = await this.bound('configure', now);
    const body = obj(await this.call(() => client.extractProfile(story)));
    const extracted = obj(body.profile);

    const row = await this.profiles.get(organizationId);
    const base = row ? pickSellerProfile(row) : DEFAULT_SELLER_PROFILE;
    const draft: Record<string, unknown> = { ...base };
    const filled: string[] = [];
    const skipped: string[] = [];
    for (const [botField, field] of STORY_FIELDS) {
      const value = storyValue(field, extracted[botField]);
      if (value === null) continue;
      if (storyOccupied(base, field)) {
        skipped.push(field);
        continue;
      }
      draft[field] = value;
      filled.push(field);
    }
    if (filled.length > 0) {
      // пределы у бота и платформы одинаковые, но черновик всё равно идёт через общую проверку
      const parsed = parseSellerProfile(draft);
      if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
      await this.profiles.save(organizationId, parsed.value, currentUserId(), now);
    }
    return {
      filled,
      skipped,
      rejected: list(body.rejected).flatMap((name) =>
        typeof name === 'string' ? [STORY_FIELD_NAMES[name] ?? name] : [],
      ),
      unparsed: list(body.unparsed)
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .slice(0, 30),
      aside: storyAside(extracted, obj(body.facts)),
      profile: await this.savedProfile(),
    };
  }

  // ── ключ модели партнёра (С2, Q-186) ──────────────────────────────────────────────────────

  /** Статус ключа: хранит его только бот, платформа видит «установлен + последние 4 знака» */
  async llmKey(now: Date = new Date()): Promise<{ set: boolean; last4: string | null }> {
    const { client, organizationId } = await this.bound('configure', now);
    const body = obj(await this.call(() => client.llmKeyStatus(organizationId)));
    return { set: body.set === true, last4: str(body.last4) };
  }

  /** Поставить или снять (пустая строка) ключ; в ответах платформы ключа нет */
  async saveLlmKey(raw: unknown, now: Date = new Date()) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (key.length > LLM_KEY_MAX)
      throw new BadRequestException(`Ключ длиннее ${LLM_KEY_MAX} знаков — это не ключ`);
    const { client, organizationId } = await this.bound('configure', now);
    const body = obj(await this.call(() => client.putLlmKey(organizationId, key)));
    return { set: body.set === true, last4: str(body.last4) };
  }

  /** Проверка ключа до сохранения: живой вызов роутера делает бот, наружу — вердикт словами */
  async checkLlmKey(raw: unknown, now: Date = new Date()) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (key === '') throw new BadRequestException('Нечего проверять: ключ пуст');
    if (key.length > LLM_KEY_MAX)
      throw new BadRequestException(`Ключ длиннее ${LLM_KEY_MAX} знаков — это не ключ`);
    const { client, organizationId } = await this.bound('configure', now);
    const body = obj(await this.call(() => client.checkLlmKey(organizationId, key)));
    return { valid: body.valid === true, reason: str(body.reason) };
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
   * Сверка раз в минуту (служба `SellerSyncService`), Э4: обходит организации со строкой расширения. Гостиница
   * (имя, active, домены, публичный ключ) уходит продавцу каждый раз — упавший и поднятый бот догоняет за минуту;
   * профиль и факты — только действующим, где профиль сохранён: цена, поправленная в «Тарифах», доходит до продавца
   * без действий в разделе (ТЗ §4.4), а отказ продавца повторяется, а не теряется. Отказ одной гостиницы не
   * останавливает остальные.
   */
  async syncOnce(now: Date = new Date()): Promise<SyncResult> {
    const config = this.connection.config();
    if (!config.baseUrl || !config.serviceKey) return { skipped: 'not-configured' };
    const organizations = await this.orgs.withExtension();
    const out = { organizations: organizations.length, profile: 0, facts: 0, failed: [] as string[] };
    for (const org of organizations) {
      try {
        const pushed = await this.syncOrganization(org, now);
        out.profile += pushed.profile ? 1 : 0;
        out.facts += pushed.facts ? 1 : 0;
      } catch (error) {
        // имя гостиницы, не идентификатор: строка уходит в журнал платформы и должна читаться человеком
        out.failed.push(`${org.name}: ${sellerErrorText(error)}`);
      }
    }
    return out;
  }

  /** Одна гостиница за проход сверки: сначала её строка у продавца, потом профиль и факты действующей */
  private async syncOrganization(
    org: SellerOrganizationRow,
    now: Date,
  ): Promise<{ profile: boolean; facts: boolean }> {
    const client = this.connection.client(org.organizationId);
    if (!client) return { profile: false, facts: false };
    const extension = await this.extensions.aiSeller(org.organizationId, now);
    await this.putOrganization(client, org, extension.access === 'active');
    // расширение не действует — профиль и факты не шлём: продавец уже получил active=false и молчит (Q-183)
    if (extension.access !== 'active') return { profile: false, facts: false };
    const row = await this.profiles.get(org.organizationId);
    if (!row) return { profile: false, facts: false };
    return this.push(client, org.organizationId, row, now, false);
  }

  private async putOrganization(
    client: SellerPort,
    org: SellerOrganizationRow,
    active: boolean,
  ): Promise<void> {
    const serviceKey = this.connection.config().serviceKey;
    if (!serviceKey) return;
    await client.putOrganization(org.organizationId, {
      name: org.name,
      // ключ выводится заново на каждый вызов: платформа его нигде не хранит (Э4, план §1)
      publicKey: assistant.widgetOrgKey(serviceKey, org.organizationId),
      active,
      hosts: await this.orgs.hosts(org.organizationId),
    });
  }

  /**
   * Смена расширения («Платформа → Организации»): гостиница уходит продавцу сразу, лучшим усилием — отказ не
   * поднимается, сверка догонит в течение минуты (Э4). Возвращает, дошло ли.
   */
  async pushOrganization(organizationId: string, now: Date = new Date()): Promise<boolean> {
    try {
      const org = await this.orgs.one(organizationId);
      const client = this.connection.client(organizationId);
      if (!org || !client) return false;
      const extension = await this.extensions.aiSeller(organizationId, now);
      await this.putOrganization(client, org, extension.access === 'active');
      return true;
    } catch {
      return false;
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
    const wanted = conversationQuery(query);
    const { client } = await this.bound('read');
    return conversationsView(await this.call(() => client.listConversations(wanted)));
  }

  async conversation(rawId: string) {
    const id = conversationId(rawId);
    const { client } = await this.bound('read');
    return conversationView(await this.call(() => client.conversation(id)), id);
  }

  async switchMode(rawId: string, action: 'takeover' | 'release') {
    const id = conversationId(rawId);
    const { client } = await this.bound('act');
    const result = modeView(
      await this.call(() => (action === 'takeover' ? client.takeover(id) : client.release(id))),
    );
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
    const text = replyText(rawText);
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
    return knowledgeView(await this.call(() => client.knowledge()));
  }

  async uploadKnowledge(upload: UploadedFile | undefined) {
    const { name, type, data, size } = knowledgeFile(upload);
    const { client, organizationId } = await this.bound('configure');
    const body = await this.call(() => client.uploadKnowledge({ name, type, data }));
    await this.audit.record({
      entityType: 'SellerKnowledge',
      entityId: organizationId,
      action: 'seller.knowledge.uploaded',
      after: { name, size },
    });
    return uploadedView(body, name);
  }

  async summary() {
    const { client } = await this.bound('read');
    return summaryView(await this.call(() => client.summary()));
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

  /**
   * Код чата продавца для сайта объекта: публичный адрес и `data-key` — публичный ключ гостиницы (Э4). Ключ выводим,
   * секретов в теге нет; продавец по нему узнаёт гостиницу и пускает только с её доменов, поэтому рядом — домены
   * сайтов организации: их нет — виджет не подключить, экран говорит завести сайт.
   */
  async embed(now: Date = new Date()): Promise<{ snippet: string | null; hosts: string[] }> {
    this.checkUse((await this.gate(now)).extension, 'act');
    const organizationId = this.profileOrganization();
    const { publicUrl, serviceKey } = this.connection.config();
    return {
      snippet:
        publicUrl && serviceKey
          ? `<script async src="${publicUrl}/widget/widget.js" data-key="${assistant.widgetOrgKey(serviceKey, organizationId)}"></script>`
          : null,
      hosts: await this.orgs.hosts(organizationId),
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
