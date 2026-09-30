import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { redactText } from '@pms/domain';
import { assistant } from '@pms/integrations';
import { list as asList, num, obj, panelHttpError, str } from '../bots/panel';
import { currentUserId } from '../auth/request-context';
import { requirePlatformAdmin } from './admin';
import { SUPPORT_AUDIT, type SupportAudit } from './support.audit';
import { SUPPORT_CONNECTION, type SupportConnection, type SupportPort } from './support.connection';
import { SUPPORT_NOT_CONNECTED } from './support.service';

/** Словари базы знаний (план S3 §2.1): проверяются здесь до вызова помощника, там — второй раз */
export const KB_CATEGORIES = ['PRODUCT', 'HOW_TO', 'TROUBLESHOOTING', 'BILLING', 'INTEGRATIONS', 'SECURITY', 'KNOWN_ISSUE', 'RUNBOOK'] as const;
export const KB_VISIBILITIES = ['PUBLIC_SUPPORT', 'INTERNAL_SUPPORT', 'PLATFORM_ADMIN_ONLY'] as const;
export const KB_STATUSES = ['DRAFT', 'ACTIVE', 'OUTDATED', 'ARCHIVED'] as const;
/** Статус, который можно поставить вручную: ACTIVE делает только публикация */
const MANUAL_STATUSES = KB_STATUSES.filter((s) => s !== 'ACTIVE');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_MAX = 20_000;

const rejectedText = (error: assistant.BotRejectedError): string =>
  redactText(`${assistant.SUPPORT_BOT.name} отклонил: ${error.detail}`, 500);

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    panelHttpError(error, assistant.SUPPORT_BOT, rejectedText);
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value))
    throw new BadRequestException(`${name}: допустимо ${allowed.join(', ')}`);
  return value as T;
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BadRequestException('Неверный идентификатор');
  return value.toLowerCase();
}

function text(value: unknown, name: string, max: number, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && value.trim() === ''))
    throw new BadRequestException(`${name}: нужен текст`);
  if (value.length > max) throw new BadRequestException(`${name}: не длиннее ${max} знаков`);
  return value;
}

/** Запись как её отдаёт бот (snake_case) → как её читает стойка (camelCase); лишних полей не пропускаем */
function entryView(raw: unknown) {
  const e = obj(raw);
  return {
    id: str(e.id),
    title: str(e.title),
    category: str(e.category),
    visibility: str(e.visibility),
    status: str(e.status),
    version: num(e.version),
    source: str(e.source),
    approvedBy: str(e.approved_by),
    approvedAt: str(e.approved_at),
    createdAt: str(e.created_at),
    updatedAt: str(e.updated_at),
    ...(typeof e.excerpt === 'string' ? { excerpt: e.excerpt } : {}),
    ...(typeof e.content === 'string' ? { content: e.content } : {}),
    ...(Array.isArray(e.versions)
      ? {
          versions: asList(e.versions).map((v) => {
            const x = obj(v);
            return {
              version: num(x.version),
              title: str(x.title),
              category: str(x.category),
              visibility: str(x.visibility),
              content: str(x.content),
              savedBy: str(x.saved_by),
              savedAt: str(x.saved_at),
            };
          }),
        }
      : {}),
  };
}

function listView(raw: unknown) {
  const r = obj(raw);
  const counts = obj(r.counts);
  return {
    items: asList(r.items).map(entryView),
    counts: Object.fromEntries(KB_STATUSES.map((s) => [s, num(counts[s])])),
  };
}

/** Журнал действий бота (S6): только слова и статусы, `result` — короткая строка без ПД (маска у бота) */
function actionsView(raw: unknown) {
  return {
    items: asList(obj(raw).items).map((row) => {
      const x = obj(row);
      return {
        id: str(x.id),
        action: str(x.action),
        actionClass: str(x.class),
        status: str(x.status),
        result: x.result === null || x.result === undefined ? null : redactText(str(x.result) ?? '', 300),
        createdAt: str(x.createdAt),
        executedAt: str(x.executedAt),
      };
    }),
  };
}

function sourcesView(raw: unknown) {
  return {
    items: asList(obj(raw).items).map((row) => {
      const x = obj(row);
      return {
        knowledgeId: str(x.knowledge_id),
        title: str(x.title),
        version: num(x.version),
        visibility: str(x.visibility),
        score: num(x.score),
        usedAt: str(x.used_at),
      };
    }),
  };
}

/**
 * Управляемая база знаний WETOP Support (S3, `plans/ai-agents-s3-knowledge-2026-09-29.md`): прокси к панели помощника.
 * 🔴 Только главный администратор — проверка первой. `by` и `approved_by` — id администратора из СЕССИИ: поля с такими
 * именами из тела запроса отбрасываются, поэтому подписаться чужим именем или опубликовать «от имени» нельзя.
 */
