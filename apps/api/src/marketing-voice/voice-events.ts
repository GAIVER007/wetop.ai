/**
 * Событие голосового звонка от воркера и слияние его со строкой звонка (DATA_MODEL VOICE-OWNER-APPROVAL-20261022).
 *
 * Чистая логика без базы. Правила: событие идемпотентно по (агент, внешний ID звонка); состояние идёт только вперёд,
 * конечные ENDED, REJECTED, FAILED не меняются; время ставит приложение (UTC), длительность считает сервер, а не
 * воркер; в сообщениях об ошибках значений полей нет (там телефоны).
 */

export type VoiceState = 'RECEIVED' | 'ANSWERED' | 'ENDED' | 'REJECTED' | 'FAILED';
export type VoiceDirection = 'INBOUND' | 'OUTBOUND';

export interface VoiceCallbackInput {
  phone: string;
  name: string;
  note: string;
}

export interface VoiceEvent {
  agentId: string;
  externalCallId: string;
  state: VoiceState;
  occurredAt: Date;
  direction: VoiceDirection;
  dialedNumber: string | null;
  callerMasked: string | null;
  endReason: string | null;
  errorCode: string | null;
  transferRequested: boolean;
  consentAnnounced: boolean | null;
  callback: VoiceCallbackInput | null;
}

export interface CallValues {
  state: VoiceState;
  direction: VoiceDirection;
  receivedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  dialedNumber: string | null;
  callerMasked: string | null;
  endReason: string | null;
  errorCode: string | null;
  transferRequested: boolean;
  callbackRequested: boolean;
  consentAnnounced: boolean;
}

export class VoiceEventError extends Error {}

const STATES: readonly VoiceState[] = ['RECEIVED', 'ANSWERED', 'ENDED', 'REJECTED', 'FAILED'];
const FIELDS = new Set([
  'agentId', 'externalCallId', 'state', 'occurredAt', 'direction', 'dialedNumber', 'callerMasked', 'endReason',
  'errorCode', 'transferRequested', 'consentAnnounced', 'callback',
]);
const CALLBACK_FIELDS = new Set(['phone', 'name', 'note']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTERNAL_ID = /^[\x21-\x7E]{1,128}$/;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const E164 = /^\+[0-9]{10,15}$/;
const MASKED = /^\*\*\*[0-9]{0,4}$/;
const FUTURE_SKEW_MS = 5 * 60_000;
const MAX_AGE_MS = 30 * 86_400_000;

const bad = (what: string): never => {
  throw new VoiceEventError(what);
};

/** Телефон в E.164: «8 700 …» и «700 …» читаются как +7 (Казахстан и Россия делят код) */
export function toE164(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || /[A-Za-z]/.test(text)) return null;
  const plus = text.startsWith('+');
  let digits = text.replace(/\D/g, '');
  if (!plus) {
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    else if (digits.length === 10) digits = `7${digits}`;
  }
  const out = `+${digits}`;
  return E164.test(out) ? out : null;
}

const optionalText = (value: unknown, max: number, field: string): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return bad(`${field}: ожидалась строка`);
  const text = value.trim();
  if (text.length > max) return bad(`${field}: длиннее ${max}`);
  return text === '' ? null : text;
};

const optionalBool = (value: unknown, field: string): boolean | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') return bad(`${field}: ожидалось true или false`);
  return value;
};

