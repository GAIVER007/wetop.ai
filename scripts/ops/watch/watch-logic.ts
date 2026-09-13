/**
 * «Сторож сторожа» — логика без сети и таймеров (plans/slice-12-guard-server.md, шаг 12.1).
 *
 * Сторож системы живёт в API на Mac и не может сообщить о собственной смерти. Этот модуль работает на отдельном
 * сервере: принимает сигнал раз в минуту и поднимает тревогу, когда сигнал пропал. Сервер стоит не в Казахстане,
 * поэтому в сигнале только числа — ни заголовков неисправностей, ни номеров броней (ADR-018).
 *
 * Только стираемый синтаксис TypeScript: Node 24 запускает файл как есть, в контейнер он едет без сборки.
 */
import { timingSafeEqual } from 'node:crypto';

/** Сигнала нет столько — тревога */
export const SILENCE_MS = 5 * 60_000;
/** Повтор тревоги, пока сигнал не вернулся; и повтор сообщения о срочных неисправностях */
export const REALERT_MS = 30 * 60_000;

export interface Beat {
  at: string;
  open: number;
  critical: number;
  escalated: number;
  checksFailed: number;
}

export interface WatchState {
  startedAt: Date;
  lastBeatAt: Date | null;
  lastBeat: Beat | null;
  /** Когда сторож замолчал (по последнему сигналу) и когда об этом последний раз сообщили */
  silentAlertedAt: Date | null;
  criticalAlertedAt: Date | null;
}

export interface Step {
  state: WatchState;
  messages: string[];
}

const COUNTS = ['open', 'critical', 'escalated', 'checksFailed'] as const;

export function initialState(now: Date): WatchState {
  return {
    startedAt: now,
    lastBeatAt: null,
    lastBeat: null,
    silentAlertedAt: null,
    criticalAlertedAt: null,
  };
}

/** Из тела запроса — только время и четыре неотрицательных целых. Всё остальное отбрасывается. */
export function parseBeat(body: unknown): Beat | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.at !== 'string' || Number.isNaN(Date.parse(b.at))) return null;
  const out: Beat = { at: b.at, open: 0, critical: 0, escalated: 0, checksFailed: 0 };
  for (const k of COUNTS) {
    const v = b[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null;
    out[k] = v;
  }
  return out;
}

/** `Authorization: Bearer <секрет>`; пустой секрет на сервере не пускает никого */
export function authorized(header: string | undefined, secret: string): boolean {
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const minutes = (ms: number) => Math.round(ms / 60_000);
const almaty = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(11, 16);

export function onBeat(state: WatchState, beat: Beat, now: Date): Step {
  const messages: string[] = [];
  if (state.silentAlertedAt && state.lastBeatAt) {
    messages.push(
      `🟢 PMS Luxx Aparts снова на связи: сторож молчал ${minutes(now.getTime() - state.lastBeatAt.getTime())} мин ` +
        `(с ${almaty(state.lastBeatAt)} до ${almaty(now)} Алматы).`,
    );
  }
  let criticalAlertedAt = beat.critical > 0 ? state.criticalAlertedAt : null;
  if (
    beat.critical > 0 &&
    (!criticalAlertedAt || now.getTime() - criticalAlertedAt.getTime() >= REALERT_MS)
  ) {
    messages.push(
      `🔴 PMS Luxx Aparts: неисправности, срочных: ${beat.critical}, ждут человека: ${beat.escalated}. ` +
        'Откройте экран «Неисправности» в PMS. (Сообщение с сервера — на случай, если будильник с Mac не доходит.)',
    );
    criticalAlertedAt = now;
  }
  return {
    state: { ...state, lastBeatAt: now, lastBeat: beat, silentAlertedAt: null, criticalAlertedAt },
    messages,
  };
}

export function onTimer(state: WatchState, now: Date): Step {
  const since = state.lastBeatAt ?? state.startedAt;
  const silentMs = now.getTime() - since.getTime();
  if (silentMs < SILENCE_MS) return { state, messages: [] };
  const last = state.silentAlertedAt;
  if (last && now.getTime() - last.getTime() < REALERT_MS) return { state, messages: [] };
  const text = state.lastBeatAt
    ? `🔴 PMS Luxx Aparts молчит ${minutes(silentMs)} мин (последний сигнал сторожа в ${almaty(state.lastBeatAt)} Алматы). ` +
      'Mac выключен или спит, нет интернета, или упал API. Стойке: заезды на бумажный лист; проверить Mac.'
    : `🔴 PMS Luxx Aparts: с запуска сторожа на сервере (${almaty(state.startedAt)} Алматы) не пришло ни одного сигнала ` +
      'от PMS. Проверить, что на Mac вписаны GUARD_HEARTBEAT_URL и GUARD_HEARTBEAT_SECRET и API работает.';
  return { state: { ...state, silentAlertedAt: now }, messages: [text] };
}