@Injectable()
export class SupportKnowledgeService {
  constructor(
    @Inject(SUPPORT_CONNECTION) private readonly connection: SupportConnection,
    @Inject(SUPPORT_AUDIT) private readonly audit: SupportAudit,
  ) {}

  private client(): SupportPort {
    const client = this.connection.client();
    if (!client) throw new ServiceUnavailableException(SUPPORT_NOT_CONNECTED);
    return client;
  }

  private who(): string {
    const user = currentUserId();
    if (!user) throw new BadRequestException('Не удалось определить администратора');
    return user;
  }

  private async record(entityId: string, action: string, after: Record<string, unknown>): Promise<void> {
    await this.audit.record({ entityType: 'SupportKnowledge', entityId, action: `support.kb.${action}`, after });
  }

  list(query: { status?: unknown; category?: unknown; visibility?: unknown; q?: unknown }) {
    requirePlatformAdmin();
    const wanted = {
      ...(query.status ? { status: oneOf(query.status, KB_STATUSES, 'status') } : {}),
      ...(query.category ? { category: oneOf(query.category, KB_CATEGORIES, 'category') } : {}),
      ...(query.visibility ? { visibility: oneOf(query.visibility, KB_VISIBILITIES, 'visibility') } : {}),
      ...(typeof query.q === 'string' && query.q.trim() ? { q: query.q.trim().slice(0, 200) } : {}),
    };
    const client = this.client();
    return call(async () => listView(await client.kbList(wanted)));
  }

  read(rawId: string) {
    requirePlatformAdmin();
    const kb = id(rawId);
    const client = this.client();
    return call(async () => entryView(await client.kbRead(kb)));
  }

  async create(raw: unknown) {
    requirePlatformAdmin();
    const body = obj(raw);
    const entry = {
      title: text(body.title, 'title', 200, true),
      category: oneOf(body.category, KB_CATEGORIES, 'category'),
      visibility: oneOf(body.visibility, KB_VISIBILITIES, 'visibility'),
      content: text(body.content, 'content', TEXT_MAX, true),
      ...(body.source !== undefined ? { source: text(body.source, 'source', 200, true) } : {}),
      by: this.who(),
    };
    const client = this.client();
    const created = entryView(await call(() => client.kbCreate(entry)));
    await this.record(created.id ?? '', 'create', { category: entry.category, visibility: entry.visibility });
    return created;
  }

  async update(rawId: string, raw: unknown) {
    requirePlatformAdmin();
    const kb = id(rawId);
    const body = obj(raw);
    const patch = {
      ...(body.title !== undefined ? { title: text(body.title, 'title', 200, true) } : {}),
      ...(body.category !== undefined ? { category: oneOf(body.category, KB_CATEGORIES, 'category') } : {}),
      ...(body.visibility !== undefined ? { visibility: oneOf(body.visibility, KB_VISIBILITIES, 'visibility') } : {}),
      ...(body.content !== undefined ? { content: text(body.content, 'content', TEXT_MAX, true) } : {}),
      ...(body.source !== undefined ? { source: text(body.source, 'source', 200, true) } : {}),
      by: this.who(),
    };
    const client = this.client();
    const updated = entryView(await call(() => client.kbUpdate(kb, patch)));
    await this.record(kb, 'update', { fields: Object.keys(patch).filter((k) => k !== 'by') });
    return updated;
  }

  async publish(rawId: string) {
    requirePlatformAdmin();
    const kb = id(rawId);
    const approver = this.who();
    const client = this.client();
    const published = entryView(await call(() => client.kbPublish(kb, approver)));
    await this.record(kb, 'publish', { approvedBy: approver });
    return published;
  }

  async setStatus(rawId: string, raw: unknown) {
    requirePlatformAdmin();
    const kb = id(rawId);
    const status = oneOf(obj(raw).status, MANUAL_STATUSES, 'status');
    const by = this.who();
    const client = this.client();
    const result = entryView(await call(() => client.kbStatus(kb, status, by)));
    await this.record(kb, 'status', { status });
    return result;
  }

  conversationSources(rawId: string) {
    requirePlatformAdmin();
    const conv = id(rawId);
    const client = this.client();
    return call(async () => sourcesView(await client.conversationKnowledge(conv)));
  }

  conversationActions(rawId: string) {
    requirePlatformAdmin();
    const conv = id(rawId);
    const client = this.client();
    return call(async () => actionsView(await client.conversationActions(conv)));
  }

  async draftFromConversation(rawId: string) {
    requirePlatformAdmin();
    const conv = id(rawId);
    const by = this.who();
    const client = this.client();
    const draft = entryView(await call(() => client.knowledgeDraft(conv, by)));
    await this.record(draft.id ?? conv, 'draft', { conversationId: conv });
    return draft;
  }
}