export function parseVoiceEvent(dto: unknown, now: Date = new Date()): VoiceEvent {
  if (typeof dto !== 'object' || dto === null || Array.isArray(dto)) return bad('Тело события должно быть объектом');
  const body = dto as Record<string, unknown>;
  for (const key of Object.keys(body)) if (!FIELDS.has(key)) return bad(`Лишнее поле: ${key.slice(0, 40)}`);

  const agentId = body.agentId;
  if (typeof agentId !== 'string' || !UUID.test(agentId)) return bad('agentId: ожидался UUID');
  const externalCallId = body.externalCallId;
  if (typeof externalCallId !== 'string' || !EXTERNAL_ID.test(externalCallId))
    return bad('externalCallId: от 1 до 128 видимых знаков без пробелов');
  const state = body.state;
  if (typeof state !== 'string' || !STATES.includes(state as VoiceState)) return bad('state: неизвестное состояние');

  const at = body.occurredAt;
  if (typeof at !== 'string' || !ISO_WITH_ZONE.test(at)) return bad('occurredAt: ожидалось время ISO с поясом');
  const occurredAt = new Date(at);
  if (Number.isNaN(occurredAt.getTime())) return bad('occurredAt: время не читается');
  if (occurredAt.getTime() > now.getTime() + FUTURE_SKEW_MS) return bad('occurredAt: время из будущего');
  if (occurredAt.getTime() < now.getTime() - MAX_AGE_MS) return bad('occurredAt: событие старше 30 суток');

  const direction = body.direction === undefined ? 'INBOUND' : body.direction;
  if (direction !== 'INBOUND' && direction !== 'OUTBOUND') return bad('direction: INBOUND или OUTBOUND');

  const dialed = body.dialedNumber;
  if (dialed !== undefined && dialed !== null && (typeof dialed !== 'string' || !E164.test(dialed)))
    return bad('dialedNumber: ожидался номер E.164');
  const masked = body.callerMasked;
  if (masked !== undefined && masked !== null && (typeof masked !== 'string' || !MASKED.test(masked)))
    return bad('callerMasked: ожидалась маска вида ***1234');

  let callback: VoiceCallbackInput | null = null;
  if (body.callback !== undefined && body.callback !== null) {
    const cb = body.callback;
    if (typeof cb !== 'object' || Array.isArray(cb)) return bad('callback: ожидался объект');
    const raw = cb as Record<string, unknown>;
    for (const key of Object.keys(raw)) if (!CALLBACK_FIELDS.has(key)) return bad('callback: лишнее поле');
    const phone = toE164(raw.phone);
    if (!phone) return bad('callback.phone: ожидался номер телефона');
    callback = {
      phone,
      name: optionalText(raw.name, 100, 'callback.name') ?? '',
      note: optionalText(raw.note, 500, 'callback.note') ?? '',
    };
  }

  return {
    agentId: agentId.toLowerCase(),
    externalCallId,
    state: state as VoiceState,
    occurredAt,
    direction,
    dialedNumber: (dialed as string | null | undefined) ?? null,
    callerMasked: (masked as string | null | undefined) ?? null,
    endReason: optionalText(body.endReason, 40, 'endReason'),
    errorCode: optionalText(body.errorCode, 40, 'errorCode'),
    transferRequested: optionalBool(body.transferRequested, 'transferRequested') ?? false,
    consentAnnounced: optionalBool(body.consentAnnounced, 'consentAnnounced'),
    callback,
  };
}

const FINAL: readonly VoiceState[] = ['ENDED', 'REJECTED', 'FAILED'];
const rank = (state: VoiceState): number => (FINAL.includes(state) ? 3 : state === 'ANSWERED' ? 2 : 1);
const notBefore = (at: Date, floor: Date): Date => (at.getTime() < floor.getTime() ? floor : at);

/**
 * Следующее значение звонка по событию. `changed: false`: событие ничего нового не дало (повтор или запоздалое
 * событие меньшего ранга). `receivedAt` берётся из первого пришедшего события и дальше не меняется (база его запирает).
 */
export function applyEvent(existing: CallValues | null, ev: VoiceEvent): { next: CallValues; changed: boolean } {
  const base: CallValues = existing ?? {
    state: ev.state,
    direction: ev.direction,
    receivedAt: ev.occurredAt,
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    dialedNumber: null,
    callerMasked: null,
    endReason: null,
    errorCode: null,
    transferRequested: false,
    callbackRequested: false,
    consentAnnounced: true,
  };

  const forward = existing !== null && rank(ev.state) > rank(existing.state) && !FINAL.includes(existing.state);
  const state = existing === null ? ev.state : forward ? ev.state : existing.state;

  let answeredAt = base.answeredAt;
  if (ev.state === 'ANSWERED' && answeredAt === null) answeredAt = notBefore(ev.occurredAt, base.receivedAt);
  let endedAt = base.endedAt;
  if (FINAL.includes(ev.state) && endedAt === null && state === ev.state) endedAt = notBefore(ev.occurredAt, base.receivedAt);

  const durationSeconds =
    state === 'ENDED' && answeredAt && endedAt
      ? Math.max(0, Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000))
      : base.durationSeconds;

  const next: CallValues = {
    state,
    direction: base.direction,
    receivedAt: base.receivedAt,
    answeredAt,
    endedAt,
    durationSeconds,
    dialedNumber: base.dialedNumber ?? ev.dialedNumber,
    callerMasked: base.callerMasked ?? ev.callerMasked,
    endReason: base.endReason ?? ev.endReason,
    errorCode: base.errorCode ?? ev.errorCode,
    transferRequested: base.transferRequested || ev.transferRequested,
    callbackRequested: base.callbackRequested || ev.callback !== null,
    consentAnnounced: base.consentAnnounced && ev.consentAnnounced !== false,
  };

  const changed =
    existing === null ||
    (Object.keys(next) as Array<keyof CallValues>).some((key) => {
      const a = next[key];
      const b = existing[key];
      return a instanceof Date && b instanceof Date ? a.getTime() !== b.getTime() : a !== b;
    });
  return { next, changed };
}
