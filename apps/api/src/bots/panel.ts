import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { assistant } from '@pms/integrations';

/**
 * Панель бота глазами API платформы (контракт — docs/assistant/README.md §4). Один образ бота — две роли, и панель у
 * них одна: раздел «ИИ-продавец» (ADR-079) и «Платформа → Техподдержка» (ADR-083, Э3) говорят с ней одинаково. Здесь
 * — то, что у них общее: проверка того, что пришло от стойки, до вызова бота, и ответы бота в словах стойки
 * (camelCase, только известные поля).
 */

export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
export const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const CONVERSATION_MODES = ['bot_active', 'needs_human', 'owner_takeover'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Форматы знаний по ТЗ §4.1 и что сообщить боту вместо того, что прислал браузер */
const KNOWLEDGE_TYPES: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  txt: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Как у бота (`kb_max_file_mb = 10`, `apps/ai-seller/src/config.py`): больше он всё равно не примет */
export const KNOWLEDGE_MAX_BYTES = 10 * 1024 * 1024;
/** Ответ человека в диалоге — до 4000 знаков, как принимает панель */
export const REPLY_MAX = 4000;

// ── то, что пришло от стойки: проверяется до вызова бота ──────────────────────────────────────

export function conversationId(id: string): string {
  if (!UUID.test(id)) throw new BadRequestException('Диалог: ожидается идентификатор');
  return id.toLowerCase();
}

/** Отбор диалогов: режим — только из трёх, предел — целое от 1 до 200 */
export function conversationQuery(query: { mode?: unknown; limit?: unknown }): {
  mode?: string;
  limit?: number;
} {
  const mode = query.mode === undefined || query.mode === '' ? undefined : String(query.mode);
  if (mode !== undefined && !(CONVERSATION_MODES as readonly string[]).includes(mode))
    throw new BadRequestException('Режим диалога: bot_active, needs_human или owner_takeover');
  let limit: number | undefined;
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n)) throw new BadRequestException('limit: ожидается целое число');
    limit = Math.min(Math.max(n, 1), 200);
  }
  return { ...(mode ? { mode } : {}), ...(limit ? { limit } : {}) };
}

export function replyText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') throw new BadRequestException('Ответ: пустое сообщение');
  if (text.length > REPLY_MAX)
    throw new BadRequestException(`Ответ: не длиннее ${REPLY_MAX} знаков`);
  return text;
}

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Документ знаний: есть ли он и тот ли формат; тип — по расширению, а не по тому, что прислал браузер */
export function knowledgeFile(file: UploadedFile | undefined): {
  name: string;
  type: string;
  data: Uint8Array;
  size: number;
} {
  if (!file) throw new BadRequestException('Знания: приложите файл');
  const name = file.originalname.trim() || 'документ';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const type = KNOWLEDGE_TYPES[ext];
  if (!type) throw new UnsupportedMediaTypeException('Знания: md, txt, pdf, docx или xlsx');
  return { name, type, data: new Uint8Array(file.buffer), size: file.size };
}

// ── ответы бота ──────────────────────────────────────────────────────────────────────────────

export function conversationsView(body: unknown) {
  return {
    items: list(obj(body).items).map((item) => {
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

export function conversationView(raw: unknown, id: string) {
  const body = obj(raw);
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

export function modeView(raw: unknown) {
  const body = obj(raw);
  return { mode: str(body.mode), previousMode: str(body.previous_mode) };
}

export function knowledgeView(raw: unknown) {
  return {
    items: list(obj(raw).items).map((item) => {
      const i = obj(item);
      return { source: str(i.source) ?? '', chunks: num(i.chunks), createdAt: str(i.created_at) };
    }),
  };
}

export function uploadedView(raw: unknown, name: string) {
  const body = obj(raw);
  return {
    source: str(body.source) ?? name,
    created: body.created === true,
    chunks: num(body.chunks),
  };
}

export function summaryView(raw: unknown) {
  const body = obj(raw);
  return {
    hours: num(body.hours),
    dialogs: num(body.dialogs),
    replies: num(body.replies),
    leads: num(body.leads),
    slaBreaches: num(body.sla_breaches),
  };
}

// ── отказы бота ──────────────────────────────────────────────────────────────────────────────

/**
 * Отказ бота → ответ API: недоступен — 503, не нашёл — 404, не принял ключ — 503 словами бота с его именем («Доступ с
 * этого адреса закрыт» без имени непонятно чей), отклонил по содержанию — 422 словами `rejectedText`. Отказ самой
 * платформы (`HttpException`) проходит как есть.
 */
export function panelHttpError(
  error: unknown,
  bot: assistant.BotNames,
  rejectedText: (error: assistant.BotRejectedError) => string,
): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof assistant.BotUnavailableError)
    throw new ServiceUnavailableException(error.message);
  if (error instanceof assistant.BotRejectedError) {
    if (error.status === 404) throw new NotFoundException(error.detail);
    if (error.status === 401 || error.status === 403)
      throw new ServiceUnavailableException(
        error.detail.startsWith(bot.name) ? error.detail : `${bot.name}: ${error.detail}`,
      );
    throw new UnprocessableEntityException(rejectedText(error));
  }
  throw error;
}
